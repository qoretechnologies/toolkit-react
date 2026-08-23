import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { summariseMarkdown } from '../src/components/form/engine/readFirst';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

const DOCUMENT = [
  '## Order intake',
  '',
  'Receives orders from the **partner** portal and hands them to the',
  '`order-processing` workflow. See [the runbook](https://example.com/runbook).',
].join('\n');

const ONE_LINER = 'Receives orders from the **partner** portal.';

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <FormEngine
          compact
          name='markdown'
          value={{
            desc: { type: 'string', value: DOCUMENT },
            short: { type: 'string', value: ONE_LINER },
          }}
          options={
            {
              desc: { type: 'string', ui_type: 'markdown', display_name: 'Description' },
              short: { type: 'string', ui_type: 'markdown', display_name: 'Short' },
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

const row = (container: HTMLElement, field: string) =>
  container.querySelector(`[data-field="${field}"]`);

describe('summariseMarkdown', () => {
  it('unwraps the inline constructs that would eat a one-line summary', () => {
    expect(summariseMarkdown('**bold** and _thin_ and `code`')).toBe('bold and thin and code');
    expect(summariseMarkdown('see [the runbook](https://example.com/x)')).toBe('see the runbook');
    // the `!` of an image must not survive as stray punctuation
    expect(summariseMarkdown('![a diagram](img.png) follows')).toBe('a diagram follows');
    expect(summariseMarkdown('mail <mailto:ops@example.com> now')).toBe(
      'mail mailto:ops@example.com now'
    );
    expect(summariseMarkdown('~~dropped~~ kept')).toBe('dropped kept');
  });

  it('drops block markers and collapses the document to one line', () => {
    expect(summariseMarkdown('# Heading\n\nBody text.')).toBe('Heading Body text.');
    expect(summariseMarkdown('- first\n- second')).toBe('first second');
    expect(summariseMarkdown('1. first\n2. second')).toBe('first second');
    expect(summariseMarkdown('> quoted\n\nplain')).toBe('quoted plain');
    expect(summariseMarkdown('Title\n=====\n\nBody')).toBe('Title Body');
    // A fenced block is dropped whole, not unwrapped: the summary stands in for
    // the rendered document, and a code block is never the summary of the thing
    // it sits in. (This assertion previously expected the code to survive; the
    // two markdown branches disagreed here and this is the resolution.)
    expect(summariseMarkdown('```qore\nint i = 1;\n```')).toBe('');
    expect(summariseMarkdown('Before\n```js\nconst x = 1;\n```\nAfter')).toBe('Before After');
  });

  it('leaves prose that only looks like markup alone', () => {
    // a summary that silently drops content reads as data loss
    expect(summariseMarkdown('2 * 3 * 4 items')).toBe('2 * 3 * 4 items');
    // CommonMark does not emphasise intraword underscores, so an identifier
    // keeps its shape
    expect(summariseMarkdown('a_b_c stays')).toBe('a_b_c stays');
    expect(summariseMarkdown('snake_case_name')).toBe('snake_case_name');
  });
});

describe('read-first markdown', () => {
  it('summarises a markdown value as prose, not as source', async () => {
    const { container } = renderForm();
    await waitForRows(container);

    const text = row(container, 'desc')?.querySelector('.options-readfirst-valuetext')?.textContent;

    // the row's one line must not open with "## " or spend its width on a URL
    expect(text).toContain('Order intake');
    expect(text).toContain('partner portal');
    expect(text).not.toContain('##');
    expect(text).not.toContain('**');
    expect(text).not.toContain('https://example.com/runbook');
  });

  it("renders the document below a multi-line value, in the host's dialect", async () => {
    // The inset draws through the host's renderer and has no built-in fallback:
    // a form that picks its own markdown dialect is the thing this seam exists
    // to prevent. Here the "host" is a plain renderer so the assertions can be
    // about the wiring rather than about anyone's heading scale.
    const markdownRenderer = ({ value }: { value: string }) => (
      <div data-testid='host-doc'>{value}</div>
    );
    const { container, getByTestId } = renderForm({ markdownRenderer });
    await waitForRows(container);

    const inset = row(container, 'desc')?.querySelector('.options-readfirst-markdown');

    expect(inset).toBeTruthy();
    expect(getByTestId('host-doc').textContent).toBe(DOCUMENT);
  });

  it('shows the prose but no inset when no host renderer is supplied', async () => {
    const { container } = renderForm();
    await waitForRows(container);

    // No renderer, no inset — but the row is not left empty: its one line still
    // carries the document's prose, summarised. The reader loses the rendering,
    // never the content.
    expect(row(container, 'desc')?.querySelector('.options-readfirst-markdown')).toBeNull();
    const text = row(container, 'desc')?.querySelector('.options-readfirst-valuetext')?.textContent;
    expect(text).toContain('Order intake');
    expect(text).not.toContain('##');
  });

  it('leaves a single-line value to the row it already fits in', async () => {
    const { container } = renderForm();
    await waitForRows(container);

    // its one line IS the whole document, already shown as prose — a second
    // copy below would make every short description row tall for nothing
    expect(row(container, 'short')?.querySelector('.options-readfirst-markdown')).toBeNull();
    expect(
      row(container, 'short')?.querySelector('.options-readfirst-valuetext')?.textContent
    ).toBe('Receives orders from the partner portal.');
  });

  it('lets a host draw the document with its own renderer', async () => {
    const markdownRenderer = vi.fn(({ value }) => <div data-testid='host-markdown'>{value}</div>);

    const { container, getByTestId } = renderForm({ markdownRenderer });
    await waitForRows(container);

    // an app that owns a markdown renderer must not have a second one imposed
    // on it by a form: a description has to read the same everywhere
    expect(getByTestId('host-markdown').textContent).toBe(DOCUMENT);
    expect(container.querySelector('.options-readfirst-markdown h2')).toBeNull();

    // The renderer contract is deliberately just `{ value, compact }`. It used
    // to also carry `name`, `schema`, `options` and `values`; no consumer used
    // them, and arguments can be added to a public seam later but not removed.
    expect(markdownRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        value: DOCUMENT,
        compact: true,
      })
    );
  });
});
