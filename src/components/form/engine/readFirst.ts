import { IQorusFormField, TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import yaml from 'js-yaml';
import { richtextToString } from '../../../helpers/common';

/** Summarise a list value: join item names, or fall back to an "N items" count. */
const formatList = (items: unknown[]): string => {
  const parts = items
    .map((item) =>
      item && typeof item === 'object' ? ((item as any).name ?? (item as any).value ?? '') : item
    )
    .filter((part) => part !== '' && part !== undefined && part !== null);

  return parts.length ?
      parts.join(', ')
    : `${items.length} item${items.length === 1 ? '' : 's'}`;
};

/**
 * The object/list editor stores complex values as a serialized YAML *string*
 * (`%YAML 1.2 --- [ … ]`). Parse it back so the read-first row can summarise it
 * instead of dumping raw YAML. Returns undefined when the string isn't a
 * serialized structure we should expand.
 */
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
 * Helpers for the FormEngine `compact` (read-first) mode.
 *
 * Read-first rendering shows each option as a row with its *current value*
 * (formatted for display) and only reveals the real editor when the row is
 * expanded. These pure helpers turn an option's stored value into a short,
 * human-readable summary and resolve which group an option belongs to, so the
 * rendering logic in `FormEngine` stays declarative and these rules stay unit
 * testable.
 */

/** A value is "empty" (nothing set) when it is nullish, an empty string, or an empty array. */
export const isOptionValueEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/**
 * When a schema declares `allowed_values`, the stored value is the raw value;
 * prefer the matching entry's `display_name` (falling back to `name`) so the
 * read-first row shows the friendly label the user picked, not the raw id.
 */
const getAllowedValueLabel = (
  value: unknown,
  schema?: TQorusFormFieldSchema
): string | undefined => {
  const allowed = (schema as { allowed_values?: any[] } | undefined)?.allowed_values;
  if (!allowed?.length) {
    return undefined;
  }

  const match = allowed.find(
    (allowedValue) =>
      allowedValue?.value?.value === value ||
      allowedValue?.value === value ||
      allowedValue?.name === value
  );

  if (!match) {
    return undefined;
  }

  return match.display_name || match.name || undefined;
};

/**
 * Format an option's current value as a short read-first summary.
 *
 * Returns an empty string when nothing is set (the caller renders a
 * "Not set" / "Required — not set" placeholder instead). Booleans become
 * Yes/No, `allowed_values` resolve to their display label, rich text is
 * flattened to plain text, lists join their item names, and other objects
 * collapse to a generic "Set" marker.
 */
export const formatOptionValue = (
  option?: IQorusFormField,
  schema?: TQorusFormFieldSchema
): string => {
  const value = option?.value;

  if (isOptionValueEmpty(value)) {
    return '';
  }

  if (option?.is_expression) {
    return 'Expression';
  }

  const type = (option?.type ||
    (schema as { ui_type?: string; type?: string } | undefined)?.ui_type ||
    (schema as { type?: string } | undefined)?.type) as string | undefined;

  if (type === 'bool' || type === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  const allowedLabel = getAllowedValueLabel(value, schema);
  if (allowedLabel) {
    return allowedLabel;
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
      const keys = Object.keys(parsed);
      return keys.length ? `${keys.length} field${keys.length === 1 ? '' : 's'}` : 'Set';
    }
    if (parsed !== undefined && parsed !== null && typeof parsed !== 'object') {
      return String(parsed);
    }
  }

  if (typeof value === 'object') {
    return 'Set';
  }

  return String(value);
};

const titleCase = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

/**
 * Resolve the *raw* group key an option belongs to — the server's `group` string
 * (e.g. "info" / "scaling"), used to cluster rows. When a field has no `group`
 * yet (the server is still rolling `group` out to every field — qorus #259),
 * required / preselected fields fall back to "general" so they are never buried,
 * and everything else to "optional".
 *
 * Use `getOptionGroupLabel` to turn the key into a display label.
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

/**
 * Human-readable label for a group key. Prefers a consumer-supplied label (via
 * the FormEngine `groups` prop — the server does not define group display
 * metadata), otherwise title-cases the raw key ("info" -> "Info").
 */
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
