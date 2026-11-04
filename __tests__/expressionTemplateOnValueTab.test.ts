import { describe, expect, it } from 'vitest';
import {
  loneTemplateOf,
  templateOfExpression,
} from '../src/components/form/fields/template/writtenAsText';

/**
 * The Value tab shows an expression that is nothing but one template as that template's chip (qorus#646): a host
 * may hold a reference to a field as `value($record:{…})` - the Qorus IDE reads a test's reference back that way,
 * so that it opens on the Expression tab - and the Value tab said "This expression can't be shown as a value." for
 * every one of them. The FormEngine stories (Value Tab Draws A Referenced Field As Its Chip, Value Tab Pick
 * Replaces A Referenced Field) draw it; these check which expressions are such a template.
 */
const AST = {
  exp: '+',
  args: [
    { type: 'int', value: '$record:{pos}' },
    { type: 'int', value: 1 },
  ],
};

describe('the template an expression is', () => {
  it('is the one template of value() or template(), as a host may hold a reference', () => {
    expect(
      templateOfExpression({
        exp: 'value',
        args: [{ type: 'string', value: '$record:{bezeichnung}' }],
      })
    ).toBe('$record:{bezeichnung}');
    expect(
      templateOfExpression({ exp: 'template', args: [{ type: 'int', value: '$record:{pos}' }] })
    ).toBe('$record:{pos}');
    // the argument as the parser gives it, and as a bare string
    expect(
      templateOfExpression({ exp: 'template', args: [{ value: { raw: '$record:{pos}' } }] })
    ).toBe('$record:{pos}');
    expect(templateOfExpression({ exp: 'value', args: ['$local:{count}'] })).toBe('$local:{count}');
  });

  it('is nothing for any other expression', () => {
    // an operation of its own
    expect(templateOfExpression(AST)).toBeUndefined();
    // a value that is not a template, or text around one
    expect(
      templateOfExpression({ exp: 'value', args: [{ type: 'int', value: 12 }] })
    ).toBeUndefined();
    expect(
      templateOfExpression({ exp: 'value', args: [{ type: 'string', value: 'SUP-$record:{pos}' }] })
    ).toBeUndefined();
    // more than one argument, or none
    expect(
      templateOfExpression({
        exp: 'value',
        args: [{ value: '$record:{pos}' }, { value: '$record:{pos}' }],
      })
    ).toBeUndefined();
    expect(templateOfExpression({ exp: 'value', args: [] })).toBeUndefined();
    // not an expression at all
    expect(templateOfExpression('$record:{pos}')).toBeUndefined();
    expect(templateOfExpression(undefined)).toBeUndefined();
  });

  it('leaves the Text view reading only template() as the lone template it stores bare', () => {
    expect(
      loneTemplateOf({ value: { exp: 'template', args: [{ value: { raw: '$record:{pos}' } }] } })
    ).toBe('$record:{pos}');
    expect(
      loneTemplateOf({ value: { exp: 'value', args: [{ value: '$record:{pos}' }] } })
    ).toBeUndefined();
  });
});
