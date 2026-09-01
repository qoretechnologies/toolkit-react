import { describe, expect, it } from 'vitest';
import { getHashEntries } from '../src/components/form/engine/readFirst';

/**
 * A hash whose sub-fields are `preselected` but unset must not summarise as content.
 *
 * The reported case: a test's Runtime Defaults collapsed to
 *   TIMEOUT (SECONDS)  1 field
 *   FIXTURE            1 field
 *   INITIAL INPUT      1 field
 * with a green "set" dot, while opening it said `0/3 set · 0%` and every field
 * showed "—". Three fields claimed to hold something; none did.
 *
 * Why: opening the sub-form materialises each preselected sub-field, and
 * `fixOptions` writes the envelope WITHOUT a `value` key when the value is
 * undefined — `{type: 'integer'}`. `getHashEntries` recognised an envelope by
 * `'value' in raw`, which is false for exactly that shape, so it treated the
 * envelope as the value itself and counted its own `type` key: "1 field".
 *
 * That fix made the value read empty. The rule went further afterwards: an
 * unset sub-field is not listed in a read view AT ALL, because `preselected`
 * says the FORM should show the field, not that the object has a value for it.
 * See `unsetHashReadsUnset.test.ts` — this file keeps the original defect
 * pinned from the other side: whatever else changes, no unset sub-field may
 * ever summarise as "1 field".
 */
const SCHEMA = {
  type: 'hash',
  arg_schema: {
    timeout_s: { type: 'integer', display_name: 'Timeout (Seconds)' },
    fixture: { type: 'string', display_name: 'Fixture' },
    input: { type: 'hash', display_name: 'Initial Input' },
  },
} as never;

describe('a materialised but unset hash sub-field', () => {
  it('summarises as unset, not as "1 field"', () => {
    const entries = getHashEntries(
      { type: 'hash', value: { timeout_s: { type: 'integer' }, fixture: { type: 'string' } } } as never,
      SCHEMA
    );
    // Not listed at all now — and, the point of this test, never "1 field".
    expect(entries).toEqual([]);
    expect(entries.map((e) => e.value)).not.toContain('1 field');
  });

  it('lists only the sub-fields that have a value', () => {
    const entries = getHashEntries(
      {
        type: 'hash',
        value: { timeout_s: { type: 'integer' }, fixture: { type: 'string', value: 'seed' } },
      } as never,
      SCHEMA
    );
    expect(entries.map((e) => [e.label, e.value])).toEqual([['Fixture', 'seed']]);
  });

  it('still summarises a sub-field that does have a value', () => {
    const entries = getHashEntries(
      { type: 'hash', value: { timeout_s: { type: 'integer', value: 60 } } } as never,
      SCHEMA
    );
    expect(entries[0].value).toBe('60');
  });

  it('still counts a genuine nested hash value', () => {
    const entries = getHashEntries(
      { type: 'hash', value: { input: { type: 'hash', value: { a: 1, b: 2 } } } } as never,
      SCHEMA
    );
    expect(entries[0].value).toBe('2 fields');
  });
});
