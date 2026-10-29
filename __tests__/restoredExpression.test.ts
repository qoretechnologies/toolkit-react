import { describe, expect, it } from 'vitest';
import {
  restoredFieldChange,
  shouldMarkAsExpression,
} from '../src/components/form/expressions/argumentPresence';

/**
 * An undone edit puts a field back as it was (qorus#646): Cancel, Escape and Revert. An expression cleared on the
 * Expression tab, or replaced with a value, came back from them without what marks it as an expression: the
 * engine keeps the flag only while the field still holds an expression when the change says nothing of it, and
 * the field held nothing, or a value, at that moment. Its AST was then stored as a literal hash, and its row read
 * "2 fields", `exp` and `args`. The FormEngine stories (Canceling A Cleared Expression Puts It Back and the rest)
 * undo each way; these check the rule they rely on.
 */
const AST = {
  exp: '+',
  args: [
    { type: 'int', value: '$record:{pos}' },
    { type: 'int', value: 1 },
  ],
};

describe('what a field is put back to', () => {
  it('says an expression is one, so the flag is set whatever the field holds now', () => {
    const [value, type, isExpression] = restoredFieldChange({
      type: 'int',
      value: AST,
      is_expression: true,
    });

    expect([value, type, isExpression]).toEqual([AST, 'int', true]);
    // the field was cleared (no longer an expression): put back, it is one again
    expect(shouldMarkAsExpression(isExpression, value, false)).toBe(true);
  });

  it('says a value is not one, so the flag goes whatever the field holds now', () => {
    const [value, type, isExpression] = restoredFieldChange({ type: 'int', value: 12 });

    expect([value, type, isExpression]).toEqual([12, 'int', false]);
    // the field had been made an expression: put back, it is the value
    expect(shouldMarkAsExpression(isExpression, value, true)).toBe(false);
  });

  it('puts back a field that held nothing as nothing, not an expression', () => {
    expect(restoredFieldChange(undefined)).toEqual([undefined, undefined, false]);
  });
});
