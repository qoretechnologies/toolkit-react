import { isExpressionReturnTypeMatching } from '../src/components/form/expressions/builder/returnTypeMatch';
import { addMissingExpressionArgs } from '../src/components/form/expressions/argumentPresence';
import { conversionText } from '../src/helpers/expressions';

/* Rules of the expression builder that a host app used to test against its own copy of the builder. The builder is
   Reqraft's, so they are tested here. */

describe('what an expression gives fits the place it is in', () => {
  test('a field of a text format takes an expression that gives text', () => {
    // a type the catalogue does not list is taken by its base type
    expect(
      isExpressionReturnTypeMatching({
        returnType: 'email-address',
        returnBaseType: 'string',
        expressionReturnType: 'string',
      })
    ).toBe(true);
  });

  test('a true-or-false field does not take an expression that gives text', () => {
    expect(isExpressionReturnTypeMatching({ returnType: 'bool', expressionReturnType: 'string' })).toBe(false);
  });

  test('a place that says nothing, or takes anything, takes it', () => {
    for (const returnType of [undefined, 'any', 'auto', 'context']) {
      expect(isExpressionReturnTypeMatching({ returnType, expressionReturnType: 'string' })).toBe(true);
    }
  });

  test('an expression with no operation yet is not said to give the wrong type', () => {
    expect(
      isExpressionReturnTypeMatching({ returnType: 'bool', expressionReturnType: 'string', noOperationYet: true })
    ).toBe(true);
  });

  test('a condition decided by its result: a number decides it, text does not', () => {
    expect(
      isExpressionReturnTypeMatching({ returnType: 'bool', expressionReturnType: 'int', takesCondition: true })
    ).toBe(true);
    expect(
      isExpressionReturnTypeMatching({ returnType: 'bool', expressionReturnType: 'string', takesCondition: true })
    ).toBe(false);
  });

  test('a condition whose verdict is an error never matches', () => {
    expect(
      isExpressionReturnTypeMatching({ returnType: 'any', expressionReturnType: 'string', condition: 'error' })
    ).toBe(false);
  });
});

describe('the conversion list says what an argument is converted from and to', () => {
  test('names both types in one sentence', () => {
    expect(conversionText('a whole number', 'text')).toBe('Converted from a whole number to text');
  });

  test('names the one it knows', () => {
    expect(conversionText(undefined, 'text')).toBe('Converted to text');
    expect(conversionText('a date', undefined)).toBe('Converted from a date');
  });
});

describe('arguments a saved expression leaves out', () => {
  const catalogue = [
    {
      name: 'op',
      args: [
        { ui_type: 'bool', default_value: true },
        { ui_type: 'bool' },
        { ui_type: 'bool', default_value: false },
        { ui_type: 'string' },
      ],
    },
  ];

  test('a boolean option shows its declared default, typed as a boolean', () => {
    expect(addMissingExpressionArgs(catalogue, 'op', [])[0]).toEqual({ value: true, type: 'bool' });
  });

  test('a boolean option with no default is typed boolean, with no value', () => {
    expect(addMissingExpressionArgs(catalogue, 'op', [])[1]).toEqual({ type: 'bool' });
  });

  test('a false default is kept, not dropped as empty', () => {
    expect(addMissingExpressionArgs(catalogue, 'op', [])[2]).toEqual({ value: false, type: 'bool' });
  });

  test('an argument that is an expression is never changed', () => {
    const expression = { is_expression: true, value: { exp: 'concat', args: [] } };
    expect(addMissingExpressionArgs(catalogue, 'op', [undefined, undefined, undefined, expression])[3]).toBe(
      expression
    );
  });

  test('an argument with a value of its own is never changed', () => {
    const supplied = { type: 'bool', value: false };
    expect(addMissingExpressionArgs(catalogue, 'op', [supplied])[0]).toBe(supplied);
  });
});
