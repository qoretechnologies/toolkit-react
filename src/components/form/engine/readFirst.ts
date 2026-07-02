import { IQorusFormField, TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import { isUiEncodedValue } from './_structuredData/structuredData';
import { renderExpressionToText } from '../expressions/renderExpressionToText';
import { IExpressionValue } from '../expressions/types';
import yaml from 'js-yaml';
import { richtextToString } from '../../../helpers/common';

/** "N noun" with naive pluralisation ("1 item", "2 items"). */
const pluralize = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

// The server's typed-value serialization wraps each value in an envelope —
// `{ type, value }` plus optional descriptive keys. Only this exact shape is
// unwrapped; any foreign key means it's a real user hash, not an envelope.
// One envelope definition for the whole engine: the structured tree and the
// hash summaries must agree on what unwraps (`isUiEncodedValue` carries the
// full server allow-list, incl. keys like `sensitive`/`required`).
const isTypedEnvelope = (raw: unknown): raw is IQorusFormField => isUiEncodedValue(raw);

/** Reduce ONE list item to a short, human label — never an object. Unwraps a
 * typed `{type, value}` envelope, prefers a `name`/`display_name`, and returns
 * undefined for a bare object (no name) so the caller falls back to a count
 * instead of printing "[object Object]". */
const summarizeListItem = (item: unknown): string | number | undefined => {
  if (item === null || item === undefined) return undefined;
  if (typeof item !== 'object') return item as string | number;
  const obj = item as Record<string, unknown>;
  // A named object (or allowed-value) → its label.
  if (typeof obj.name === 'string' || typeof obj.name === 'number') return obj.name;
  if (typeof obj.display_name === 'string') return obj.display_name;
  // A typed envelope ({type, value}) or a {value} wrapper → look inside once.
  if ('value' in obj) {
    const inner = obj.value;
    if (inner === null || inner === undefined) return undefined;
    if (typeof inner !== 'object') return inner as string | number;
    const innerName = (inner as Record<string, unknown>).name;
    return typeof innerName === 'string' || typeof innerName === 'number' ? innerName : undefined;
  }
  return undefined;
};

/** Summarise a list value: join item labels, or fall back to an "N items" count
 * (e.g. a list of anonymous hashes). Never prints raw objects. */
const formatList = (items: unknown[]): string => {
  const parts = items
    .map(summarizeListItem)
    .filter((part) => part !== '' && part !== undefined && part !== null);

  return parts.length ? parts.join(', ') : pluralize(items.length, 'item');
};

/** Summarise a hash/object by its field count ("2 fields"), or "Set" when empty. */
const fieldCountLabel = (obj: object): string => {
  const keys = Object.keys(obj);
  return keys.length ? pluralize(keys.length, 'field') : 'Set';
};

/** The object/list editor stores complex values as a serialized YAML string
 * (`%YAML 1.2 --- […]`) — parse it back for the summary; undefined when the
 * string isn't a serialized structure. */
const parseSerialized = (value: string, type?: string): unknown => {
  const looksLikeYamlDoc = /^\s*(%YAML|---)\s/.test(value);
  if (type !== 'list' && type !== 'hash' && !looksLikeYamlDoc) {
    return undefined;
  }
  try {
    return yaml.load(value);
  } catch {
    return undefined;
  }
};

/**
 * Pure helpers for FormEngine compact (read-first) mode: format an option's
 * stored value into a short summary and resolve its group. Unit-testable.
 */

/** A value is "empty" (nothing set) when it is nullish, an empty string, or an empty array. */
export const isOptionValueEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/** Prefer the matching allowed_values entry's display_name (fallback `name`)
 * over the raw stored value. */
const findAllowedOption = (value: unknown, schema?: TQorusFormFieldSchema): any | undefined => {
  const s = schema as { allowed_values?: any[]; items?: any[] } | undefined;
  const options = s?.allowed_values?.length ? s.allowed_values : s?.items;
  if (!options?.length) {
    return undefined;
  }
  return options.find(
    (option) =>
      option?.value?.value === value || option?.value === value || option?.name === value
  );
};

const getAllowedValueLabel = (
  value: unknown,
  schema?: TQorusFormFieldSchema
): string | undefined => {
  const match = findAllowedOption(value, schema);
  return match ? match.display_name || match.title || match.name || undefined : undefined;
};

/** True when the field's selectable options carry images (logos). Such a choice
 * renders too tall/rich for an inline row, so compact opens it in the card. */
export const optionHasImages = (schema?: TQorusFormFieldSchema): boolean => {
  const s = schema as { allowed_values?: any[]; items?: any[] } | undefined;
  const options = s?.allowed_values?.length ? s.allowed_values : s?.items;
  return !!options?.some((option) => !!option?.image);
};

/** The selected option's image (logo), when it carries one — for the value cell. */
export const getAllowedValueImage = (
  value: unknown,
  schema?: TQorusFormFieldSchema
): string | undefined => {
  const match = findAllowedOption(value, schema);
  return (match?.image as string) || undefined;
};

/** Clamp an RGB channel to a 0–255 integer. */
const clampChannel = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const toHexPart = (n: number): string => clampChannel(n).toString(16).padStart(2, '0');

/** The shape the rgbcolor field stores (react-color's RGBA result). */
type TColorValue = { r?: number; g?: number; b?: number; a?: number; hex?: string };

/** Normalised colour parts parsed from any shape the rgbcolor field can store. */
interface IParsedColor {
  hex?: string;
  r?: number;
  g?: number;
  b?: number;
  a: number;
}

/** Whether parsed colour parts carry usable RGB channels. */
const hasRgb = (
  c: IParsedColor
): c is IParsedColor & { r: number; g: number; b: number } =>
  c.r !== undefined && c.g !== undefined && c.b !== undefined;

/** Parse an `rgbcolor` into normalised parts: accepts `{ r, g, b, a }` (may
 * carry `hex`), `{ hex }`, or a raw hex string; undefined when unrecognisable. */
const parseColor = (value: unknown): IParsedColor | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.startsWith('#') ? { hex: trimmed, a: 1 } : undefined;
  }
  if (value && typeof value === 'object') {
    const c = value as TColorValue;
    const a = typeof c.a === 'number' ? c.a : 1;
    const hex = typeof c.hex === 'string' && c.hex.trim() ? c.hex.trim() : undefined;
    if (typeof c.r === 'number' && typeof c.g === 'number' && typeof c.b === 'number') {
      return { r: c.r, g: c.g, b: c.b, a, hex };
    }
    if (hex) {
      return { hex, a };
    }
  }
  return undefined;
};

