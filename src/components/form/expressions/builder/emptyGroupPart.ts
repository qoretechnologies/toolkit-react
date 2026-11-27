// Copyright 2026 Qore Technologies, s.r.o.

export interface IEmptyGroupPart {
  /** The group the row is a part of: `&&` or `||`; unset for a row that is no part of a group. */
  group?: string;
  readOnly?: boolean;
  /** Whether the row names an operation. */
  hasOperation: boolean;
  /** The row's first argument's value: a value written alone, with no operation. */
  firstValue?: unknown;
}

/**
 * Whether a row is an empty part of an AND or an OR (a new one, or one whose value was cleared). Such a part fits,
 * as a part is any value, so it is not flagged; it only checks nothing yet. A part that holds a value alone is not
 * empty: `false`, `0` are values. Never in a read-only builder, where nothing can be chosen, and never for a row that
 * is no part of a group.
 */
export const isEmptyGroupPart = ({ group, readOnly, hasOperation, firstValue }: IEmptyGroupPart): boolean =>
  !!group &&
  !readOnly &&
  !hasOperation &&
  (firstValue === undefined || firstValue === null || firstValue === '');
