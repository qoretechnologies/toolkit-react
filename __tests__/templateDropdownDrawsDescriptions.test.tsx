import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRendererContext } from '../src/components/Description/markdownRendererContext';

/* The picker is drawn where the dropdown would draw it, not read out of an open popover: Reqore positions its
   dropdown through a portal that never opens in jsdom, so a test that clicked to open it would assert nothing at
   all. The dropdown's popover is the template picker (`TemplateBrowser`): what matters is what its rows say. */
vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ReqoreDropdown: (props: any) => <div data-testid='dropdown'>{props.customElements}</div>,
  };
});

const { ReqoreUIProvider } = await import('@qoretechnologies/reqore');
const { TemplateDropdownSelector } = await import(
  '../src/components/form/fields/template/TemplateField'
);

/**
 * A picker row's description is DRAWN, not printed.
 *
 * Reported against the Qorus test-authoring panes: the row explaining that a
 * step needs a **Fixture Output** showed the asterisks. A description is prose
 * written in the same markdown as the field descriptions and schema messages
 * this package already draws through the host's renderer; the picker row was
 * the last surface still handing the reader its punctuation.
 */
const ITEMS = [
  {
    value: '$.result',
    label: 'result',
    description: 'What the target returned. Set **Fixture Output** to declare it.',
  },
];

const drawn = ({ value, compact }: { value: string; compact?: boolean }) => (
  <span data-compact={String(!!compact)}>{`drawn:${value}`}</span>
);

const renderSelector = (renderer?: typeof drawn) => {
  const ui = (
    <TemplateDropdownSelector
      items={ITEMS as never}
      templates={{ items: ITEMS } as never}
      value={undefined}
      onItemSelect={vi.fn()}
      onRemoveClick={vi.fn()}
    />
  );

  const { container } = render(
    <ReqoreUIProvider>
      {renderer ?
        <MarkdownRendererContext.Provider value={renderer}>{ui}</MarkdownRendererContext.Provider>
      : ui}
    </ReqoreUIProvider>
  );
  return container;
};

/** What the picker's row says it is. */
const what = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.template-picker-row .template-picker-row-what');

describe('the rows the template picker draws', () => {
  it('carries the description drawn by the host renderer', () => {
    const container = renderSelector(drawn);
    expect(what(container)?.textContent).toBe(
      'drawn:What the target returned. Set **Fixture Output** to declare it.'
    );
  });

  it('asks for the compact container a row is', () => {
    const container = renderSelector(drawn);
    expect(what(container)?.querySelector('[data-compact]')?.getAttribute('data-compact')).toBe('true');
  });

  it('keeps the rest of the row intact', () => {
    const container = renderSelector(drawn);
    const row = container.querySelector<HTMLElement>('.template-picker-row');
    expect(row?.getAttribute('data-value')).toBe('$.result');
    expect(row?.textContent).toContain('result');
  });

  it('says a description without its marks for a host with no renderer', () => {
    // No dialect the host never chose, and no `**` either: the words, as plain text.
    const container = renderSelector(undefined);
    expect(what(container)?.textContent).toBe('What the target returned. Set Fixture Output to declare it.');
  });
});
