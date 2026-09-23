import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * An expression is not a hash, whatever shape it is stored in.
 *
 * `{is_expression: true, value: {exp, args}}` is hash-shaped, so a field holding
 * one earned the row's structured inset: the summary line read `1 + 2` and the
 * syntax tree — `is_expression true / value / exp + / args 1 2` — was printed
 * directly underneath it. The AST is how an expression is STORED, not what it
 * is. Reported from a Qorus test's read-only assertion pane, where the tree was
 * the only thing a reader could see.
 */
const SCHEMA = {
  expected: {
    type: 'hash',
    ui_type: 'hash',
    display_name: 'Expected Value',
    supports_expressions: true,
  },
} as never;

/** The shape a value read back from storage carries: the flag is on the VALUE. */
const STORED_EXPRESSION = {
  expected: {
    type: 'hash',
    value: {
      is_expression: true,
      value: {
        exp: '+',
        args: [
          { type: 'int', value: 1 },
          { type: 'int', value: 2 },
        ],
      },
    },
  },
} as never;

/** The shape the editor writes at runtime: the flag is on the OPTION. */
const LIVE_EXPRESSION = {
  expected: {
    type: 'hash',
    is_expression: true,
    value: {
      exp: '+',
      args: [
        { type: 'int', value: 1 },
        { type: 'int', value: 2 },
      ],
    },
  },
} as never;

const renderForm = (value: never, readOnly = true) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          readOnly={readOnly}
          name='iface'
          value={value}
          options={SCHEMA}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('a row holding an expression', () => {
  it('shows the expression and not the tree it is stored as', async () => {
    renderForm(STORED_EXPRESSION);

    await waitFor(() => expect(screen.getByText(/1 \+ 2/)).toBeTruthy());
    // The keys of the envelope and of the AST inside it. Every one of them was
    // on screen, under a summary that had already said `1 + 2`.
    expect(screen.queryByText('is_expression')).toBeNull();
    expect(screen.queryByText('exp')).toBeNull();
    expect(screen.queryByText('args')).toBeNull();
  });

  it('does the same for the shape the editor writes at runtime', async () => {
    renderForm(LIVE_EXPRESSION);

    await waitFor(() => expect(screen.getByText(/1 \+ 2/)).toBeTruthy());
    expect(screen.queryByText('is_expression')).toBeNull();
    expect(screen.queryByText('exp')).toBeNull();
  });

  it('leaves an ordinary hash its structured inset', async () => {
    // The control: the inset is right for a hash, which is why the fix is a
    // question about the VALUE and not a switch on read mode.
    renderForm({
      expected: { type: 'hash', value: { customer: 'ACME', total: 42 } },
    } as never);

    await waitFor(() => expect(screen.getByText('customer')).toBeTruthy());
    expect(screen.getByText('ACME')).toBeTruthy();
  });
});
