// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A row named in `alwaysExpandedOptions` is open from the start and nothing closes it: its editor is the field's
 * content (the IDE's test cases, t-87). It draws no Done, no Clear value and no Cancel.
 */
const SCHEMA = {
  note: { type: 'string', ui_type: 'string', display_name: 'Note', preselected: true },
  remote: { type: 'bool', ui_type: 'bool', display_name: 'Remote', preselected: true },
  owner: { type: 'string', ui_type: 'string', display_name: 'Owner', preselected: true },
} as never;

const VALUE = {
  note: { type: 'string', value: 'Checks the order flow' },
  remote: { type: 'bool', value: true },
  owner: { type: 'string', value: 'ops' },
} as never;

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='always-open'
          value={VALUE}
          options={SCHEMA}
          onChange={vi.fn()}
          alwaysExpandedOptions={['note', 'remote']}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const isOpen = (field: string) =>
  !!document.querySelector(
    `.readfirst-row[data-field="${field}"].readfirst-row-editing, .options-readfirst-card[data-field="${field}"]`
  );

const controlsIn = (field: string, className: string) =>
  document.querySelectorAll(
    `.readfirst-row[data-field="${field}"] .${className}, .options-readfirst-card[data-field="${field}"] .${className}`
  ).length;

describe('a row that is always open', () => {
  it('is open from the start, and draws nothing that closes or empties it', async () => {
    renderForm();

    await waitFor(() => {
      expect(isOpen('note')).toBe(true);
      expect(isOpen('remote')).toBe(true);
    });
    expect(isOpen('owner')).toBe(false);
    for (const field of ['note', 'remote']) {
      for (const control of [
        'options-readfirst-done',
        'options-readfirst-clear',
        'options-readfirst-cancel',
      ]) {
        expect(controlsIn(field, control), `${field} ${control}`).toBe(0);
      }
    }
  });

  it('stays open when another row opens, one at a time', async () => {
    renderForm();

    await waitFor(() => expect(isOpen('note')).toBe(true));
    fireEvent.click(document.querySelector('.readfirst-row[data-field="owner"]') as HTMLElement);
    await waitFor(() => expect(isOpen('owner')).toBe(true));
    expect(isOpen('note')).toBe(true);
    expect(isOpen('remote')).toBe(true);
    // the row that is not named keeps its Done
    expect(controlsIn('owner', 'options-readfirst-done')).toBe(1);
  });

  it('is an ordinary row in a classic form, which has no rows to open', async () => {
    renderForm({ compact: false });

    await waitFor(() => expect(document.querySelector('.readfirst-row-editing')).toBeNull());
  });
});
