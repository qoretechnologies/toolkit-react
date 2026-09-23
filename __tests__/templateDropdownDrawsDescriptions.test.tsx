import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRendererContext } from '../src/components/Description/markdownRendererContext';

/* The list is captured where it is HANDED OVER rather than read out of an open
   popover: Reqore positions its dropdown through a portal that never opens in
   jsdom, so a test that clicked to open it would assert nothing at all. What
   matters here is which list crosses the boundary. */
let seen: any;
vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ReqoreDropdown: (props: any) => {
      seen = props;
      return <div data-testid='dropdown' />;
    },
  };
});

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
  seen = undefined;
  const ui = (
    <TemplateDropdownSelector
      items={ITEMS as never}
      templates={{ items: ITEMS } as never}
      value={undefined}
      onItemSelect={vi.fn()}
      onRemoveClick={vi.fn()}
    />
  );

  render(
    renderer ?
      <MarkdownRendererContext.Provider value={renderer}>{ui}</MarkdownRendererContext.Provider>
    : ui
  );
};

describe('the list the template picker is given', () => {
  it('carries the description drawn by the host renderer', () => {
    renderSelector(drawn);

    const row = seen.items[0];
    expect(typeof row.description).not.toBe('string');
    expect(row.description.props.children).toBe(
      'drawn:What the target returned. Set **Fixture Output** to declare it.'
    );
  });

  it('asks for the compact container a row is', () => {
    renderSelector(drawn);

    expect(seen.items[0].description.props['data-compact']).toBe('true');
  });

  it('keeps the rest of the row intact', () => {
    renderSelector(drawn);

    expect(seen.items[0].value).toBe('$.result');
    expect(seen.items[0].label).toBe('result');
  });

  it('leaves a host with no renderer exactly as it was', () => {
    // The built-in behaviour is the fallback, not a second opinion.
    renderSelector(undefined);

    expect(seen.items[0].description).toBe(
      'What the target returned. Set **Fixture Output** to declare it.'
    );
  });
});
