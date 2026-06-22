/**
 * Catalogue helpers — node-kind discrimination plus the adapter that
 * turns a catalogue `options` hash into the `IOptionsSchema` the shared
 * `<Options>` field renders.
 *
 * The editor is fully server-driven: it never hard-codes a DataSchema
 * shape. Every form field comes from `GET /schemas?action=options`
 * through these helpers.
 */
import { TQorusType } from '@qoretechnologies/ts-toolkit';
import { IQorusAllowedValue } from '@qoretechnologies/ts-toolkit/dist/types/forms';
import { IOptions, IOptionsSchema, TOption } from '../../engine/FormEngine';
import {
  ICatalogGroup,
  ICatalogLeaf,
  ICatalogList,
  ICatalogMap,
  ICatalogNode,
  ICatalogOptions,
} from './types';

/** A catalogue node is a leaf when it carries no nested `options` tree. */
export const isCatalogLeaf = (node: ICatalogNode): node is ICatalogLeaf =>
  !('options' in node) || node.options === undefined;

/** A group wraps nested `options` and carries no scalar `type`. */
export const isCatalogGroup = (node: ICatalogNode): node is ICatalogGroup =>
  !isCatalogLeaf(node) && node.type === undefined;

/** A node is optional when its Qore type string is prefixed with `*`. */
export const isOptionalType = (type?: string): boolean =>
  typeof type === 'string' && type.startsWith('*');

/** Strips the leading `*` (optional marker) from a Qore type string. */
const bareType = (type: string): string =>
  type.startsWith('*') ? type.slice(1) : type;

/**
 * A map is `*hash<auto>` + a per-entry `options` shape. The type must
 * *start* with `hash` — a list of hashes (`*list<hash<auto>>`) also
 * contains the substring `hash`, so a prefix check is required.
 */
export const isCatalogMap = (node: ICatalogNode): node is ICatalogMap =>
  !isCatalogLeaf(node) &&
  typeof node.type === 'string' &&
  bareType(node.type).startsWith('hash');

/** A list is `*list<hash<auto>>` + a per-element `options` shape. */
export const isCatalogList = (node: ICatalogNode): node is ICatalogList =>
  !isCatalogLeaf(node) &&
  typeof node.type === 'string' &&
  bareType(node.type).startsWith('list');

/**
 * Maps a catalogue Qore type string to the `<Options>` field type plus
 * the element type for list fields.
 *
 * The field type is a string rather than `TQorusType` because the
 * `<Options>` / `auto` field accepts `IQorusType` — a superset that
 * includes `select-string`, which the typed `TQorusType` union omits.
 */
export const catalogTypeToFieldType = (
  type: string
): { fieldType: string; elementType?: string } => {
  const bare = bareType(type);
  if (bare === 'select-string') {
    return { fieldType: 'select-string' };
  }
  if (bare.startsWith('list<')) {
    const inner = bare.slice('list<'.length, -1);
    return {
      fieldType: 'list',
      elementType: inner === 'string' ? 'string' : 'auto',
    };
  }
  if (bare.startsWith('hash')) {
    return { fieldType: 'hash' };
  }
  switch (bare) {
    case 'string':
      return { fieldType: 'string' };
    case 'int':
      return { fieldType: 'int' };
    case 'float':
      return { fieldType: 'float' };
    case 'number':
      return { fieldType: 'number' };
    case 'bool':
      return { fieldType: 'bool' };
    case 'date':
      return { fieldType: 'date' };
    default:
      // `*auto`, `auto`, and anything unrecognised fall back to the
      // free-form `auto` field so no catalogue value is ever undroppable.
      return { fieldType: 'auto' };
  }
};

/** Converts catalogue `{value, display_name}` entries to `<Options>` allowed values. */
const toAllowedValues = (
  leaf: ICatalogLeaf
): IQorusAllowedValue[] | undefined => {
  if (!leaf.allowed_values || leaf.allowed_values.length === 0) {
    return undefined;
  }
  return leaf.allowed_values.map((av) => ({
    display_name: av.display_name,
    value: { type: 'string' as TQorusType, value: av.value },
  }));
};

