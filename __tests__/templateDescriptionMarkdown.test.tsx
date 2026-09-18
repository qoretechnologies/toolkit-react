import { describe, expect, it } from 'vitest';
import { renderTemplateItemDescriptions } from '../src/helpers/templateItems';

/**
 * A picker row's description is prose, and prose is drawn.
 *
 * Reported against the Qorus test-authoring panes: a row explaining that a step
 * needs a **Fixture Output** showed the asterisks. The description is written
 * in the same markdown as the field descriptions and schema messages this
 * package already draws through the host's renderer — the picker row was the
 * one surface still printing its punctuation at the reader.
 */
const render = ({ value, compact }: { value: string; compact?: boolean }) => (
  <span data-compact={String(!!compact)}>{`drawn:${value}`}</span>
);

const GROUPED = [
  {
    label: 'Values this case captures',
    items: [
      { value: '$.result', label: 'result', description: 'Set **Fixture Output** to declare it.' },
      { value: '$.bare', label: 'bare' },
    ],
  },
];

describe('drawing a template row’s description', () => {
  it('hands the markdown to the host renderer', () => {
    const out = renderTemplateItemDescriptions(GROUPED, render) as any[];
    const row = out[0].items[0];

    expect(row.description).not.toBe('Set **Fixture Output** to declare it.');
    expect(row.description.props.children).toBe('drawn:Set **Fixture Output** to declare it.');
  });

  it('asks for the compact container a row is', () => {
    // Markdown authored as a document opens with a heading that would outgrow
    // the label above it.
    const out = renderTemplateItemDescriptions(GROUPED, render) as any[];

    expect(out[0].items[0].description.props['data-compact']).toBe('true');
  });

  it('reaches a FLAT list too, which is what a lone category resolves to', () => {
    const out = renderTemplateItemDescriptions(GROUPED[0].items, render) as any[];

    expect(out[0].description.props.children).toContain('Fixture Output');
  });

  it('leaves a row with no description alone', () => {
    const out = renderTemplateItemDescriptions(GROUPED, render) as any[];

    expect(out[0].items[1].description).toBeUndefined();
    expect(out[0].items[1].value).toBe('$.bare');
  });

  it('gives a leaf no `items` key it did not have', () => {
    // A picker reads `items` as "this row opens a submenu"; writing the key
    // unconditionally would turn every value into an empty one.
    const out = renderTemplateItemDescriptions(GROUPED, render) as any[];

    expect('items' in out[0].items[0]).toBe(false);
    expect(out[0].items).toHaveLength(2);
  });

  it('keeps everything else on the row', () => {
    const out = renderTemplateItemDescriptions(GROUPED, render) as any[];

    expect(out[0].items[0].value).toBe('$.result');
    expect(out[0].items[0].label).toBe('result');
    expect(out[0].label).toBe('Values this case captures');
  });

  it('changes NOTHING for a host with no renderer of its own', () => {
    // The built-in behaviour is the fallback, not a second opinion: a host that
    // writes plain descriptions keeps exactly the strings it had.
    expect(renderTemplateItemDescriptions(GROUPED, undefined)).toBe(GROUPED);
  });

  it('survives an empty or absent list', () => {
    expect(renderTemplateItemDescriptions(undefined, render)).toBeUndefined();
    expect(renderTemplateItemDescriptions([], render)).toEqual([]);
  });

  /* The property that keeps the memo keys working, and the reason this returns
     a copy rather than editing in place.
  
     The list `TemplateField` receives is a `JSON.stringify` memo key, twice
     over. An element created DURING a render carries `_owner` — a fiber, which
     is circular — so stringifying a list with one in it throws and takes the
     form down to a blank panel; that is what happened when the markdown was
     drawn at the source instead of here. (It cannot be reproduced by building
     an element outside a render, as this file does: with no current owner there
     is no cycle. The guard is therefore that the SOURCE is left untouched, so
     whatever keys a memo upstream is still the plain data it was.) */
  it('leaves the source list untouched, so it can still key a memo', () => {
    const before = JSON.stringify(GROUPED);

    renderTemplateItemDescriptions(GROUPED, render);

    expect(JSON.stringify(GROUPED)).toBe(before);
    expect(GROUPED[0].items[0].description).toBe('Set **Fixture Output** to declare it.');
  });
});
