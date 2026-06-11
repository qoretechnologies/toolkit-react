/**
 * Renders the leaf (scalar) fields of a catalogue `options` hash.
 *
 * In edit mode the shared `<Options>` field does the work — the catalogue
 * leaves are adapted to an `IOptionsSchema` and the value is wrapped /
 * flattened around it. In read-only mode the same fields render as a
 * typeset `ReqoreDescriptionList` (a designed viewer, never disabled
 * inputs).
 *
 * When `nameField` is supplied (a map entry's key) it is folded into the
 * same form as the first field, so the operator edits the name and the
 * fields on one unified surface — no separate "isolated" name input.
 */
import { ReqoreDescriptionList, ReqoreP, ReqoreTag } from '@qoretechnologies/reqore';
import { IReqoreDescriptionListRow } from '@qoretechnologies/reqore/dist/components/DescriptionList';
import { IQorusAllowedValue } from '@qoretechnologies/ts-toolkit/dist/types/forms';
import { memo, useCallback, useMemo } from 'react';
import { flattenOptions, FormEngine, IOptionsSchema } from '../../engine/FormEngine';
import {
  catalogLeafToFieldSchema,
  hashToOptionsValue,
  isCatalogLeaf,
  leavesToOptionsSchema,
  unwrapListValues,
} from './catalog';
import { formatValue } from './helpers';
import { useSuggestionResolver } from './referenceSuggestions';
import { ICatalogOptions } from './types';

/** Synthetic schema key for the folded-in entry-name field. */
const NAME_KEY = '__entry_name__';

/** Wraps a plain string list as `<Options>`-compatible allowed values. */
const stringsToAllowedValues = (strs: string[]): IQorusAllowedValue[] =>
  strs.map((s) => ({
    display_name: s,
    value: { type: 'string', value: s },
  }));

export interface ICatalogLeafFormNameField {
  /** The entry's current name (the map key). */
  value: string;
  /** Field label — e.g. "Name". */
  label: string;
  /** Commits a rename of the map key. */
  onRename: (next: string) => void;
}

export interface ICatalogLeafFormProps {
  /** The full catalogue `options` hash — non-leaf nodes are ignored. */
  leaves: ICatalogOptions;
  /** The hash value being edited; may carry non-leaf keys too. */
  value: Record<string, unknown>;
  /** Called with the full updated hash (non-leaf keys preserved). */
  onChange: (value: Record<string, unknown>) => void;
  readOnly?: boolean;
  /** Stable name for the `<Options>` field. */
  name: string;
  /**
   * When set, a "Name" field is folded into the form as the first
   * field — editing it renames the entry's map key.
   */
  nameField?: ICatalogLeafFormNameField;
}

/** Renders one leaf value for the read-only viewer. */
const renderReadOnlyValue = (
  leaf: ICatalogOptions[string],
  raw: unknown
): React.ReactNode => {
  if (!isCatalogLeaf(leaf)) return null;
  if (typeof raw === 'boolean') {
    return (
      <ReqoreTag
        fixed
        size='small'
        minimal
        asBadge
        intent={raw ? 'success' : 'muted'}
        label={raw ? 'yes' : 'no'}
      />
    );
  }
  if (leaf.allowed_values && typeof raw === 'string') {
    const match = leaf.allowed_values.find((av) => av.value === raw);
    return (
      <ReqoreTag fixed size='small' minimal label={match?.display_name ?? raw} />
    );
  }
  return <ReqoreP size='small'>{formatValue(raw)}</ReqoreP>;
};

