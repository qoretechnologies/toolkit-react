import { describe, expect, it } from 'vitest';

import { renderExpressionToText } from '../src/components/form/expressions/renderExpressionToText';
import { validateFieldWithResult } from '../src/helpers/validations';

/**
 * `null` is a value an author can write, and the form has to agree.
 *
 * DPQL has a null literal — `null` parses, serializes and round-trips like any
 * other — and typing it into the text editor produces the literal expression
 * `{exp: "value", args: [null]}`. Validation treated that argument as a
 * MISSING one, so the visual view called the expression invalid and refused to
 * render a summary, and a raw null argument crashed the validator outright on
 * `argValue.type`.
 *
 * Reported from the live IDE by an author who had no other way to say "this
 * method returns no value". The distinction that fixes it is between an
 * argument that is explicitly null and one that is simply not there.
 */
const VALUE_EXPRESSION: any = {
  // as the live instance serves it: one required `any` argument, and `name`
  // rather than `display_name`
  type: 1,
  subtype: 1,
  name: 'value',
  display_name: 'Value',
  symbol: '',
  args: [{ signature_type_code: 'any', name: 'any', ui_type: 'any', required: true }],
  return_type: 'auto',
  varargs: false,
};

const validate = (args: any[]) =>
  validateFieldWithResult(
    'expression',
    { is_expression: true, value: { exp: 'value', args } },
    { expressions: [VALUE_EXPRESSION] } as any
  );

describe('an explicit null is a value', () => {
  it('accepts it as a raw argument, an envelope, and a typed envelope', () => {
    // all three shapes reach validation from somewhere: the server's parse
    // result, a form edit, and a stored value
    expect(validate([null]).isValid).toBe(true);
    expect(validate([{ value: null }]).isValid).toBe(true);
    expect(validate([{ type: 'any', value: null }]).isValid).toBe(true);
  });

  it('does not crash on a raw null argument', () => {
    // it threw "Cannot read properties of null (reading 'type')"
    expect(() => validate([null])).not.toThrow();
  });

  it('still rejects an argument that is genuinely absent', () => {
    // the distinction the author is making when they write `null`: this one
    // was never given a value, and must not be quietly accepted with it
    const missing = validate([{ type: 'any' }]);
    expect(missing.isValid).toBe(false);
    expect(missing.reason).toContain('argument 1');
  });

  it('names the argument the catalogue actually declares', () => {
    // the served catalogue carries `name`, not `display_name`, so every one of
    // these messages read 'argument 1 ("undefined")'
    const bare: any = { ...VALUE_EXPRESSION, args: [{ name: 'any', required: true }] };
    const out = validateFieldWithResult(
      'expression',
      { is_expression: true, value: { exp: 'value', args: [{ type: 'any' }] } },
      { expressions: [bare] } as any
    );
    expect(out.isValid).toBe(false);
    expect(out.reason).not.toContain('undefined');
    expect(out.reason).toContain('any');
  });

  it('leaves a populated literal alone', () => {
    expect(validate([{ type: 'int', value: 42 }]).isValid).toBe(true);
  });
});

/**
 * And the offline renderer prints the literal, not the wrapper it arrives in.
 *
 * Every case here is asserted against the Qore module's own
 * `valueLiteralRenderingTests` in `examples/test/qlib/DataProvider/Dpql.qtest`
 * — the server renders these ASTs too, and a summary that disagrees with the
 * preview sitting beside it is worse than either being wrong alone.
 */
describe('a literal expression renders as its literal', () => {
  const literal = (arg: any) => renderExpressionToText({ exp: 'value', args: [arg] } as any);

  it('prints a null both ways it can arrive', () => {
    expect(literal(null)).toBe('null');
    expect(literal({ value: null })).toBe('null');
  });

  it('prints ordinary literals without naming the wrapper', () => {
    // it printed `value(42)`, or `(42)` with a catalogue supplying the empty symbol
    expect(literal({ value: 42 })).toBe('42');
    expect(literal({ value: 'x' })).toBe('"x"');
    expect(literal({ value: false })).toBe('false');
  });

  it('leaves a real expression argument to the normal path', () => {
    const nested = renderExpressionToText({
      exp: 'value',
      args: [{ is_expression: true, value: { exp: '+', args: [{ value: 1 }, { value: 2 }] } }],
    } as any);
    expect(nested).toContain('1 + 2');
  });
});
