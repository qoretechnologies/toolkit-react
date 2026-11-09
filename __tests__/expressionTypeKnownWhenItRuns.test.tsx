// Copyright 2026 Qore Technologies, s.r.o.
// An expression whose type the server can know only when it runs (`known: false`: `{inferred_type: "auto",
// ui_type: "any"}`, as of a template whose type only the running interface has) is no mismatch and no error: the
// builder says nothing against it, and an argument holding it says its type is known when it runs.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** What the server has said every expression gives. */
let serverType: { inferred_type: string; ui_type: string; known: boolean } | undefined;

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

vi.mock('../src/components/form/expressions/useExpressionType', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../src/components/form/expressions/useExpressionType')
  >()),
  useExpressionType: () => serverType,
  getCachedExpressionType: () => serverType,
}));

import { Expression } from '../src/components/form/expressions/builder';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/** "lookup": gives what its key finds, known only when it runs. */
const LOOKUP = {
  name: 'lookup',
  display_name: 'Lookup',
  return_type: 'auto',
  ui_return_type: 'any',
  args: [
    {
      signature_type_code: 'string',
      name: 'key',
      display_name: 'Key',
      ui_type: 'string',
      required: true,
    },
  ],
};

/** "add days": takes a whole number. */
const ADD_DAYS = {
  name: 'add_days',
  display_name: 'Add Days',
  return_type: 'date',
  ui_return_type: 'date',
  args: [
    {
      signature_type_code: 'int',
      name: 'days',
      display_name: 'Days',
      ui_type: 'int',
      required: true,
    },
  ],
};

const MISMATCH =
  /This expression gives|which this field does not take|must evaluate to true or false/;

const renderExpression = (value: unknown, returnType: string) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <Expression
          value={value as never}
          onValueChange={vi.fn() as never}
          expressions={[LOOKUP, ADD_DAYS] as never}
          type={returnType as never}
          returnType={returnType as never}
          level={0}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const lookup = {
  is_expression: true,
  value: { exp: 'lookup', args: [{ type: 'string', value: '$local:key' }] },
};

describe('an expression whose type is known only when it runs', () => {
  afterEach(() => {
    serverType = undefined;
  });

  it('is no mismatch in a place that takes a whole number', () => {
    serverType = { inferred_type: 'auto', ui_type: 'any', known: false };
    const { container } = renderExpression(lookup, 'int');
    expect(container.textContent).not.toMatch(MISMATCH);
  });

  it('is no error and no warning in a condition', () => {
    serverType = { inferred_type: 'auto', ui_type: 'any', known: false };
    const { container } = renderExpression(lookup, 'bool');
    expect(container.textContent).not.toMatch(MISMATCH);
    expect(container.textContent).not.toMatch(/read as true unless/);
  });

  it('says under the value, in plain words, that it depends on the incoming data', () => {
    serverType = { inferred_type: 'auto', ui_type: 'any', known: false };
    const { container } = renderExpression(
      { is_expression: true, value: { exp: 'add_days', args: [lookup] } },
      'date'
    );
    const note = container.querySelector('.expression-arg-runtime-note');
    expect(note?.textContent).toBe(
      'Depends on the incoming data, so it is checked when this runs.'
    );
    // under the value it is about: the last thing of that argument, after the value, not in its header
    const argument = note!.closest('.expression-arg')!;
    expect(argument.lastElementChild).toBe(note);
    expect(argument.firstElementChild?.contains(note)).toBe(false);
    // and no longer a technical suffix on the argument's type
    expect(container.textContent).not.toMatch(/known when it runs/i);
  });

  it('says it once, on the innermost value, when one such value is nested in another', async () => {
    serverType = { inferred_type: 'auto', ui_type: 'any', known: false };
    const { container } = renderExpression(
      {
        is_expression: true,
        value: {
          exp: 'add_days',
          args: [{ is_expression: true, value: { exp: 'add_days', args: [lookup] } }],
        },
      },
      'date'
    );
    await waitFor(() =>
      expect(container.querySelectorAll('.expression-arg-runtime-note')).toHaveLength(1)
    );
    // the one note is on the value that reads the data, inside the outer argument
    const note = container.querySelector('.expression-arg-runtime-note')!;
    const outer = container.querySelector('.expression-arg')!;
    expect(outer.lastElementChild).not.toBe(note);
    expect(outer.contains(note)).toBe(true);
  });

  it('says nothing of the kind for an argument whose type is known', () => {
    serverType = { inferred_type: 'int', ui_type: 'int', known: true };
    const { container } = renderExpression(
      { is_expression: true, value: { exp: 'add_days', args: [lookup] } },
      'date'
    );
    expect(container.querySelector('.expression-arg-runtime-note')).toBeNull();
  });
});
