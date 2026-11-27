import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { addMissingExpressionArgs } from '../src/components/form/expressions/argumentPresence';
import { getArgumentTemplates } from '../src/components/form/expressions/argumentTemplates';
import {
  argumentDropsFraction,
  isSoftArgument,
  typeOfSavedValue,
} from '../src/components/form/expressions/argumentTypes';
import { ExpressionBuilderArgumentLabel } from '../src/components/form/expressions/builder/argumentLabel';
import { isEmptyGroupPart } from '../src/components/form/expressions/builder/emptyGroupPart';
import { argumentMatchesType, getArgumentType } from '../src/helpers/expressions';
import { validateFieldWithResult } from '../src/helpers/validations';

/* What the builder does that a host app used to do in its own copy of it. */

const arg = (ui_type: string, name = ui_type) => ({ ui_type, name, display_name: name });

describe('a saved value with no type is read by what its schema takes', () => {
  test('a date, a time or base64 data saved as text is the schema type', () => {
    expect(typeOfSavedValue('2026-11-26', arg('date'))).toBe('date');
    expect(typeOfSavedValue('2026-11-26T10:30:00Z', arg('date'))).toBe('date');
    expect(typeOfSavedValue('23:59:59', arg('time'))).toBe('time');
    expect(typeOfSavedValue('aGVsbG8=', arg('binary'))).toBe('binary');
  });

  test('text that is not one is text, and so is a day that does not exist or a time out of range', () => {
    expect(typeOfSavedValue('next tuesday', arg('date'))).toBe('string');
    expect(typeOfSavedValue('2026-02-30', arg('date'))).toBe('string');
    expect(typeOfSavedValue('24:00', arg('time'))).toBe('string');
  });

  test('only standard padded base64 that encodes back the same is binary data', () => {
    expect(typeOfSavedValue('aGVsbG8', arg('binary'))).toBe('string');
    expect(typeOfSavedValue('a-_b', arg('binary'))).toBe('string');
  });

  test('text in a whole-number, hash or list argument is text, and is said not to fit', () => {
    for (const type of ['int', 'hash', 'list']) {
      const schema = arg(type);
      expect(typeOfSavedValue('abc', schema)).toBe('string');
      expect(getArgumentType([], { value: 'abc' }, schema)).toBe('string');
      expect(argumentMatchesType([], { value: 'abc' }, schema)).toBe(false);
    }
  });

  test('a list or hash the schema takes is what it is', () => {
    expect(typeOfSavedValue([1, 2], arg('list'))).toBe('list');
    expect(typeOfSavedValue({ a: 1 }, arg('hash'))).toBe('hash');
    expect(typeOfSavedValue({ locale: 'de_DE' }, arg('any'))).toBe('hash');
  });

  test('a fraction stays a fraction in a whole-number argument', () => {
    expect(typeOfSavedValue(2.5, arg('int'))).toBe('float');
  });

  test('only a real true or false is the yes/no switch', () => {
    expect(typeOfSavedValue(true, arg('bool'))).toBe('bool');
    expect(typeOfSavedValue('true', arg('bool'))).toBe('string');
  });

  test('a typed value keeps its type', () => {
    expect(getArgumentType([], { type: 'int', value: 'abc' }, arg('int'))).toBe('int');
  });
});

describe('a fraction given an argument that holds a whole number', () => {
  const START = { ui_type: 'number', name: 'int', display_name: 'Start character', required: true };

  test('is noticed by its signature type or its control', () => {
    expect(argumentDropsFraction({ value: 2.5 }, START)).toBe(true);
    expect(argumentDropsFraction({ value: 2.5 }, { ...START, name: '*softint' })).toBe(true);
    expect(argumentDropsFraction({ value: -0.25 }, { ...START, name: 'any', ui_type: 'int' })).toBe(true);
  });

  test('is not a whole number, a fraction where fractions are kept, text or an expression', () => {
    expect(argumentDropsFraction({ value: 2 }, START)).toBe(false);
    expect(argumentDropsFraction({ value: 2.5 }, { ...START, name: 'float', ui_type: 'float' })).toBe(false);
    expect(argumentDropsFraction({ value: '2.5' }, START)).toBe(false);
    expect(argumentDropsFraction({ is_expression: true, value: { exp: 'value', args: [] } }, START)).toBe(false);
    expect(argumentDropsFraction(undefined, START)).toBe(false);
  });

  test('the argument label says the fraction is dropped, and says nothing of a whole number', () => {
    const HINT = 'This value will be converted to a whole number; the fraction is dropped.';
    const { unmount } = render(
      <ReqoreUIProvider>
        <ExpressionBuilderArgumentLabel label='' arg={{ type: 'float', value: 2.5 }} expressions={[]} schema={START} />
      </ReqoreUIProvider>
    );
    expect(screen.getByText(HINT)).toBeTruthy();
    unmount();

    render(
      <ReqoreUIProvider>
        <ExpressionBuilderArgumentLabel label='' arg={{ type: 'int', value: 2 }} expressions={[]} schema={START} />
      </ReqoreUIProvider>
    );
    expect(screen.queryByText(HINT)).toBeNull();
  });
});

