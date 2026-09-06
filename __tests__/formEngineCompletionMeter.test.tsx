import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * The completion header answers "how much is left to do", and it has to answer
 * it with one voice.
 *
 * A field can hold a value and still be wrong — one that fails validation, or
 * one the HOST has flagged with a danger message because something inside it is
 * unfinished (a test whose Cases field holds a case with an incomplete step).
 * Counting those as progress produced a header that argued with itself:
 * "Ready · 2/2 set · 1 need attention → 100%", over a solid green bar. The
 * amber run is drawn from `set%` onward, so a field counted in both was also
 * what pushed that run off the end of the track, where `overflow: hidden`
 * swallowed it — the one visual sign of an outstanding field was hidden by the
 * same double-count.
 */
const SCHEMA_WITH_FLAGGED_FIELD = {
  title: { type: 'string', ui_type: 'string', display_name: 'Title', required: true },
  cases: {
    type: 'list',
    ui_type: 'list',
    display_name: 'Cases',
    required: true,
    messages: [{ intent: 'danger', title: 'One step needs attention' }],
  },
} as never;

const SCHEMA_CLEAN = {
  title: { type: 'string', ui_type: 'string', display_name: 'Title', required: true },
  cases: { type: 'list', ui_type: 'list', display_name: 'Cases', required: true },
} as never;

const BOTH_FILLED = {
  title: { type: 'string', value: 'Order intake' },
  cases: { type: 'list', value: [1] },
} as never;

const header = async () => {
  await waitFor(() => expect(document.querySelector('.options-readfirst-completion')).toBeTruthy());
  return (document.querySelector('.options-readfirst-completion') as HTMLElement).textContent || '';
};

const renderForm = (options: never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='iface' value={BOTH_FILLED} options={options} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('the completion header', () => {
  it('does not call a form Ready while a field needs attention', async () => {
    renderForm(SCHEMA_WITH_FLAGGED_FIELD);
    const text = await header();
    expect(text).toContain('Draft');
    expect(text).not.toContain('Ready');
    expect(text).toContain('1 need attention');
  });

  it('counts a flagged field as set but not as done', async () => {
    renderForm(SCHEMA_WITH_FLAGGED_FIELD);
    const text = await header();
    // Both fields hold a value, so "set" is honest; only one of them is done.
    expect(text).toContain('2/2 set');
    expect(text).toContain('50%');
    expect(text).not.toContain('100%');
  });

  it('still reads Ready at 100% when nothing is flagged', async () => {
    renderForm(SCHEMA_CLEAN);
    const text = await header();
    expect(text).toContain('Ready');
    expect(text).toContain('2/2 set');
    expect(text).toContain('100%');
  });
});
