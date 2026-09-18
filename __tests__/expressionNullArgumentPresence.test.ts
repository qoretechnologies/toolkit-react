import { describe, expect, it } from 'vitest';
import {
  addMissingExpressionArgs,
  asExpressionArgumentEnvelope,
  isExpressionArgumentMissing,
  shouldMarkAsExpression,
} from '../src/components/form/expressions/argumentPresence';

/**
 * Reported from a saved draft: an assertion's Expected Value, written in the
 * TEXT editor as `null`, came back after a reload as
 *
 *   {"type": "any", "required": true}
 *
 * — an argument DEFINITION where the value belongs. `required` is a schema key
 * and never appears on a value, which is what gives the substitution away.
 *
 * The chain: `dpql/parse('null')` answers `{exp: 'value', args: [null]}`; the
 * builder asked `size(arg) === 0` to decide whether an argument was supplied,
 * and lodash answers `0` for `null`; so the explicit null was treated as a
 * missing argument and reset from the catalogue's declaration.
 *
 * See `expressionNullLiteral.test.ts` for the validator and renderer halves of
 * the same rule, fixed earlier.
 */
describe('whether an expression argument is supplied', () => {
  it('treats an explicit null as SUPPLIED — it is the null literal', () => {
    expect(isExpressionArgumentMissing(null)).toBe(false);
  });

  it('still treats undefined and an empty reset as missing', () => {
    expect(isExpressionArgumentMissing(undefined)).toBe(true);
    // `{}` is what the builder writes when a type change resets an argument
    expect(isExpressionArgumentMissing({})).toBe(true);
  });

  it('treats the other falsy literals as supplied', () => {
    // the same class of bug as the `auto` validator's truthiness gate
    expect(isExpressionArgumentMissing(0)).toBe(false);
    expect(isExpressionArgumentMissing(false)).toBe(false);
    expect(isExpressionArgumentMissing('')).toBe(false);
  });

  it('treats a populated envelope as supplied', () => {
    expect(isExpressionArgumentMissing({ type: 'int', value: 3 })).toBe(false);
    // an envelope holding an explicit null is supplied too
    expect(isExpressionArgumentMissing({ type: 'any', value: null })).toBe(false);
  });
});

describe('widening a raw parsed argument into the stored shape', () => {
  it('keeps an explicit null as a VALUE rather than dropping it', () => {
    expect(asExpressionArgumentEnvelope(null, 'any')).toEqual({ value: null, type: 'any' });
  });

  it('widens other raw literals the same way', () => {
    expect(asExpressionArgumentEnvelope(3, 'int')).toEqual({ value: 3, type: 'int' });
    expect(asExpressionArgumentEnvelope(false, 'bool')).toEqual({ value: false, type: 'bool' });
  });

  it('leaves an argument that is already an envelope alone', () => {
    const envelope = { type: 'int', value: 3 };
    expect(asExpressionArgumentEnvelope(envelope, 'int')).toBe(envelope);
  });

  it('leaves a missing argument missing', () => {
    expect(asExpressionArgumentEnvelope(undefined, 'any')).toBeUndefined();
  });

  it('omits the type when the catalogue declares none', () => {
    expect(asExpressionArgumentEnvelope(null)).toEqual({ value: null });
  });
});

/**
 * The `is_expression` flag describes the VALUE, so a change that says nothing
 * about it must not throw it away.
 *
 * Reported alongside the null-argument defect: clicking into an assertion's
 * Expected Value and reverting left the raw AST on the row, drawn as a
 * two-field hash of `exp` and `args`. The engine deleted the flag on every
 * change that did not re-assert it, and an editor mounting or a revert is
 * exactly such a change — the value stayed an expression while the label
 * saying so was removed.
 */
describe('whether an option is still marked as holding an expression', () => {
  const AST = { exp: 'value', args: [{ type: 'any', value: null }] };

  it('keeps the mark through a change that expressed no opinion', () => {
    expect(shouldMarkAsExpression(undefined, AST, true)).toBe(true);
  });

  it('sets the mark when the caller says so', () => {
    expect(shouldMarkAsExpression(true, AST, false)).toBe(true);
  });

  it('clears it when the caller deliberately says so', () => {
    // choosing a concrete type from the menu passes `false`
    expect(shouldMarkAsExpression(false, AST, true)).toBe(false);
  });

  it('clears it once the value stops being an expression', () => {
    expect(shouldMarkAsExpression(undefined, 'plain text', true)).toBe(false);
    expect(shouldMarkAsExpression(undefined, { a: 1 }, true)).toBe(false);
    expect(shouldMarkAsExpression(undefined, undefined, true)).toBe(false);
  });

  it('does not invent the mark for a value that was never one', () => {
    expect(shouldMarkAsExpression(undefined, AST, false)).toBe(false);
  });
});

/**
 * The function the builder actually calls, on the AST the server actually
 * returns. The helpers above prove the RULE; this proves the builder asks it.
 */
describe('addMissingExpressionArgs, on the parse of `null`', () => {
  /** The `value` expression as the live instance serves it. */
  const VALUE_EXPRESSION: any = {
    name: 'value',
    display_name: 'Value',
    symbol: '',
    args: [{ signature_type_code: 'any', name: 'any', ui_type: 'any', required: true }],
    return_type: 'auto',
    varargs: false,
  };
  const CATALOGUE = [VALUE_EXPRESSION];

  it('keeps the author’s null instead of refilling from the catalogue', () => {
    // `dpql/parse('null')` answers exactly this.
    const args = addMissingExpressionArgs(CATALOGUE, 'value', [null]);

    // The reported corruption: the catalogue's DECLARATION where a value belongs.
    expect(args[0]).not.toEqual({ type: 'any', required: true });
    expect('required' in (args[0] ?? {})).toBe(false);
    // the null, widened into the envelope the editors read
    expect(args[0]).toEqual({ value: null, type: 'any' });
  });

  it('still fills an argument that is genuinely absent', () => {
    expect(addMissingExpressionArgs(CATALOGUE, 'value', [])).toEqual([{ type: undefined }]);
    expect(addMissingExpressionArgs(CATALOGUE, 'value', [undefined])).toEqual([{ type: undefined }]);
    // `{}` is the reset the builder writes on a type change
    expect(addMissingExpressionArgs(CATALOGUE, 'value', [{}])).toEqual([{ type: undefined }]);
  });

  it('leaves a populated argument alone', () => {
    const supplied = { type: 'any', value: 3 };
    expect(addMissingExpressionArgs(CATALOGUE, 'value', [supplied])[0]).toBe(supplied);
  });

  it('widens the other raw literals a parse can produce', () => {
    expect(addMissingExpressionArgs(CATALOGUE, 'value', [0])[0]).toEqual({ value: 0, type: 'any' });
    expect(addMissingExpressionArgs(CATALOGUE, 'value', [false])[0]).toEqual({
      value: false,
      type: 'any',
    });
  });

  it('applies a declared default only where nothing was supplied', () => {
    const withDefault: any = {
      name: 'd',
      args: [{ ui_type: 'int', default_value: 7, required: true }],
      varargs: false,
    };
    expect(addMissingExpressionArgs([withDefault], 'd', [])[0]).toEqual({ value: 7, type: 'int' });
    // an explicit null is supplied, so the default must NOT displace it
    expect(addMissingExpressionArgs([withDefault], 'd', [null])[0]).toEqual({
      value: null,
      type: 'int',
    });
  });
});
