import { describe, expect, it } from 'vitest';
import { getOptionFieldStorageType } from '../src/components/form/engine/FormEngine';

/**
 * Which type an option resolves to. Every option field is rendered with this,
 * and it is what an expression's return type is checked against — so when it
 * is wrong the form refuses values the field actually accepts.
 *
 * Reported live: `1 + 2` on a test assertion's Value, a field the server
 * declares `"type": "auto"`, came back "This does not fit. The expression
 * returns int, and this field holds hash." A literal `1` was fine, which is
 * the tell — a literal is stored as a plain value whose type matches, while an
 * expression is stored as `{ is_expression: true, value: {...} }` and the type
 * recorded beside it describes that ENVELOPE.
 */
const AUTO_SCHEMA = {
  checked_value: { type: 'auto', display_name: 'Value', supports_expressions: true },
} as never;

describe('the type an option resolves to', () => {
  it('ignores a type stored beside an expression and uses the schema', () => {
    expect(
      getOptionFieldStorageType(
        'checked_value',
        'hash' as never,
        AUTO_SCHEMA,
        undefined,
        undefined,
        undefined,
        true
      )
    ).toBe('auto');
  });

  it('still trusts a stored type when the value is NOT an expression', () => {
    // The stored type is how an `auto` field remembers what the author chose,
    // so the guard has to stay narrow: only an expression envelope is
    // discounted. This one passes either way on purpose — its job is to fail
    // if the guard ever grows.
    expect(
      getOptionFieldStorageType(
        'checked_value',
        'hash' as never,
        AUTO_SCHEMA,
        undefined,
        undefined,
        undefined,
        false
      )
    ).toBe('hash');
  });

  it('keeps a concrete declared type for an expression', () => {
    // Only `auto`/`any` accept anything. A field declared `string` still has a
    // return type worth checking, and the schema is where that comes from.
    const stringSchema = {
      name: { type: 'string', display_name: 'Name', supports_expressions: true },
    } as never;

    expect(
      getOptionFieldStorageType(
        'name',
        'hash' as never,
        stringSchema,
        undefined,
        undefined,
        undefined,
        true
      )
    ).toBe('string');
  });
});