describe('the templates an argument offers', () => {
  const TEMPLATES = {
    items: [
      {
        label: 'Order',
        items: [
          { label: 'id', value: '$local:{id}', badge: 'int' },
          { label: 'name', value: '$local:{name}', badge: 'string' },
          { label: 'paid', value: '$local:{paid}', badge: 'bool' },
          { label: 'lines', value: '$local:{lines}', badge: 'list' },
        ],
      },
    ],
  };
  const offered = (schema: any) => {
    const values: string[] = [];
    const walk = (items: any[] = []) =>
      items.forEach((item) => {
        if (item.value) values.push(item.value);
        walk(item.items);
      });
    walk(getArgumentTemplates(TEMPLATES as any, schema)?.items as any[]);
    return values;
  };

  test('a soft argument offers every scalar Qorus converts, not only its control type', () => {
    expect(isSoftArgument(arg('number', 'softint'))).toBe(true);
    expect(offered(arg('number', 'softint'))).toEqual(
      expect.arrayContaining(['$local:{id}', '$local:{name}', '$local:{paid}'])
    );
    expect(offered(arg('number', 'softint'))).not.toContain('$local:{lines}');
  });

  test('an argument that is not soft offers only templates of its own type', () => {
    expect(offered(arg('list'))).toEqual(['$local:{lines}']);
  });

  test('a true-or-false option offers only templates that hold true or false', () => {
    expect(offered(arg('bool'))).toEqual(['$local:{paid}']);
  });

  test('an argument of any type offers every template', () => {
    expect(offered(arg('any'))).toEqual(['$local:{id}', '$local:{name}', '$local:{paid}', '$local:{lines}']);
  });
});

describe('arguments a saved expression leaves out, more', () => {
  test('an argument that gives its type but no value yet is never changed', () => {
    const catalogue = [{ name: 'op', args: [{ ui_type: 'int', default_value: 5 }] }];
    const typed = { type: 'string' };
    expect(addMissingExpressionArgs(catalogue, 'op', [typed])[0]).toBe(typed);
  });

  test('an argument DEFINITION saved where a value belonged is still repaired', () => {
    const catalogue = [{ name: 'op', args: [{ ui_type: 'any', default_value: 'x' }] }];
    expect(addMissingExpressionArgs(catalogue, 'op', [{ type: 'any', required: true }])[0]).toEqual({
      value: 'x',
      type: 'any',
    });
  });

  test('a default that is an expression stays an expression', () => {
    const now = { exp: 'now', args: [] };
    expect(addMissingExpressionArgs([{ name: 'op', args: [{ ui_type: 'date', default_value: now }] }], 'op', [])[0])
      .toEqual({ is_expression: true, value: now });
    expect(
      addMissingExpressionArgs(
        [{ name: 'op', args: [{ ui_type: 'date', ui_default_value: { is_expression: true, value: now } }] }],
        'op',
        []
      )[0]
    ).toEqual({ is_expression: true, value: now });
  });
});

describe('an empty part of an AND or an OR', () => {
  test('is a part with no operation and no value', () => {
    expect(isEmptyGroupPart({ group: '&&', hasOperation: false })).toBe(true);
    expect(isEmptyGroupPart({ group: '||', hasOperation: false, firstValue: '' })).toBe(true);
    expect(isEmptyGroupPart({ group: '||', hasOperation: false, firstValue: null })).toBe(true);
  });

  test('is not one that names an operation or holds a value, false and 0 included', () => {
    expect(isEmptyGroupPart({ group: '&&', hasOperation: true })).toBe(false);
    expect(isEmptyGroupPart({ group: '&&', hasOperation: false, firstValue: true })).toBe(false);
    expect(isEmptyGroupPart({ group: '&&', hasOperation: false, firstValue: 0 })).toBe(false);
    expect(isEmptyGroupPart({ group: '&&', hasOperation: false, firstValue: false })).toBe(false);
  });

  test('is never one in a read-only builder, or a row that is no part of a group', () => {
    expect(isEmptyGroupPart({ group: '&&', readOnly: true, hasOperation: false })).toBe(false);
    expect(isEmptyGroupPart({ hasOperation: false })).toBe(false);
  });
});

describe('the validator judges an optional operand that holds 0, false or empty text', () => {
  const EXPRESSIONS = [
    {
      name: 'pad',
      display_name: 'Pad',
      return_type: 'string',
      args: [{ name: 'count', display_name: 'Count', ui_type: 'int', required: false }],
    },
  ];
  const check = (args: unknown[]) =>
    validateFieldWithResult('expression', { is_expression: true, value: { exp: 'pad', args } }, {
      expressions: EXPRESSIONS,
    } as any);

  test('an absent optional operand is fine', () => {
    expect(check([]).isValid).toBe(true);
    expect(check([undefined]).isValid).toBe(true);
  });

  test('0 is a whole number', () => {
    expect(check([0]).isValid).toBe(true);
    expect(check([{ type: 'int', value: 0 }]).isValid).toBe(true);
  });

  test('false in a whole-number operand is judged, and does not fit', () => {
    expect(check([{ type: 'int', value: false }]).isValid).toBe(false);
  });
});