/** Uppercase hex (`#0000FF`), or `rgba(…)` when non-opaque; undefined when
 * unrecognisable (the caller falls back to the generic marker). */
export const formatColorValue = (value: unknown): string | undefined => {
  const c = parseColor(value);
  if (!c) {
    return undefined;
  }
  // Prefer rgba(…) for non-opaque colours; the hex shortcut would drop alpha.
  if (c.a < 1 && hasRgb(c)) {
    const alpha = Math.round(c.a * 100) / 100;
    return `rgba(${clampChannel(c.r)}, ${clampChannel(c.g)}, ${clampChannel(c.b)}, ${alpha})`;
  }
  if (c.hex) {
    return c.hex.toUpperCase();
  }
  return hasRgb(c) ?
      `#${toHexPart(c.r)}${toHexPart(c.g)}${toHexPart(c.b)}`.toUpperCase()
    : undefined;
};

/** CSS colour for the swatch preview (keeps alpha); undefined when
 * unrecognisable. */
export const colorToCss = (value: unknown): string | undefined => {
  const c = parseColor(value);
  if (!c) {
    return undefined;
  }
  return hasRgb(c) ? `rgba(${clampChannel(c.r)}, ${clampChannel(c.g)}, ${clampChannel(c.b)}, ${c.a})` : (
      c.hex
    );
};

/** Filename for a `file` value: accepts `{ name, content, size }`, the
 * build-tab `{ name: { value } }` shape, or a raw path; undefined when no
 * filename resolves. */
export const formatFileValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const name = value.trim().split(/[\\/]/).pop();
    return name || undefined;
  }
  if (value && typeof value === 'object') {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }
    const nested = (name as { value?: unknown } | undefined)?.value;
    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }
  }
  return undefined;
};

/** The byte size of a `file` value, when present (for the muted size suffix). */
export const getFileSize = (value: unknown): number | undefined => {
  const size = (value as { size?: unknown } | undefined)?.size;
  return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined;
};

/** Effective UI type for display: the stored `type` wins (any/auto picks),
 * then schema `ui_type`, then `type`. */
