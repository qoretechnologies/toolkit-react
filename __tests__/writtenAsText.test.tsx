// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A field written as text (qorus#646): a template chosen into it is a chip, text is written around it,
 * and the field's value is read from the text.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import {
  isWrittenAsText,
  scalarLiteral,
  templateTextValue,
} from '../src/components/form/fields/template/writtenAsText';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const TEMPLATES = {
  items: [
    {
      label: 'Fields of the row',
      items: [
        { label: 'pos', value: '$record:{pos}', badge: 'int' },
        { label: 'bezeichnung', value: '$record:{bezeichnung}', badge: 'string' },
        { label: 'liefertermin', value: '$record:{liefertermin}', badge: 'date' },
      ],
    },
  ],
};

describe('what a field written as text holds', () => {
  it('is a lone template, of the template\'s own type in an untyped field', () => {
    expect(templateTextValue('$record:{pos}', 'any', TEMPLATES as never)).toEqual({ value: '$record:{pos}', type: 'int' });
    expect(templateTextValue(' $record:{liefertermin} ', 'auto', TEMPLATES as never)).toEqual({
      value: '$record:{liefertermin}',
      type: 'date',
    });
  });

  it('is text once text is written around the template, and the template\'s type again when it is gone', () => {
    expect(templateTextValue('Pos. $record:{pos}', 'any', TEMPLATES as never)).toEqual({
      value: 'Pos. $record:{pos}',
      type: 'string',
    });
    expect(templateTextValue('$record:{pos}', 'any', TEMPLATES as never).type).toBe('int');
  });

  it("keeps a typed field's type for a lone template", () => {
    expect(templateTextValue('$record:{pos}', 'int', TEMPLATES as never)).toEqual({ value: '$record:{pos}', type: 'int' });
  });

  it("is a scalar's literal when the text writes one", () => {
    expect(templateTextValue('12', 'int')).toEqual({ value: 12, type: 'int' });
    expect(templateTextValue(' -3.5 ', 'number')).toEqual({ value: -3.5, type: 'number' });
    expect(templateTextValue('True', 'bool')).toEqual({ value: true, type: 'bool' });
    expect(scalarLiteral('12abc', 'int')).toBeUndefined();
    expect(scalarLiteral('1.5', 'int')).toBeUndefined();
  });

  it('is the text as written in a typed field it does not fit, for the field to say so', () => {
    expect(templateTextValue('$record:{pos} items', 'int', TEMPLATES as never)).toEqual({
      value: '$record:{pos} items',
      type: 'int',
    });
  });

  /* qorus#646 (David): typed options open on their own control - a checkbox, a number input, the date
     picker - and take a template or an expression through "Use Template / Expression". Text and untyped
     values keep the text field with chips. */
  it('is written as text for text and untyped values only, not for a typed one', () => {
    expect(['string', 'any', 'auto'].every((t) => isWrittenAsText(t))).toBe(true);
    expect(['int', 'number', 'bool', 'date', 'hash'].some((t) => isWrittenAsText(t))).toBe(false);
  });
});