export const CatalogLeafForm = memo(
  ({ leaves, value, onChange, readOnly, name, nameField }: ICatalogLeafFormProps) => {
    /** Contextual suggestions for reference leaves (e.g. PK / FK columns). */
    const suggestionResolver = useSuggestionResolver();

    /** The catalogue leaf schema, without the synthetic name field. */
    const leafSchema = useMemo(() => leavesToOptionsSchema(leaves), [leaves]);

    /**
     * The full form schema — name field folded in first when present,
     * and any leaf the suggestion resolver knows about enriched with
     * contextual `allowed_values` / `element_allowed_values` plus the
     * `_creatable: true` flag (so the picker offers schema-derived
     * values *and* still accepts a typed-in custom name for case-2
     * external references).
     */
    const schema = useMemo<IOptionsSchema>(() => {
      const base: IOptionsSchema = nameField
        ? {
            [NAME_KEY]: catalogLeafToFieldSchema({
              display_name: nameField.label,
              short_desc: 'Unique name within the schema',
              desc: 'The unique name identifying this entry.',
              type: 'string',
              required: true,
            }),
            ...leafSchema,
          }
        : { ...leafSchema };
      if (!suggestionResolver) return base;
      const enhanced: IOptionsSchema = {};
      Object.entries(base).forEach(([key, field]) => {
        if (key === NAME_KEY) {
          enhanced[key] = field;
          return;
        }
        const suggestions = suggestionResolver(key, value);
        if (!suggestions || suggestions.length === 0) {
          enhanced[key] = field;
          return;
        }
        const allowed = stringsToAllowedValues(suggestions);
        if ((field as { type?: string }).type === 'list') {
          enhanced[key] = {
            ...field,
            element_allowed_values: allowed,
            element_allowed_values_creatable: true,
          } as IOptionsSchema[string];
        } else {
          enhanced[key] = {
            ...field,
            allowed_values: allowed,
            allowed_values_creatable: true,
          } as IOptionsSchema[string];
        }
      });
      return enhanced;
    }, [leafSchema, nameField, suggestionResolver, value]);

    const optionsValue = useMemo(() => {
      const wrapped = hashToOptionsValue(value, leafSchema);
      if (!nameField) return wrapped;
      return {
        [NAME_KEY]: { type: 'string' as const, value: nameField.value },
        ...wrapped,
      };
    }, [value, leafSchema, nameField]);

    const handleChange = useCallback(
      (_name: string, next: Parameters<typeof flattenOptions>[0]) => {
        const flat = flattenOptions(next);
        const nextName = flat[NAME_KEY];
        delete flat[NAME_KEY];
        // `<Options>` list fields emit `[{value, type}]`; unwrap back
        // to the bare array the DataSchema definition stores.
        unwrapListValues(flat, leafSchema);

        // A single form change touches one field. When that field is
        // the folded-in name, rename the key; otherwise update the
        // entry's leaf values.
        if (
          nameField &&
          typeof nextName === 'string' &&
          nextName !== nameField.value
        ) {
          nameField.onRename(nextName);
          return;
        }

        const stripped = { ...value };
        Object.keys(leafSchema).forEach((key) => delete stripped[key]);
        onChange({ ...stripped, ...flat });
      },
      [value, leafSchema, onChange, nameField]
    );

    if (Object.keys(schema).length === 0) {
      return null;
    }

    if (readOnly) {
      const rows: IReqoreDescriptionListRow[] = [];
      if (nameField) {
        rows.push({
          key: NAME_KEY,
          label: nameField.label,
          intent: 'info',
          content: <ReqoreP size='small'>{nameField.value}</ReqoreP>,
        });
      }
      Object.entries(leaves)
        .filter(
          ([key, leaf]) => isCatalogLeaf(leaf) && value?.[key] !== undefined
        )
        .forEach(([key, leaf]) => {
          rows.push({
            key,
            label: isCatalogLeaf(leaf) ? leaf.display_name : key,
            intent: isCatalogLeaf(leaf) && leaf.required ? 'info' : undefined,
            content: renderReadOnlyValue(leaf, value?.[key]),
          });
        });
      if (rows.length === 0) {
        return (
          <ReqoreP size='small' effect={{ opacity: 0.55 }}>
            No values set.
          </ReqoreP>
        );
      }
      return <ReqoreDescriptionList transparent flat padded={false} items={rows} />;
    }

    return (
      <FormEngine
        name={name}
        flat
        transparent
        compact
        padded={false}
        showTypeToggle={false}
        wrapperPadding='none'
        value={optionsValue}
        options={schema}
        onChange={handleChange}
        minColumnWidth='300px'
        size='small'
      />
    );
  }
);
