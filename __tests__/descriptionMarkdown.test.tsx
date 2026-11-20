import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Description } from '../src/components/Description';
import { MarkdownRendererContext } from '../src/components/Description/markdownRendererContext';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { summariseMarkdown } from '../src/components/form/engine/readFirst';
import { FetchContext } from '../src/contexts/FetchContext';
import { FormAppearanceProvider } from '../src/components/form/engine/formAppearance';
import { markdownSummaryLine } from '../src/helpers/markdownText';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const DESC = 'Supported keys are `permissions` and `any_permissions`.\n\n## Overrides\n\nSee below.';

const renderDescription = (ui: React.ReactNode) =>
  render(<ReqoreUIProvider>{ui}</ReqoreUIProvider>);

describe('Description markdown', () => {
  it('draws inline code as code, not as a light chip', () => {
    const { container } = renderDescription(
      <Description longDescription={DESC} longDescriptionOnly />
    );

    // A backtick span marks an identifier, so it has to render as one. Mapping
    // it to a ReqoreTag with an explicit near-white color auto-contrasted the
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
        <FetchContext.Provider value={fetchContext}>
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

describe('read-first markdown', () => {
  const SOURCE =
    '## Partner portal\n\n' +
    'Receives orders from the **partner** portal and hands each one to the\n' +
    '`order-processing` workflow.\n\n' +
    '- Rejects an order with no `customer_id`\n';

  const renderMarkdownRow = (props: Record<string, unknown> = {}) =>
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='markdown'
            value={{ desc: { type: 'string', value: SOURCE } }}
            options={
              {
                desc: { type: 'string', ui_type: 'markdown', display_name: 'Description' },
              } as never
            }
            onChange={vi.fn()}
            {...props}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

  it('summarises the value as prose rather than as source', async () => {
    const { container } = renderMarkdownRow();

    await waitFor(() => expect(container.querySelector('[data-field="desc"]')).toBeTruthy());
    const text = container.querySelector('.options-readfirst-valuetext')?.textContent ?? '';

    // the row has one line to work with, and it was spending it on punctuation
    expect(text).toContain('Partner portal');
    expect(text).not.toContain('##');
    expect(text).not.toContain('**');
    expect(text).not.toContain('`');
  });

  it('draws the document under the row with the host renderer', async () => {
    const markdownRenderer = vi.fn(({ value, compact }) => (
      <div data-testid='host-markdown' data-compact={String(!!compact)}>
        {value}
      </div>
    ));

    const { container, findByTestId } = renderMarkdownRow({ markdownRenderer });

    await waitFor(() => expect(container.querySelector('[data-field="desc"]')).toBeTruthy());
    expect(container.querySelector('.options-readfirst-markdown')).toBeTruthy();
    expect((await findByTestId('host-markdown')).textContent).toBe(SOURCE);
    // the inset is a row-height box behind a "show more", not a page
    expect((await findByTestId('host-markdown')).getAttribute('data-compact')).toBe('true');
  });

  it('draws nothing extra when no host renderer is supplied', async () => {
    const { container } = renderMarkdownRow();

    await waitFor(() => expect(container.querySelector('[data-field="desc"]')).toBeTruthy());
    // no built-in fallback here on purpose: drawing markdown in a dialect the
    // host did not choose is the problem, not the fix
    expect(container.querySelector('.options-readfirst-markdown')).toBeNull();
  });
});

describe('summariseMarkdown', () => {
  it('keeps the words and drops the notation', () => {
    expect(summariseMarkdown('## Title\n\nSome **bold** and `code` text.')).toBe(
      'Title Some bold and code text.'
    );
  });

  it('flattens lists and quotes into one line', () => {
    expect(summariseMarkdown('- first\n- second\n\n> quoted')).toBe('first second quoted');
  });

  it('drops a fenced block, which never summarises what surrounds it', () => {
    expect(summariseMarkdown('Intro text\n\n```\nnot a summary\n```\n\nOutro')).toBe(
      'Intro text Outro'
    );
  });

  it('reduces a link to the words a reader sees', () => {
    expect(summariseMarkdown('See [the guide](https://example.com/guide) first')).toBe(
      'See the guide first'
    );
  });

  it('survives a value that is not a string', () => {
    expect(summariseMarkdown(undefined)).toBe('');
    expect(summariseMarkdown({ a: 1 })).toBe('');
  });
});

// A base class's whole description is markdown, with no short one: the picker printed "## Summary Base AWS …"
// with its backticks, in italics, on every card, and hid "…more" because nothing was shorter than the long text.
const BASE_CLASS_DESC =
  '## Summary\n\nBase AWS [Simple Notification Service](https://aws.amazon.com/sns/) class for `services` that publish to a topic. It reads its options from the connection and sends one message per call.\n\n## Options\n\n- `topic_arn`: the topic';

describe('markdownSummaryLine', () => {
  it('skips an opening heading and keeps the words of the first paragraph', () => {
    expect(markdownSummaryLine('## Summary\n\nPublishes **one** message to `topic`.')).toBe(
      'Publishes one message to topic.'
    );
  });

  it('skips a heading that sits on the paragraph\'s first line, and a code block before it', () => {
    expect(markdownSummaryLine('```\ncode\n```\n\n# Title\nThe words.')).toBe('The words.');
  });

  it('gives a long paragraph\'s first sentence', () => {
    expect(markdownSummaryLine(BASE_CLASS_DESC, 80)).toBe(
      'Base AWS Simple Notification Service class for services that publish to a topic.'
    );
  });

  it('cuts at a word with an ellipsis when no sentence ends in time', () => {
    const line = markdownSummaryLine('word '.repeat(60), 40);
    expect(line.endsWith('…')).toBe(true);
    expect(line.length).toBeLessThanOrEqual(41);
    expect(line).not.toContain('wor…');
  });

  it('survives a value that is not a string', () => {
    expect(markdownSummaryLine(undefined)).toBe('');
  });
});

describe('a folded description with only a markdown body', () => {
  it('shows its first plain sentence, without the marks, and offers the rest', () => {
    const { container } = renderDescription(<Description longDescription={BASE_CLASS_DESC} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Base AWS Simple Notification Service class for services that publish to a topic.');
    expect(text).not.toContain('##');
    expect(text).not.toContain('`');
    expect(text).not.toContain('topic_arn');
    expect(container.querySelector('.description-more')?.textContent).toBe('...more');
  });

  it('renders the markdown once opened', () => {
    const { container } = renderDescription(<Description longDescription={BASE_CLASS_DESC} />);
    fireEvent.click(container.querySelector('.description-more')!);
    expect(container.querySelector('h2')?.textContent).toBe('Summary');
    expect(container.textContent).toContain('topic_arn');
  });

  it('offers nothing more when the line already is the whole description', () => {
    const { container } = renderDescription(<Description longDescription='Plain words, nothing else.' />);
    expect(container.textContent).toContain('Plain words, nothing else.');
    expect(container.querySelector('.description-more')).toBeNull();
  });

  it('sets the line upright in the calm look and in italics in the classic one', () => {
    const italicOf = (appearance: 'calm' | 'classic') => {
      const { container, unmount } = renderDescription(
        <FormAppearanceProvider value={appearance}>
          <Description longDescription='Plain words.' />
        </FormAppearanceProvider>
      );
      const span = [...container.querySelectorAll<HTMLElement>('span')].find((el) => el.textContent?.startsWith('Plain words.'));
      const style = getComputedStyle(span!).fontStyle;
      unmount();
      return style;
    };
    expect(italicOf('calm')).not.toBe('italic');
    expect(italicOf('classic')).toBe('italic');
  });
});
