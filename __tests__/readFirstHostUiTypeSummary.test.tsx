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
 * A read row drops its one-line summary only when something else renders the
 * value in full underneath it — a markdown document, or the schema-driven
 * structured preview. When neither does, the summary is the only thing the row
 * has to say and must stay.
 *
 * The reported case: a Qorus test with one case rendered as a bare "Cases" —
 * no summary, no preview, not even the empty em-dash — so a test that HAD a
 * case read as unset until the field was opened. `cases` is served with
 * `ui_type: "test-cases"` (a host-rendered type), an `arg_schema` describing a
 * case, and an array of case hashes as its value. That value CAN be drawn as a
 * schema preview (`previewWithSchema`), which suppressed the summary — but the
 * preview itself is gated on `showStructuredPreview`, whose `isHashList` half
 * only recognises `list`/`free-list`/`array`, never a host ui_type. The
 * suppression fired and its replacement did not.
 *
 * This is not test-specific: every IDE-domain ui_type carrying an `arg_schema`
 * and a structured value is the same shape — `collection-documents`,
 * `tool-catalog`, and any future one.
 */
const CASE_ARG_SCHEMA = {
  name: { type: 'string', display_name: 'Name', required: true },
  title: { type: 'string', display_name: 'Title' },
  assertions: { type: 'list', display_name: 'Assertions' },
};

const SCHEMA = {
  cases: {
    type: 'test-cases',
    ui_type: 'test-cases',
    display_name: 'Cases',
    short_desc: 'Ordered test cases',
    required: true,
    preselected: true,
    element_type: 'hash',
    arg_schema: CASE_ARG_SCHEMA,
  },
} as never;

const VALUE = {
  cases: {
    type: 'test-cases',
    value: [
      { name: 'align-svc-happy', title: 'align-svc-happy', assertions: [{ kind: 'equals' }] },
    ],
  },
} as never;

const HostCasesEditor = () => <div>host editor</div>;

const renderRow = (componentOverrides?: Record<string, typeof HostCasesEditor>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <FormEngine
          compact
          name='test'
          value={VALUE}
          options={SCHEMA}
          onChange={vi.fn()}
          componentOverrides={componentOverrides as never}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const rowText = async (container: HTMLElement): Promise<string> => {
  await waitFor(() => expect(container.querySelector('[data-field="cases"]')).toBeTruthy());
  return (container.querySelector('[data-field="cases"]') as HTMLElement).textContent ?? '';
};

describe('a host-rendered ui_type with an arg_schema', () => {
  it('summarises its value on the closed read row', async () => {
    const { container } = renderRow();
    expect(await rowText(container)).toContain('align-svc-happy');
  });

  it('still summarises when the host supplies the editor for that type', async () => {
    const { container } = renderRow({ 'test-cases': HostCasesEditor });
    expect(await rowText(container)).toContain('align-svc-happy');
  });

  it('does not read as unset', async () => {
    const { container } = renderRow();
    const text = await rowText(container);
    expect(text).not.toBe('Cases');
    expect(text).not.toContain('—');
  });
});
