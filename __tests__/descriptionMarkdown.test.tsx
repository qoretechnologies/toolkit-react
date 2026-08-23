import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Description } from '../src/components/Description';
import { MarkdownRendererContext } from '../src/components/Description/markdownRendererContext';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

const DESC = 'Supported keys are `permissions` and `any_permissions`.\n\n## Overrides\n\nSee below.';

const renderDescription = (ui: React.ReactNode) =>
  render(<ReqoreUIProvider>{ui}</ReqoreUIProvider>);

describe('Description markdown', () => {
  it('draws inline code as code, not as a light chip', () => {
    const { container } = renderDescription(
      <Description longDescription={DESC} longDescriptionOnly />
    );

    // A backtick span marks an identifier, so it has to render as one. Mapping
    // it to a ReqoreTag with an explicit near-white colour auto-contrasted the
    // text to near-black: on a dark form, a description listing option keys
    // read as a row of glaring labels rather than as prose.
    const code = container.querySelectorAll('code');

    expect(code).toHaveLength(2);
    expect([...code].map((node) => node.textContent)).toEqual([
      'permissions',
      'any_permissions',
    ]);
    expect(container.querySelector('.reqore-tag')).toBeNull();
  });

  it('keeps a heading smaller than the title it sits under', () => {
    const { container } = renderDescription(
      <Description longDescription={DESC} longDescriptionOnly />
    );

    // ReqoreH1…H6 render at page-title scale, so a description opening with a
    // level-two heading came out larger than the dialog title above it. A
    // description is never a page.
    const heading = container.querySelector('h2');

    expect(heading?.textContent).toBe('Overrides');
    expect(heading?.className ?? '').not.toContain('reqore');
  });

  it('lets a host draw the markdown so a description reads the same everywhere', () => {
    const markdownRenderer = vi.fn(({ value }) => <div data-testid='host-markdown'>{value}</div>);

    const { container, getByTestId } = renderDescription(
      <MarkdownRendererContext.Provider value={markdownRenderer}>
        <Description longDescription={DESC} longDescriptionOnly />
      </MarkdownRendererContext.Provider>
    );

    // the host's renderer replaces the built-in outright rather than layering
    // over it -- two dialects drawing the same text is the bug, not the fix
    expect(getByTestId('host-markdown').textContent).toBe(DESC);
    expect(container.querySelector('code')).toBeNull();
    expect(markdownRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ value: DESC })
    );
  });
});

describe('FormEngine markdownRenderer', () => {
  it('publishes the host renderer to the descriptions it draws', async () => {
    const markdownRenderer = vi.fn(({ value }) => <div data-testid='host-markdown'>{value}</div>);

    const { container, findAllByTestId } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext as never}>
          <FormEngine
            compact
            name='auth'
            value={{ note: { type: 'string', value: 'a value' } }}
            options={
              {
                note: {
                  type: 'string',
                  ui_type: 'string',
                  display_name: 'Note',
                  short_desc: 'A note',
                  desc: DESC,
                },
              } as never
            }
            onChange={vi.fn()}
            markdownRenderer={markdownRenderer}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    // the field help dialog is the surface the description is actually read on,
    // and it is not a child of the row that opens it -- which is why the
    // renderer travels by context instead of being handed down the tree
    await waitFor(() =>
      expect(container.querySelector('.options-readfirst-help')).toBeTruthy()
    );
    fireEvent.click(container.querySelector('.options-readfirst-help') as Element);

    expect((await findAllByTestId('host-markdown')).length).toBeGreaterThan(0);
    expect(markdownRenderer).toHaveBeenCalledWith(expect.objectContaining({ value: DESC }));
  });
});
