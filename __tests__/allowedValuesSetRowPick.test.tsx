// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { IQorusAllowedValue } from '@qoretechnologies/ts-toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * A value picked from a field's allowed values is a value, not an expression (qorus#646: the Qorus IDE's guided
 * check "status: One of" changed its Field, a '*string' option, to "paid" and the form got back
 * `{ type: 'string', value: 'paid', is_expression: true }`, which the IDE reads as no field at all). The field said
 * whether its type can be null in the argument every reader takes for the expression flag.
 */
const fetchContext = emptyFetchContext();

const allowedValues: IQorusAllowedValue[] = [
  { value: { type: 'string', value: 'status' }, display_name: 'status (string)' },
  { value: { type: 'string', value: 'paid' }, display_name: 'paid (bool)' },
  { value: { type: 'string', value: '__other__' }, display_name: 'Other field...' },
];

const renderField = (props: Record<string, unknown>) => {
  const onChange = vi.fn();
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <AutoFormField
          name='field'
          value='status'
          allowed_values={allowedValues}
          onChange={onChange}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  return onChange;
};

describe('a value picked from the allowed values', () => {
  it.each([
    ['a type that can be null', { type: '*string', defaultType: 'string', canBeNull: true }],
    ['a type that cannot', { type: 'string', defaultType: 'string' }],
    ['an untyped field', { type: 'any', defaultType: 'any' }],
  ])('is a value, not an expression, in %s', async (_case, props) => {
    const user = userEvent.setup();
    const onChange = renderField(props);

    await user.click(await screen.findByText('paid (bool)'));

    const [name, value, , isFunction] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(name).toBe('field');
    expect(value).toBe('paid');
    expect(isFunction).toBe(false);
  });
});