export const getValueType = (
  option?: IQorusFormField,
  schema?: TQorusFormFieldSchema
): string | undefined =>
  (option?.type ||
    (schema as { ui_type?: string; type?: string } | undefined)?.ui_type ||
    (schema as { type?: string } | undefined)?.type) as string | undefined;

/** Human-readable byte count (e.g. `1.2 KB`). */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || Number.isInteger(size) ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
};

/**
 * Short read-first summary of a value; '' when unset (the caller renders the
 * placeholder). Bools → Yes/No, allowed_values → display label, colour →
 * hex/rgba, file → filename, richtext → plain text, list → joined names,
 * hash → "N fields" (generic "Set" fallback).
 */
/** Read-first summary of a `schema-definition` value: the schema name plus a
 * table count (e.g. `orders · 2 tables`). */
const formatSchemaDefinition = (value: unknown): string => {
  if (!value || typeof value !== 'object') return 'Schema';
  const def = value as { schema?: { name?: string }; tables?: object };
  const name = def.schema?.name;
  const count = def.tables ? Object.keys(def.tables).length : 0;
  const tables = count ? ` · ${count} table${count === 1 ? '' : 's'}` : '';
  return name ? `${name}${tables}` : 'Schema';
};

export const formatOptionValue = (
  option?: IQorusFormField,
  schema?: TQorusFormFieldSchema
): string => {
  const value = option?.value;

  if (isOptionValueEmpty(value)) {
    return '';
  }

  // A sensitive option (passwords, tokens) must never print its value in the
  // read-first row — the formatted string also feeds the row's hover title.
  if ((schema as { sensitive?: boolean } | undefined)?.sensitive) {
    return '••••••';
  }

  if (option?.is_expression) {
    // Offline summary of the {exp,args} AST already in the form value — the
    // same client-side renderer the editor's "Explain" seam falls back to when
    // the LSP is unreachable. The drill-in editor shows the canonical DPQL.
    return renderExpressionToText(option?.value as IExpressionValue | undefined) || 'Expression';
  }

  // schema-definition is stored as a hash envelope; summarise it as the schema
  // name + table count rather than a meaningless top-level key count.
  if ((schema as { ui_type?: string } | undefined)?.ui_type === 'schema-definition') {
    return formatSchemaDefinition(value);
  }

  const type = getValueType(option, schema);

  if (type === 'bool' || type === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  const allowedLabel = getAllowedValueLabel(value, schema);
  if (allowedLabel) {
    return allowedLabel;
  }

  if (type === 'rgbcolor') {
    return formatColorValue(value) ?? 'Set';
  }

  if (type === 'file') {
    return formatFileValue(value) ?? 'Set';
  }

  if (type === 'richtext') {
    const text = richtextToString(value as any);
    return text && text.trim() ? text : 'Set';
  }

  if (Array.isArray(value)) {
    return formatList(value);
  }

  // A serialized list/hash (the object editor stores them as a YAML string):
  // parse it back and summarise rather than showing the raw `%YAML 1.2 --- …`.
  if (typeof value === 'string') {
    const parsed = parseSerialized(value, type);
    if (Array.isArray(parsed)) {
      return formatList(parsed);
    }
    if (parsed && typeof parsed === 'object') {
      return fieldCountLabel(parsed as object);
    }
    if (parsed !== undefined && parsed !== null && typeof parsed !== 'object') {
      return String(parsed);
    }
  }

  if (typeof value === 'object') {
    return fieldCountLabel(value as object);
  }

  return String(value);
};

/** One sub-field of a hash value, summarised for a read-first sub-row. */
export interface IReadFirstHashEntry {
  /** The raw key in the hash. */
  name: string;
  /** Display label — the sub-field's `display_name` (from `arg_schema`) or the key. */
  label: string;
  /** The sub-field's value formatted via `formatOptionValue` ('' when unset). */
  value: string;
}

/**
 * Expand a hash into sub-fields for the "view more" sub-rows. Handles the three
 * hash shapes: arg_schema descriptors, serialized-YAML string, plain object.
 * [] when not expandable; entry values format via `formatOptionValue`.
 */
export const getHashEntries = (
  option?: IQorusFormField,
  schema?: TQorusFormFieldSchema
): IReadFirstHashEntry[] => {
  const value = option?.value;
  if (isOptionValueEmpty(value)) {
    return [];
  }

  let hashObject: Record<string, unknown> | undefined;
  if (typeof value === 'string') {
    const parsed = parseSerialized(value, 'hash');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      hashObject = parsed as Record<string, unknown>;
    }
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    hashObject = value as Record<string, unknown>;
  }

  if (!hashObject) {
    return [];
  }

  const argSchema = (schema as { arg_schema?: Record<string, TQorusFormFieldSchema> } | undefined)
    ?.arg_schema;

  return Object.keys(hashObject).map((key) => {
    const raw = hashObject![key];
    const subSchema = argSchema?.[key];
    // A schema-declared (`arg_schema`) hash stores each entry as a
    // `{ type, value }` field descriptor — gate on the sub-schema's presence.
    // A schema-less hash *usually* stores raw values, but the server's typed
    // serialization can nest envelopes there too (e.g. a hash default_value
    // whose entries are `{ type: 'string', value: 'x' }`) — recognise those by
    // their strict shape (a string `type`, a `value`, and no foreign keys) so
    // the sub-row shows 'x' rather than counting the envelope's own keys.
    const isFieldShape =
      (!!subSchema &&
        !!raw &&
        typeof raw === 'object' &&
        !Array.isArray(raw) &&
        'value' in (raw as object)) ||
      isTypedEnvelope(raw);
    const subOption: IQorusFormField =
      isFieldShape ?
        (raw as IQorusFormField)
      : ({ type: subSchema?.type as IQorusFormField['type'], value: raw } as IQorusFormField);

    return {
      name: key,
      label: subSchema?.display_name || key,
      value: formatOptionValue(subOption, subSchema),
    };
  });
};

