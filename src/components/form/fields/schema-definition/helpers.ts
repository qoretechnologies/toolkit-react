/**
 * Small pure helpers shared across the schema-definition editor —
 * immutable hash/list mutations and display formatting. No React here.
 */
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';

/** Immutably sets a key on a hash, preserving insertion order. */
export const setKey = <T>(
  hash: Record<string, T> | undefined,
  key: string,
  value: T
): Record<string, T> => ({ ...(hash ?? {}), [key]: value });

/** Immutably removes a key from a hash. */
export const removeKey = <T>(
  hash: Record<string, T> | undefined,
  key: string
): Record<string, T> => {
  const next = { ...(hash ?? {}) };
  delete next[key];
  return next;
};

/**
 * Immutably renames a hash key while preserving the position of every
 * entry — important so a rename doesn't reorder a table's column list.
 */
export const renameKey = <T>(
  hash: Record<string, T> | undefined,
  oldKey: string,
  newKey: string
): Record<string, T> => {
  if (!hash || oldKey === newKey) return { ...(hash ?? {}) };
  const next: Record<string, T> = {};
  Object.entries(hash).forEach(([k, v]) => {
    next[k === oldKey ? newKey : k] = v;
  });
  return next;
};

/** Immutably moves a list element from `from` to `to`. */
export const moveItem = <T>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.min(to, next.length), 0, item);
  return next;
};

/**
 * Picks a unique key for a new map entry — `base`, then `base_2`,
 * `base_3`, … — so "Add" never silently overwrites an existing entry.
 */
export const uniqueKey = (
  hash: Record<string, unknown> | undefined,
  base: string
): string => {
  if (!hash || hash[base] === undefined) return base;
  let n = 2;
  while (hash[`${base}_${n}`] !== undefined) n += 1;
  return `${base}_${n}`;
};

/** Tab / section icon for a definition section key. */
export const SECTION_ICONS: Record<string, IReqoreIconName> = {
  schema: 'InformationLine',
  tables: 'Table2',
  sequences: 'SortNumberAsc',
  reference_data: 'SeedlingLine',
  reference: 'SeedlingLine',
  migrations: 'GitBranchLine',
  advanced: 'Settings3Line',
  columns: 'LayoutColumnLine',
  indexes: 'SearchLine',
  constraints: 'LinksLine',
  auto_triggers: 'FlashlightLine',
  triggers: 'FlashlightLine',
  primary_key: 'Key2Line',
  unique_constraints: 'Fingerprint2Line',
  foreign_constraints: 'LinksLine',
  pre_align: 'ArrowGoBackLine',
  post_align: 'ArrowGoForwardLine',
  reference_rows: 'SeedlingLine',
};

/** Formats an arbitrary definition value for the read-only viewer. */
export const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  return JSON.stringify(value);
};

/** Count of entries in a hash section (0 when absent). */
export const sectionCount = (hash: unknown): number =>
  hash && typeof hash === 'object' ? Object.keys(hash).length : 0;
