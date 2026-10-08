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

  it('is written as text for text, untyped and scalar types - not a date', () => {
    expect(['string', 'any', 'auto', 'int', 'number', 'bool'].every((t) => isWrittenAsText(t))).toBe(true);
    expect(isWrittenAsText('date')).toBe(false);
    expect(isWrittenAsText('hash')).toBe(false);
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

describe('a whole-number field holding a template', () => {
  it('shows it in the text it is written in, as a chip, not in a pick-only selector', async () => {
    const { container } = show({ type: 'int', value: '$record:{pos}' });
    await waitFor(() => expect(container.querySelector('[data-slate-editor]')).not.toBeNull());
    expect(container.querySelector('[data-slate-editor]')?.textContent).toContain('pos');
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
  it('keeps its date control and offers the templates beside it', async () => {
    const { container } = show({ type: 'date', value: undefined, componentFromType: true });
    await waitFor(() => expect(container.querySelector('[aria-label="Use a template"]')).not.toBeNull());
    // the date control, not a text field
    expect(container.querySelector('[data-slate-editor]')).toBeNull();
    expect(container.querySelector('input')).not.toBeNull();
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
      expect(container.querySelector('[data-slate-editor]')?.textContent?.replace(/﻿/g, '').trim()).toBe('null')
    );
  });

  it('is told from an empty field, which shows nothing', async () => {
    const { container } = show({ type: 'any', value: undefined, filterTemplatesByType: false });
    await waitFor(() => expect(container.querySelector('[data-slate-editor]')).not.toBeNull());
    expect(container.querySelector('[data-slate-editor]')?.textContent?.replace(/﻿/g, '').trim()).toBe('');
  });
});
