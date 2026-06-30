/**
 * Shared row model for the FormEngine compact VARIANTS playground.
 *
 * This is a prototyping harness: every variant renders the SAME normalized rows
 * (derived from a real options schema + values via the real `readFirst`
 * formatters) and differs only in layout / chrome / UX. That keeps the
 * comparison about presentation, not data. Editing is intentionally stubbed
 * (expand shows a placeholder) — the point is to compare the read-first view
 * that currently feels crowded, then graft the winner onto the real engine.
 */
import { IQorusFormField, IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import {
  colorToCss,
  formatBytes,
  formatOptionValue,
  getFileSize,
  getOptionGroup,
  getOptionGroupLabel,
  getValueType,
  isOptionValueEmpty,
} from '../readFirst';
import { isValueTemplate } from '../../../../helpers/templates';

export type TVariantStatus =
  | 'set' // has a valid value
  | 'unset' // empty, not required — calm, no alarm
  | 'todo' // required (or required-group) but unset — gentle amber
  | 'invalid'; // user-entered value fails validation — red (only when surfaced)

export type TVariantValueKind =
  | 'text'
  | 'number'
  | 'bool'
  | 'color'
  | 'file'
  | 'template'
  | 'richtext'
  | 'hash'
  | 'empty';

export interface IVariantValue {
  kind: TVariantValueKind;
  /** Human-readable summary (already formatted by readFirst). */
  display: string;
  /** color: css color; file: size label; hash: field count; template: label */
  extra?: string;
}

export interface IVariantRow {
  name: string;
  label: string;
  shortDesc?: string;
  longDesc?: string;
  required: boolean;
  readOnly: boolean;
  status: TVariantStatus;
  /** Short reason for todo/invalid, e.g. "Text value is empty". */
  reason?: string;
  value: IVariantValue;
  typeLabel: string;
  /** required_groups this field belongs to (one-of constraints). */
  requiredGroups: string[];
  /** True when this field is a member of an unsatisfied one-of group. */
  inUnmetGroup: boolean;
  /** Raw schema + value object — passed to AutoFormField for REAL editing. */
  schema: any;
  field: any;
}

export interface IVariantGroup {
  name: string;
  label: string;
  rows: IVariantRow[];
}

/** One-of required group: members + whether any is filled. */
export interface IRequiredGroupInfo {
  key: string;
  members: string[];
  memberLabels: string[];
  satisfied: boolean;
}

export interface IVariantConfig {
  groupLabels?: Record<string, string>;
  /** name → reason; in the engine this comes from the validity pass. */
  invalidReasons?: Record<string, string>;
}

// Default (basic-fixture) invalid set — overridable via config.
const DEFAULT_INVALID: Record<string, string> = {
  optionWithInvalidValue: 'Text value is empty',
  schemaOption: 'Hash arguments are invalid',
};

function buildValue(field: IQorusFormField | undefined, schema: any): IVariantValue {
  if (!field || isOptionValueEmpty(field.value)) return { kind: 'empty', display: '' };

  const valueType = getValueType(field, schema);
  const formatted = formatOptionValue(field, schema);

  if (valueType === 'rgbcolor') {
    return { kind: 'color', display: formatted, extra: colorToCss(field.value) };
  }
  if (valueType === 'file') {
    const size = getFileSize(field.value);
    return {
      kind: 'file',
      display: formatted,
      extra: size !== undefined ? formatBytes(size) : undefined,
    };
  }
  if (valueType === 'bool' || valueType === 'boolean') {
    return { kind: 'bool', display: formatted };
  }
  if (valueType === 'hash' || valueType === 'free-hash') {
    return { kind: 'hash', display: formatted };
  }
  if (typeof field.value === 'string' && isValueTemplate(field.value)) {
    // The real chip resolves the template's display name from the templates
    // list; the prototype shows a friendly label of the key.
    const label =
      field.value.replace(/^\$[a-z]+:/i, '').replace(/[-_]/g, ' ') || field.value;
    return { kind: 'template', display: label.replace(/\b\w/g, (c) => c.toUpperCase()), extra: 'local' };
  }
  if (valueType === 'richtext' && Array.isArray(field.value)) {
    return { kind: 'richtext', display: formatted };
  }
  return { kind: 'text', display: formatted };
}

export function buildVariantGroups(
  options: IQorusFormSchema,
  values: Record<string, IQorusFormField>,
  config: IVariantConfig = {}
): { groups: IVariantGroup[]; requiredGroups: Record<string, IRequiredGroupInfo> } {
  const invalidReasons = config.invalidReasons ?? DEFAULT_INVALID;
  const groupMap = new Map<string, IVariantGroup>();

  // Pass 1: collect one-of required-group membership + satisfaction.
  const reqGroups: Record<string, IRequiredGroupInfo> = {};
  Object.entries(options).forEach(([name, schema]: [string, any]) => {
    (schema?.required_groups || []).forEach((key: string) => {
      if (!reqGroups[key]) reqGroups[key] = { key, members: [], memberLabels: [], satisfied: false };
      reqGroups[key].members.push(name);
      reqGroups[key].memberLabels.push((schema?.display_name as string) || name);
      if (!isOptionValueEmpty(values[name]?.value)) reqGroups[key].satisfied = true;
    });
  });

  Object.entries(options).forEach(([name, schema]: [string, any]) => {
    const field = values[name];
    const empty = isOptionValueEmpty(field?.value);
    const ownGroups: string[] = schema?.required_groups || [];
    // Member of a one-of group that nobody has satisfied yet.
    const inUnmetGroup = ownGroups.some((k) => reqGroups[k] && !reqGroups[k].satisfied);
    const required = !!schema?.required;

    let status: TVariantStatus;
    let reason: string | undefined;
    if (invalidReasons[name]) {
      status = 'invalid';
      reason = invalidReasons[name];
    } else if (empty && required) {
      status = 'todo';
      reason = 'Needs a value';
    } else if (empty && inUnmetGroup) {
      status = 'todo';
      reason = `One of ${reqGroups[ownGroups[0]].memberLabels.join(' / ')}`;
    } else if (empty) {
      status = 'unset';
    } else {
      status = 'set';
    }

    const groupName = getOptionGroup(schema);
    const groupLabel = config.groupLabels?.[groupName] ?? getOptionGroupLabel(groupName, undefined);
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, { name: groupName, label: groupLabel, rows: [] });
    }
    groupMap.get(groupName)!.rows.push({
      name,
      label: (schema?.display_name as string) || name,
      shortDesc: schema?.short_desc,
      longDesc: schema?.desc,
      required: required || ownGroups.length > 0,
      readOnly: !!schema?.readonly,
      status,
      reason,
      value: buildValue(field, schema),
      typeLabel: `${(schema?.ui_type as string) || (schema?.type as string) || 'auto'}`,
      requiredGroups: ownGroups,
      inUnmetGroup,
      schema,
      field,
    });
  });

  // Stable group order: 'general' first, then the rest, 'optional' last.
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const rank = (g: string) => (g === 'general' ? 0 : g === 'optional' ? 2 : 1);
    return rank(a.name) - rank(b.name);
  });
  return { groups, requiredGroups: reqGroups };
}

export function summarize(groups: IVariantGroup[]) {
  const rows = groups.flatMap((g) => g.rows);
  const total = rows.length;
  const set = rows.filter((r) => r.status === 'set').length;
  const todo = rows.filter((r) => r.status === 'todo').length;
  const invalid = rows.filter((r) => r.status === 'invalid').length;
  const attention = todo + invalid;
  const pct = total ? Math.round((set / total) * 100) : 0;
  return { total, set, todo, invalid, attention, pct };
}
