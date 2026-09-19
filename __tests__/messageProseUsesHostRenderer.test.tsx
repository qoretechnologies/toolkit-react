import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A schema message is PROSE, and prose is the host's to draw.
 *
 * `markdownRendererContext` says this package renders markdown "in exactly one
 * place — a field's description". That was one place short: a message declared
 * on a field is written by the same author in the same dialect, and it was
 * drawn as a raw string. A Qorus warning reading "Give that step a **Fixture
 * Output**" showed the asterisks, and every value reference in it stayed a raw
 * token where the editor two lines above renders it as a named chip.
 */
const SCHEMA = {
  expected: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Expected Value',
    // Required, so the row is LISTED rather than sitting in the Fields menu as
    // an addable: a hidden row shows no messages at all (`infoActive`).
    required: true,
    messages: [
      {
        intent: 'warning',
        title: 'This assertion cannot pass as configured',
        content: 'Give that step a **Fixture Output** to declare what it returns.',
      },
    ],
  },
} as never;

/** Stands in for the host's renderer; asserts on what it was HANDED. */
const hostRenderer = vi.fn(({ value, compact }: { value: string; compact?: boolean }) => (
  <div data-testid='host-markdown' data-compact={String(!!compact)}>
    {value.replace(/\*\*(.+?)\*\*/g, '<<$1>>')}
  </div>
));

const renderForm = (withHost = true) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        {/* The renderer is a PROP: `FormEngine` provides it into the context
            itself, so an outer provider is shadowed by the prop's value. This is
            exactly how a host supplies one. */}
        <FormEngine
          compact
          name='iface'
          value={{ expected: { type: 'string', value: 'x' } } as never}
          options={SCHEMA}
          markdownRenderer={withHost ? hostRenderer : undefined}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('a message declared on a field', () => {
  it('is drawn by the host renderer, not printed as its source', async () => {
    hostRenderer.mockClear();
    renderForm();

    await waitFor(() => expect(screen.getByTestId('host-markdown')).toBeTruthy());
    // The asterisks are gone because the host drew them; the raw string never
    // reaches the reader.
    expect(screen.getByTestId('host-markdown').textContent).toContain('<<Fixture Output>>');
    expect(screen.queryByText(/\*\*Fixture Output\*\*/)).toBeNull();
  });

  it('asks for the compact treatment, because a strip is not a page', async () => {
    hostRenderer.mockClear();
    renderForm();

    await waitFor(() => expect(hostRenderer).toHaveBeenCalled());
    // Markdown authored as a document opens with a heading that would outgrow
    // the field label above it.
    expect(hostRenderer.mock.calls[0][0].compact).toBe(true);
  });

  it('still draws the message where the host has no renderer', async () => {
    // The built-in behaviour, unchanged: the string, as it always was.
    renderForm(false);

    await waitFor(() => expect(screen.getByText(/Give that step a/)).toBeTruthy());
    expect(screen.queryByTestId('host-markdown')).toBeNull();
  });
});
