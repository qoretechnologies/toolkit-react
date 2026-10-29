// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The server parses a reference written alone as `template(ref)` (Qore DpqlParser, DP_EXPR_TEMPLATE; professor's
 * `/lsp` parses `$record:{pos}` to `{exp: 'template', args: [{type: 'int', value: '$record:{pos}'}]}` and writes it
 * back as `@pos`). It is the lone value it is: never shown as an operation (qorus#646, David's review: "What is
 * template(...)?").
 */
import { describe, expect, it } from 'vitest';
import { asLoneValue, isLoneValueOperation } from '../src/components/form/expressions/loneValue';
import { mockExpressions } from '../src/components/form/expressions/mockExpressions';
import { renderExpressionToText } from '../src/components/form/expressions/renderExpressionToText';

const LONE_FIELD = { exp: 'template', args: [{ type: 'int', value: '$record:{pos}' }] };

describe('a lone template', () => {
  it('is the lone value it is', () => {
    expect(asLoneValue(LONE_FIELD)).toEqual({ exp: 'value', args: LONE_FIELD.args });
    expect(isLoneValueOperation('template')).toBe(true);
    expect(isLoneValueOperation('value')).toBe(true);
    expect(isLoneValueOperation('+')).toBe(false);
  });

  it('leaves every other expression as it is', () => {
    const sum = {
      exp: '+',
      args: [
        { type: 'int', value: 1 },
        { type: 'int', value: 2 },
      ],
    };
    expect(asLoneValue(sum)).toBe(sum);
    // a template operation with more than one argument is not a lone value
    const odd = { exp: 'template', args: [{ value: 1 }, { value: 2 }] };
    expect(asLoneValue(odd)).toBe(odd);
    expect(asLoneValue(undefined)).toBeUndefined();
  });

  it('reads as its reference in a summary, not as template(...)', () => {
    const read = renderExpressionToText(LONE_FIELD as never, mockExpressions as never);
    expect(read).toContain('pos');
    expect(read).not.toContain('template');
  });
});
