import { describe, expect, it } from 'vitest';
import {
  formatOptionValue,
  getHashEntries,
  isUnsetSchemaHash,
} from '../src/components/form/engine/readFirst';

/**
 * `preselected` on a sub-field is a FORM instruction — "show this so the author
 * sees it exists". It is not a statement that the object has a value.
 *
 * Opening a sub-form materialises every preselected sub-field, `fixOptions`
 * writes `{type: 'int'}` with no value, and the draft autosaves it. The stored
 * hash then permanently carries keys that stand for nothing, and the read view
 * listed them: `Runtime Defaults` showed three sub-fields with no values, a
 * green set-dot, and a place in "7/12 set" — while the sub-form it summarises
 * said 0/3 set. Nothing had ever been entered.
 *
 * The value below is off a real stored draft, unedited.
 */
const SCHEMA = {
  type: 'hash',
  ui_type: 'hash',
  arg_schema: {
    timeout_s: { type: 'int', display_name: 'Timeout (Seconds)', preselected: true },
    fixture: { type: 'string', display_name: 'Fixture', preselected: true },
    input: { type: 'hash', display_name: 'Initial Input', preselected: true },
  },
} as never;

const ALL_UNSET = {
  timeout_s: { type: 'int' },
  fixture: { type: 'string' },
  input: { type: 'hash' },
};

const ONE_SET = { ...ALL_UNSET, timeout_s: { type: 'int', value: 30 } };

describe('a hash whose fields were materialised but never filled in', () => {
  it('is recognised as holding nothing', () => {
    expect(isUnsetSchemaHash(ALL_UNSET, SCHEMA)).toBe(true);
    expect(isUnsetSchemaHash({ type: 'hash', value: ALL_UNSET }, SCHEMA)).toBe(true);
  });

  it('shows no value line, so the row reads unset', () => {
    expect(formatOptionValue({ type: 'hash', value: ALL_UNSET } as never, SCHEMA)).toBe('');
  });

  it('lists no sub-rows — a read view shows what IS set', () => {
    expect(getHashEntries({ type: 'hash', value: ALL_UNSET } as never, SCHEMA)).toEqual([]);
  });

  it('still lists the one field that IS set, and only that one', () => {
    const entries = getHashEntries({ type: 'hash', value: ONE_SET } as never, SCHEMA);
    expect(entries.map((e) => e.label)).toEqual(['Timeout (Seconds)']);
    expect(entries[0].value).toBe('30');
    expect(isUnsetSchemaHash(ONE_SET, SCHEMA)).toBe(false);
  });

  it('leaves an undescribed hash alone', () => {
    // Without a sub-schema saying these keys are fields, `{type: 'x'}` could be
    // somebody's data — so nothing is assumed about it.
    expect(isUnsetSchemaHash(ALL_UNSET, { type: 'hash' } as never)).toBe(false);
    expect(isUnsetSchemaHash({ a: 1 }, SCHEMA)).toBe(false);
  });
});
