// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * An option compared by an operator (a search's arguments) says its condition in words on its closed row:
 * "Status" beside `equals (==) "COMPLETE"`, the operators by the server's names for them, outermost first, and text
 * in quotes. The row read only the value, as if the option simply held it, and a `logical not (!)` chain read as
 * its opposite. Opened, the sentence under the editor says it whole (`operatorSummary`).
 */

const OPERATORS = {
  '==': { name: '==', display_name: 'equals (==)' },
  '!': { name: '!', display_name: 'logical not (!)', supports_nesting: true },
} as never;

const OPTIONS = {
  status: { type: 'string', display_name: 'Status' },
  priority: { type: 'int', display_name: 'Priority' },
} as never;

const renderSearch = () =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='search_args'
          operators={OPERATORS}
          options={OPTIONS}
          value={
            {
              status: { type: 'string', value: 'COMPLETE', op: ['=='] },
              priority: { type: 'int', value: 5, op: ['!', '=='] },
            } as never
          }
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const rowText = (container: HTMLElement, field: string) =>
  container.querySelector(`[data-field="${field}"] .options-readfirst-valuetext`)?.textContent;

describe('a compact row compared by an operator', () => {
  it('says its condition in words while it is closed', async () => {
    const { container } = renderSearch();
    await waitFor(() => expect(rowText(container, 'status')).toBe('equals (==) "COMPLETE"'));
    // a chain keeps its "not", and a number reads as it is
    expect(rowText(container, 'priority')).toBe('logical not (!) equals (==) 5');
    // no keywords, no operator keys alone, no value as JSON
    expect(container.textContent).not.toMatch(/WHERE|IS[=!]/);
  });

  it('says the whole sentence under its editor when it is opened', async () => {
    const { container } = renderSearch();
    await waitFor(() => expect(rowText(container, 'status')).toBeTruthy());
    fireEvent.click(container.querySelector<HTMLElement>('[data-field="status"]') as HTMLElement);
    await waitFor(() =>
      expect(container.querySelector('.options-operator-summary')?.textContent).toBe(
        'Status equals (==) "COMPLETE"'
      )
    );
  });

  it('reads as its value alone without operators', async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            name='plain'
            options={OPTIONS}
            value={{ status: { type: 'string', value: 'COMPLETE' } } as never}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(rowText(container, 'status')).toBe('COMPLETE'));
  });
});