const show = (props: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <TemplateField
          name='value'
          allowTemplates
          allowCustomValues
          templates={TEMPLATES as never}
          filterTemplatesByType={false}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('a typed field', () => {
  it('opens on its own control, not on a text field', async () => {
    for (const [type, value] of [['int', 12], ['number', 3.5], ['bool', true]] as const) {
      const { container, unmount } = show({ type, value, componentFromType: true });
      await waitFor(() => expect(container.querySelector('input, .reqore-checkbox')).not.toBeNull());
      expect(container.querySelector('[data-slate-editor]')).toBeNull();
      unmount();
    }
  });

  it('holding a template, and taking no expressions, shows it in the template control', async () => {
    const { container } = show({ type: 'int', value: '$record:{pos}', componentFromType: true });
    await waitFor(() => expect(container.textContent).toContain('pos'));
    expect(container.querySelector('[data-slate-editor]')).toBeNull();
  });
});

describe('a date field holding a template', () => {
  it('keeps the template control: a date is not written as text', async () => {
    const { container } = show({ type: 'date', value: '$record:{liefertermin}', componentFromType: true });
    await waitFor(() => expect(container.textContent).toContain('liefertermin'));
    expect(container.querySelector('[data-slate-editor]')).toBeNull();
  });
});

describe('an empty date field with templates on offer', () => {
  it('opens on its date control: a template goes in through the field menu, not a button of its own', async () => {
    const { container } = show({ type: 'date', value: undefined, componentFromType: true });
    await waitFor(() => expect(container.querySelector('input')).not.toBeNull());
    expect(container.querySelector('[data-slate-editor]')).toBeNull();
    expect(container.querySelector('[aria-label="Use a template"]')).toBeNull();
  });
});

/**
 * qorus#646 (David): an untyped field holding null showed an empty text field - the same as a field
 * holding nothing - so the author could not tell the two apart. null is written `null`, and `null`
 * written in an untyped field is null; an empty field is no value at all.
 */
describe('null in an untyped field', () => {
  it('is written null, and null written there is null', () => {
    expect(templateTextValue('null', 'any', TEMPLATES)).toEqual({ value: null, type: 'any' });
    expect(templateTextValue(' null ', 'auto', TEMPLATES)).toEqual({ value: null, type: 'auto' });
  });

  it('is only that: text with null in it is text, and null is text in a text field', () => {
    expect(templateTextValue('null value', 'any', TEMPLATES)).toEqual({ value: 'null value', type: 'string' });
    expect(templateTextValue('null', 'string', TEMPLATES)).toEqual({ value: 'null', type: 'string' });
  });

  it('shows as null, not as an empty field', async () => {
    const { container } = show({ type: 'any', value: null, filterTemplatesByType: false });
    await waitFor(() => expect(container.querySelector('[data-slate-editor]')).not.toBeNull());
    await waitFor(() =>
      expect(container.querySelector('[data-slate-editor]')?.textContent?.replace(/\uFEFF/g, '').trim()).toBe('null')
    );
  });

  it('is told from an empty field, which shows nothing', async () => {
    const { container } = show({ type: 'any', value: undefined, filterTemplatesByType: false });
    await waitFor(() => expect(container.querySelector('[data-slate-editor]')).not.toBeNull());
    expect(container.querySelector('[data-slate-editor]')?.textContent?.replace(/\uFEFF/g, '').trim()).toBe('');
  });
});

/**
 * qorus#646 (David): in a yes/no field, a chip of the whole-number field pos read "record: pos", where every
 * other field's chip reads "pos". The text field named its chips from the list it offers, which a typed
 * field filters to its own type: pos is not on a yes/no field's list, so its chip fell back to the
 * reference's path. A chip is named from the whole catalogue; only the list offered is filtered.
 */
describe("a chip of a field not of the value's type", () => {
  // a field whose host offers only some of the catalogue (a filter of its own): a field in its value that is
  // not on offer is still named as the catalogue names it
  for (const type of ['string', 'any']) {
    it(`is named as the catalogue names it, in a ${type} field offering only some fields`, async () => {
      const { container } = show({
        type,
        value: '$record:{pos} x',
        filterTemplatesFunc: (templates: { items?: unknown[] }) => ({ ...templates, items: [] }),
      });
      await waitFor(() => expect(container.querySelector('[data-slate-editor] .reqore-tag')).not.toBeNull());
      const chip = container.querySelector('[data-slate-editor] .reqore-tag')?.textContent?.replace(/\uFEFF/g, '');
      expect(chip).toContain('pos');
      expect(chip).not.toContain('record');
    });
  }
});

/**
 * qorus#646 (David): "Clear value" on an added yes/no holding the field pos had no effect - the draft was
 * cleared, the field still showed pos. The text field keeps its own copy of the text, and nothing set it
 * when the value was emptied from outside the editor (the card's "Clear value", an undo, a host reset).
 */
describe('a value written as text, cleared from outside its editor', () => {
  const holder = (props: Record<string, unknown>) => (
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <TemplateField
          name='value'
          allowTemplates
          allowCustomValues
          componentFromType
          templates={TEMPLATES as never}
          filterTemplatesByType={false}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  const shown = (container: HTMLElement) =>
    container.querySelector('[data-slate-editor]')?.textContent?.replace(/\uFEFF/g, '').trim() ?? '';

  for (const [type, cleared] of [
    ['string', undefined],
    ['string', ''],
    ['any', undefined],
  ] as const) {
    it(`shows nothing once its ${type} value is ${JSON.stringify(cleared)}`, async () => {
      const { container, rerender } = render(holder({ type, value: '$record:{pos}' }));
      await waitFor(() => expect(shown(container)).toContain('pos'));
      rerender(holder({ type, value: cleared }));
      await waitFor(() => expect(container.textContent).not.toContain('pos'));
    });
  }
});
