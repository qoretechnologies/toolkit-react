/*
 * Copyright (c) 2026 Qore Technologies, s.r.o.
 */
import { describe, expect, it } from 'vitest';
import { validateFieldWithResult } from '../src/helpers/validations';

/**
 * qlip build 20261008-083118 (Foxhoundn, ExpressionBuilder Add Value Slot / Addition Picked Fresh / Variable
 * Arguments Can Be Added): "the old version, which provided the argument index / position is a better UX for
 * the user to understand which "value" is the message mentioning". Every operand of a call that takes any
 * number of them is named "Value", so the name alone does not say which one. Where another operand of the
 * call has the same name, or the call can take more of them, the message says which by its position too; a
 * name that says which is enough.
 */
describe('an operand named like another', () => {
  const concat = [
    {
      name: 'concat',
      varargs: true,
      min_args: 1,
      args: [{ name: 'str', display_name: 'Value', ui_type: 'string', required: true }],
    },
    {
      name: 'between',
      min_args: 3,
      args: [
        { name: 'value', display_name: 'Value', ui_type: 'int', required: true },
        { name: 'low', display_name: 'Lower bound', ui_type: 'int', required: true },
        { name: 'high', display_name: 'Upper bound', ui_type: 'int', required: true },
      ],
    },
  ] as any[];

  const call = (exp: string, args: unknown[]) =>
    validateFieldWithResult('expression', { is_expression: true, value: { exp, args } }, { expressions: concat });

  const s = (value?: string) => ({ type: 'string', value });

  it('says which by its position where they share a name', () => {
    expect(call('concat', [s('first'), s('second'), s('third'), s()]).reason).toBe('Enter the 4th "Value"');
    expect(call('concat', [s(), s('second')]).reason).toBe('Enter the 1st "Value"');
    expect(call('concat', [s('a'), s()]).reason).toBe('Enter the 2nd "Value"');
    expect(call('concat', [s('a'), s('b'), s()]).reason).toBe('Enter the 3rd "Value"');
  });

  it('says which by its position when one is wrong', () => {
    const result = call('concat', [s('a'), { type: 'string', value: 12 }]);
    expect(result.isValid).toBe(false);
    expect(result.reason ?? '').toMatch(/^The 2nd "Value" is invalid/);
  });

  it('says which by its position when its expression is wrong', () => {
    const result = call('concat', [s('a'), { is_expression: true, value: { exp: 'concat', args: [s()] } }]);
    expect(result.isValid).toBe(false);
    expect(result.reason ?? '').toMatch(/^The expression in the 2nd "Value" is invalid/);
  });

  /* David (qorus#646): a lone operand of a call that can take more - it has an "Add value" slot - says its
     position too, as the operands that will join it will. */
  it('says the position of a lone operand of a call that can take more', () => {
    expect(call('concat', [s()]).reason).toBe('Enter the 1st "Value"');
  });

  it('names it alone when its name says which', () => {
    expect(call('between', [{ type: 'int', value: 1 }, { type: 'int' }, { type: 'int', value: 3 }]).reason).toBe(
      'Enter a value for "Lower bound"'
    );
  });

  it('counts the 11th, 12th, 13th, 21st and 22nd as written', () => {
    const missingAt = (n: number) =>
      call('concat', [...Array.from({ length: n - 1 }, (_, i) => s(String(i))), s()]).reason;
    expect(missingAt(11)).toBe('Enter the 11th "Value"');
    expect(missingAt(12)).toBe('Enter the 12th "Value"');
    expect(missingAt(13)).toBe('Enter the 13th "Value"');
    expect(missingAt(21)).toBe('Enter the 21st "Value"');
    expect(missingAt(22)).toBe('Enter the 22nd "Value"');
  });
});
