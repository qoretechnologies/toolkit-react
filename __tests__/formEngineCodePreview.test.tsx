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

const SOURCE = '%new-style\nclass Example {\n  private int counter;\n}\n';

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <FormEngine
          compact
          name='code'
          value={{
            source: { type: 'string', value: SOURCE },
            note: { type: 'string', value: 'a plain string value' },
          }}
          options={
            {
              source: { type: 'string', ui_type: 'code-editor', display_name: 'Source Code' },
              note: { type: 'string', ui_type: 'string', display_name: 'Note' },
            } as never
          }
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** The compact engine builds its rows after the first paint. */
const waitForRows = (container: HTMLElement) =>
  waitFor(() => expect(container.querySelectorAll('[data-field]').length).toBeGreaterThan(0));

/** The element carrying the row's hover sits directly above the value text. */
const rowTitle = (container: HTMLElement, field: string) => {
  const row = container.querySelector(`[data-field="${field}"]`);
  const valueText = row?.querySelector('.options-readfirst-valuetext');

  return valueText?.parentElement?.getAttribute('title');
};

describe('read-first code preview', () => {
  it('drops the hover on a code field, whose value is already drawn in full below', async () => {
    const { container } = renderForm();
    await waitForRows(container);

    // the preview shows the source with "Show more" for the rest, so a hover
    // carrying the same text says nothing -- and a native tooltip holding a few
    // hundred lines of source cannot be read anyway
    expect(container.querySelector('.options-readfirst-code')).toBeTruthy();
    expect(rowTitle(container, 'source')).toBeNull();
  });

  it('keeps the hover on values the row had to truncate', async () => {
    const { container } = renderForm();
    await waitForRows(container);

    // the control: a hover is the only way to read a value the row shortened,
    // so suppressing it everywhere would lose that
    expect(rowTitle(container, 'note')).toBe('a plain string value');
  });

  it('lets a host draw the preview so it can be syntax highlighted', async () => {
    const codePreviewRenderer = vi.fn(({ value, name }) => (
      <div data-testid='host-preview' data-name={name}>
        {value}
      </div>
    ));

    const { container, getByTestId } = renderForm({ codePreviewRenderer });
    await waitForRows(container);

    // this package cannot ship a syntax highlighter, so a host that has one
    // supplies the preview; the built-in plain block steps aside for it
    expect(getByTestId('host-preview').getAttribute('data-name')).toBe('source');
    expect(getByTestId('host-preview').textContent).toContain('class Example');
    expect(container.querySelector('.options-readfirst-code')).toBeNull();

    // the schema and the scope's values are handed over too, so a host can
    // resolve the language from a sibling field instead of being told it twice
    expect(codePreviewRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        value: SOURCE,
        name: 'source',
        schema: expect.objectContaining({ ui_type: 'code-editor' }),
        values: expect.objectContaining({ note: expect.objectContaining({ value: 'a plain string value' }) }),
      })
    );
  });
});