const titleCase = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

/**
 * Raw group key for an option: the server's `group`, else "general" for
 * required/preselected (never buried — `group` is still rolling out
 * server-side, qorus #259) and "optional" for the rest.
 */
export const getOptionGroup = (schema?: TQorusFormFieldSchema): string => {
  const group = (schema as { group?: string } | undefined)?.group;

  if (typeof group === 'string' && group.trim()) {
    return group.trim();
  }

  return (
      schema?.required ||
        (schema as { required_groups?: string[] } | undefined)?.required_groups ||
        (schema as { preselected?: boolean } | undefined)?.preselected
    ) ?
      'general'
    : 'optional';
};

/** Display label for a group key: the consumer-supplied label (FormEngine
 * `groups` prop) or the title-cased key. */
export const getOptionGroupLabel = (
  key: string,
  groups?: Record<string, { label?: string } | undefined>
): string => groups?.[key]?.label ?? titleCase(key);

/** Completion summary for the read-first progress meter. */
export interface IReadFirstCompletion {
  total: number;
  set: number;
  pct: number;
}

/** Read-first row status, shared by the status DOT (CompactRow) and the
 * status BOX bucketing (FormEngine) so the two can never disagree:
 *   invalid  — a value fails validation, or a danger message is present (red)
 *   todo     — empty & required (or has a warning message), needs a value (amber)
 *   set      — has a valid value (green)
 *   optional — empty & not required, or covered by a one-of sibling (calm) */
export type TReadFirstStatus = 'invalid' | 'todo' | 'set' | 'optional';

export const getReadFirstStatus = (s: {
  empty: boolean;
  required: boolean;
  /** Empty member of a one-of required group already satisfied by a sibling. */
  covered: boolean;
  /** Non-empty value fails validation, or a danger message is attached. */
  invalid: boolean;
  /** A warning message is attached (surfaces an empty field for attention). */
  warned: boolean;
}): TReadFirstStatus => {
  if (s.invalid) return 'invalid';
  if (!s.empty) return 'set';
  // A one-of member covered by a satisfied sibling reads as "set" (green) — the
  // requirement is met; the row just shows a "Covered by …" note.
  if (s.covered) return 'set';
  if (s.required || s.warned) return 'todo';
  return 'optional';
};

/** Coarse bucket for the three status boxes (Needs attention / Set / Optional). */
export const getReadFirstBucket = (
  status: TReadFirstStatus
): 'attention' | 'set' | 'optional' =>
  status === 'set' ? 'set'
  : status === 'optional' ? 'optional'
  : 'attention';

/** Count how many of the shown options have a value set, for the progress meter. */
export const getReadFirstCompletion = (
  shownOptions: Record<string, IQorusFormField | undefined> = {}
): IReadFirstCompletion => {
  const names = Object.keys(shownOptions);
  const total = names.length;
  const set = names.filter((name) => !isOptionValueEmpty(shownOptions[name]?.value)).length;
  const pct = total ? Math.round((set / total) * 100) : 0;

  return { total, set, pct };
};
