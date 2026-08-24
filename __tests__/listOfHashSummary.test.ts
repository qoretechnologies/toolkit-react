import { describe, expect, it } from 'vitest';
import {
  findAllowedValueOption,
  formatOptionValue,
} from '../src/components/form/engine/readFirst';

/**
 * A list-of-hash row reads back in the words the form asked for the value.
 *
 * The reported case, on an auth profile's Authentication Schemes: the row
 * summarised as "2 items" and the preview under it printed `type: default` —
 * a key the form calls "Scheme Type" and a value the author picked from a list
 * where it is called "Default RBAC". Both are the stored form, and neither is a
 * string the author has ever seen, so the row appeared to show a value nobody
 * chose.
 *
 * Both halves resolve through the SAME `arg_schema` the sub-form was built
 * from, so the row and the editor cannot describe one value two ways.
 */

/** The auth-profile scheme sub-schema, trimmed to what these tests exercise. */
const SCHEME_SCHEMA = {
  type: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Scheme Type',
    required: true,
    allowed_values: [
      { value: 'default', display_name: 'Default RBAC' },
      { value: 'cookie', display_name: 'Cookie' },
    ],
  },
  cookie_name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Session Cookie Name',
  },
} as never;

const listField = (items: unknown[]) => ({ type: 'list', value: items }) as never;

/** The server's envelope form: every value wrapped in `{type, value}`. */
const envelopedScheme = (fields: Record<string, unknown>) => ({
  type: 'hash',
  value: Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, { type: 'string', value }])
  ),
});

describe('the collapsed summary names the items', () => {
  const schema = { type: 'list', element_type: 'hash', arg_schema: SCHEME_SCHEMA } as never;

  it('labels each item through the sub-schema instead of counting them', () => {
    expect(
      formatOptionValue(
        listField([
          envelopedScheme({ type: 'default' }),
          envelopedScheme({ type: 'cookie', cookie_name: 'qorus-session' }),
        ]),
        schema
      )
    ).toBe('Default RBAC, Cookie');
  });

  it('reads a plain (un-enveloped) item the same way', () => {
    expect(formatOptionValue(listField([{ type: 'cookie' }]), schema)).toBe('Cookie');
  });

  it('uses the first DECLARED field, not the first one stored', () => {
    // Insertion order is an accident of how the value was built — two equal
    // items must not summarise differently because their keys were written in a
    // different order. `cookie_name` is stored first here and `type` second.
    expect(
      formatOptionValue(listField([{ cookie_name: 'qorus-session', type: 'cookie' }]), schema)
    ).toBe('Cookie');
  });

  it('falls back to the next declared field when the first is not set', () => {
    expect(formatOptionValue(listField([{ cookie_name: 'qorus-session' }]), schema)).toBe(
      'qorus-session'
    );
  });

  it('still counts items it cannot name, rather than printing their shape', () => {
    // No arg_schema and no self-naming key: there is nothing better to say than
    // how many. The regression this guards is "[object Object]".
    const summary = formatOptionValue(listField([{ foo: 1 }, { foo: 2 }]), {
      type: 'list',
      element_type: 'hash',
    } as never);
    expect(summary).toBe('2 items');
    expect(summary).not.toContain('object Object');
  });

  it('keeps naming items by their own `name` key when they have one', () => {
    // The pre-existing path — a schema-less list of named hashes — must not
    // change: the sub-schema lookup is a FALLBACK, reached only when the item
    // names nothing itself.
    expect(
      formatOptionValue(listField([{ name: 'init' }, { name: 'run' }]), {
        type: 'list',
        element_type: 'hash',
      } as never)
    ).toBe('init, run');
  });
});

/**
 * The engine drops a value that is not one of a field's declared choices. What
 * counts as "declared" has to be the SAME question the row answers when it puts
 * a display name on that value — and it was not.
 *
 * An `allowed_values` entry is written three ways: an envelope, a bare value, or
 * a named entry. The labelling path accepted all three; the clearing guard
 * accepted the envelope and the name but NOT the bare value, so a schema written
 * the bare way had its value erased on load — while the collapsed row went on
 * showing the display name for the value that had just been thrown away. The row
 * read "Default RBAC" closed and "—" open, and the value never reached the
 * submitted data. Silent data loss, reported as a display bug.
 */
describe('one predicate decides whether a value is an allowed value', () => {
  const cases = [
    ['a bare value', { value: 'default', display_name: 'Default RBAC' }],
    ['an envelope', { value: { type: 'string', value: 'default' }, display_name: 'Default RBAC' }],
    ['a named entry', { name: 'default', display_name: 'Default RBAC' }],
  ] as const;

  for (const [shape, entry] of cases) {
    it(`recognises ${shape}`, () => {
      expect(findAllowedValueOption('default', { allowed_values: [entry] } as never)).toBe(entry);
    });
  }

  it('still refuses a value that is not among the choices', () => {
    // The guard has to keep guarding: broadening WHICH shapes are recognised
    // must not turn it into "accept anything".
    expect(
      findAllowedValueOption('nope', {
        allowed_values: [{ value: 'default', display_name: 'Default RBAC' }],
      } as never)
    ).toBeUndefined();
  });

  it('labels every shape the same way, so the row and the editor agree', () => {
    for (const [, entry] of cases) {
      expect(
        formatOptionValue({ type: 'string', value: 'default' } as never, {
          type: 'string',
          allowed_values: [entry],
        } as never)
      ).toBe('Default RBAC');
    }
  });
});
