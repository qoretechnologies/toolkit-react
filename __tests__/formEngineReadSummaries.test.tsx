// Copyright 2026 Qore Technologies, s.r.o.
// A collapsed row says what its editor reports, where its host draws that (qorus#646).
//
// A Qog pipeline processor's field mappings were drawn by their editor with a status - "Field mappings
// incomplete", "… required". Collapsed in a read-first form, the row said "2 items", and the status was not seen
// until the row was opened. A host now draws a row's summary by `ui_type`, set or not; the value and the form's
// validity are untouched.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const OPTIONS = {
  mappings: {
    type: 'list',
    ui_type: 'mapping-status',
    display_name: 'Field Mappings',
    required: true,
  },
  name: { type: 'string', display_name: 'Name' },
} as never;

const StatusSummary = ({ value }: { value: unknown }) => (
  <span data-testid='status-summary'>
    {Array.isArray(value) && value.length ? 'Field mappings incomplete' : 'Field mappings required'}
  </span>
);

const show = (value: unknown) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='summaries'
          value={value as never}
          options={OPTIONS}
          onChange={vi.fn()}
          readSummaries={{ 'mapping-status': StatusSummary }}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('a collapsed row whose host draws its summary', () => {
  it('says what the editor reports in place of "2 items"', async () => {
    const { container } = show({
      mappings: { type: 'list', value: [{ a: 1 }, { b: 2 }] },
      name: { type: 'string', value: 'n' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('status-summary').textContent).toBe('Field mappings incomplete')
    );
    const row = container.querySelector('.readfirst-row[data-field="mappings"]');
    expect(row?.textContent).not.toContain('2 items');
  });

  it('says it for a row that is not set too', async () => {
    show({ name: { type: 'string', value: 'n' } });
    await waitFor(() =>
      expect(screen.getByTestId('status-summary').textContent).toBe('Field mappings required')
    );
  });
});
