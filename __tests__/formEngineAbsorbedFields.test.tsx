import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const queryMock = vi.fn();
vi.mock('../src/utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/utils/fetch')>()),
  query: (...args: unknown[]) => queryMock(...args),
}));

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * `absorb_fields` — a field rendering a sibling inside its own container.
 *
 * Language and Source code are one decision, and the form asked it as two
 * unrelated rows. The risk in fixing that is bookkeeping: the compact form
 * shows a completion meter computed from the OPTIONS and a "Set N" badge
 * counted from the ROW ENTRIES, so quietly dropping a row makes the two
 * disagree. An absorbed field therefore keeps its place in the counts and
 * loses only its row.
 */

const OPTIONS = {
  language: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Language',
    allowed_values: [
      { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
      { display_name: 'Python', value: { type: 'string', value: 'python' } },
    ],
  },
  source: {
    type: 'string',
    ui_type: 'long-string',
    display_name: 'Source Code',
    absorb_fields: ['language'],
  },
  other: { type: 'string', ui_type: 'string', display_name: 'Something Else' },
} as never;

const VALUE = {
  language: { type: 'string', value: 'qore' },
  source: { type: 'string', value: 'class Example {}' },
  other: { type: 'string', value: 'x' },
} as never;

const renderForm = (options: never = OPTIONS, value: never = VALUE) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='iface' value={value} options={options} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const rowFor = (container: HTMLElement, field: string) =>
  container.querySelector(
    `[data-field="${field}"].readfirst-row, [data-field="${field}"].readfirst-row-editing`
  );

describe('a field that absorbs a sibling', () => {
  it('gives the absorbed field no row of its own', async () => {
    const { container } = renderForm();

    await waitFor(() => expect(rowFor(container, 'source')).toBeTruthy());
    expect(rowFor(container, 'language')).toBeNull();
    // Unrelated fields are untouched.
    expect(rowFor(container, 'other')).toBeTruthy();
  });

  it('still counts the absorbed field in the completion meter', async () => {
    // The meter reads the options, not the rows — three fields are set, and
    // absorbing one must not make the form look less complete than it is.
    const { container } = renderForm();

    await waitFor(() => expect(container.textContent).toContain('3/3 set'));
  });

  it('renders the absorbed control inside its host when the host is opened', async () => {
    const { container } = renderForm();

    await waitFor(() => expect(rowFor(container, 'source')).toBeTruthy());
    fireEvent.click(container.querySelector('[data-field="source"]')!);

    await waitFor(() =>
      expect(container.querySelector('.options-readfirst-absorbed')).toBeTruthy()
    );
    // It keeps its own label — it is a different field, not a property of the
    // editor it now sits with.
    expect(container.querySelector('.options-readfirst-absorbed')?.textContent).toContain(
      'Language'
    );
  });

  it('leaves the field alone when nothing absorbs it', async () => {
    const withoutAbsorb = {
      ...(OPTIONS as never as Record<string, unknown>),
      source: { type: 'string', ui_type: 'long-string', display_name: 'Source Code' },
    } as never;
    const { container } = renderForm(withoutAbsorb);

    await waitFor(() => expect(rowFor(container, 'language')).toBeTruthy());
  });

  it('ignores a declaration naming a field that does not exist', async () => {
    // A schema that names a missing sibling must not make anything disappear.
    const bogus = {
      ...(OPTIONS as never as Record<string, unknown>),
      source: {
        type: 'string',
        ui_type: 'long-string',
        display_name: 'Source Code',
        absorb_fields: ['nope'],
      },
    } as never;
    const { container } = renderForm(bogus);

    await waitFor(() => expect(rowFor(container, 'source')).toBeTruthy());
    expect(rowFor(container, 'language')).toBeTruthy();
  });
});