/**
 * Converts a single catalogue leaf to a `<Options>` field schema. Group
 * / map / list nodes are not form fields and must not be passed here.
 *
 * The cast bridges `select-string` (an `IQorusType` the `auto` field
 * renders) past the narrower `TQorusType` the schema object is typed
 * with.
 */
export const catalogLeafToFieldSchema = (
  leaf: ICatalogLeaf
): IOptionsSchema[string] => {
  const { fieldType, elementType } = catalogTypeToFieldType(leaf.type);
  const allowedValues = toAllowedValues(leaf);
  return {
    type: fieldType,
    ui_type: fieldType,
    display_name: leaf.display_name,
    short_desc: leaf.short_desc,
    desc: leaf.desc,
    required: !!leaf.required && !isOptionalType(leaf.type),
    ...(elementType ? { element_type: elementType } : {}),
    ...(allowedValues ? { allowed_values: allowedValues } : {}),
  } as unknown as IOptionsSchema[string];
};

/**
 * Builds a new map / list entry pre-seeded with sensible defaults so
 * it does not open in an invalid state — every required enum leaf is
 * set to its first allowed value (a new column defaults to the first
 * column type, a new migration step to the first action, …).
 */
export const seedNewEntry = (
  options: ICatalogOptions
): Record<string, unknown> => {
  const seed: Record<string, unknown> = {};
  Object.entries(options).forEach(([key, node]) => {
    if (
      isCatalogLeaf(node) &&
      node.required &&
      node.allowed_values &&
      node.allowed_values.length > 0
    ) {
      seed[key] = node.allowed_values[0].value;
    }
  });
  return seed;
};

/**
 * Splits a catalogue `options` hash into its leaf fields (rendered as
 * one `<Options>` form) and its nested group / map / list children
 * (each rendered by its own recursive editor).
 */
export const partitionCatalogOptions = (options: ICatalogOptions) => {
  const leaves: ICatalogOptions = {};
  const nested: Array<[string, ICatalogNode]> = [];
  Object.entries(options).forEach(([key, node]) => {
    if (isCatalogLeaf(node)) {
      leaves[key] = node;
    } else {
      nested.push([key, node]);
    }
  });
  return { leaves, nested };
};

/** Builds the `<Options>` schema for the leaf subset of a catalogue hash. */
export const leavesToOptionsSchema = (
  leaves: ICatalogOptions
): IOptionsSchema => {
  const schema: IOptionsSchema = {};
  Object.entries(leaves).forEach(([key, node]) => {
    if (isCatalogLeaf(node)) {
      schema[key] = catalogLeafToFieldSchema(node);
    }
  });
  return schema;
};

/**
 * Wraps a plain definition hash into the `{type, value}` form
 * `<Options>` expects, keyed only by the leaf fields in `schema`.
 */
export const hashToOptionsValue = (
  hash: Record<string, unknown> | undefined,
  schema: IOptionsSchema
): IOptions => {
  const value: IOptions = {};
  Object.entries(schema).forEach(([key, field]) => {
    if (hash && hash[key] !== undefined) {
      let raw = hash[key];
      // The `<Options>` list field expects elements wrapped as
      // `{value, type}` — a bare `['a','b']` renders as empty rows.
      if (field.type === 'list' && Array.isArray(raw)) {
        const elementType =
          (field as { element_type?: string }).element_type ?? 'string';
        raw = raw.map((el) => ({ value: el, type: elementType }));
      }
      value[key] = {
        type: field.type as TQorusType,
        value: raw,
      } as TOption;
    }
  });
  return value;
};

/**
 * Inverse of {@link hashToOptionsValue}'s list wrapping — flattens a
 * `<Options>` list value (`[{value, type}]`) back to the bare array
 * (`['a', 'b']`) the DataSchema definition stores.
 */
export const unwrapListValues = (
  flat: Record<string, unknown>,
  schema: IOptionsSchema
): void => {
  Object.entries(schema).forEach(([key, field]) => {
    if (field.type === 'list' && Array.isArray(flat[key])) {
      flat[key] = (flat[key] as unknown[]).map((el) =>
        el && typeof el === 'object' && 'value' in el
          ? (el as { value: unknown }).value
          : el
      );
    }
  });
};
