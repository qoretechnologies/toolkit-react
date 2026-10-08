// Copyright 2026 Qore Technologies, s.r.o.
// Value · Expression · Visual (qorus#646, David): a form option's value is entered on tabs - one value, three
// views - or on Value · Template where the option takes templates only.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

/** How the fake language server answers: up, or not there at all. */
const lsp = { available: true };

/* The Text view's editor, standing in for the DPQL editor: it shows its text, parses a lone template as the
   server does (the `template` operation), and reports when there is no language server. */
vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ value, onChange, onUnavailable, onReady }, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        parse: async (text: string) =>
          /^\$[a-z]+:\{[^}]*\}$/.test(text) ?
            {
              success: true,
              expression: {
                is_expression: true,
                value: {
                  exp: 'template',
                  args: [
                    {
                      type: 'auto',
                      value: { tmpl_context: 'record', tmpl_value: 'pos', raw: text },
                    },
                  ],
                },
              },
            }
          : /\+/.test(text) ?
            {
              success: true,
              expression: {
                is_expression: true,
                value: {
                  exp: '+',
                  args: text
                    .split('+')
                    .map((part) => ({ type: 'int', value: Number(part.trim()) })),
                },
              },
            }
          : {
              success: true,
              expression: {
                is_expression: true,
                value: { exp: 'value', args: [{ type: 'int', value: Number(text) }] },
              },
            },
        serialize: async () => '',
      }),
      []
    );
    useEffect(() => {
      if (!lsp.available) onUnavailable?.();
      else onReady?.();
    }, []);
    return (
      <textarea
        data-testid='dpql-text'
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }),
}));

import { RowMenuContext } from '../src/components/form/engine/rowMenuContext';
import {
  ITemplateFieldProps,
  TemplateField,
} from '../src/components/form/fields/template/TemplateField';
import {
  expressionTextOfValue,
  isWrittenAsTextOnTheValueTab,
  loneTemplateOf,
  loneValueOf,
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
      ],
    },
  ],
};
const EXPRESSIONS = [
  {
    name: 'value',
    display_name: 'Value',
    return_type: 'any',
    args: [{ name: 'v', ui_type: 'any' }],
  },
];

const published: Record<string, IReqoreDropdownItem[]> = {};
const registry = {
  registerRowMenuItems: (id: string, _key: string, items: IReqoreDropdownItem[]) => {
    published[id] = items;
  },
  unregisterRowMenuItems: (id: string) => {
    delete published[id];
  },
};
const menuLabels = () =>
  Object.values(published)
    .flat()
    .map((item) => String((item as { label?: unknown }).label ?? ''));

/** A form option's field, with what it holds kept as a form keeps it. */
const Host = ({
  initial,
  isFunction = false,
  onChange,
  ...props
}: Partial<ITemplateFieldProps> & { initial: unknown; isFunction?: boolean }) => {
  const [state, setState] = useState<{ value: unknown; isFunction: boolean }>({
    value: initial,
    isFunction,
  });
  return (
    <TemplateField
      name='value'
      allowTemplates
      allowCustomValues
      componentFromType
      allowFunctions
      allowTextExpressions
      valueTabs
      templates={TEMPLATES as never}
      filterTemplatesByType={false}
      expressions={EXPRESSIONS as never}
      {...props}
      value={state.value}
      isFunction={state.isFunction}
      onChange={(name: string, value: unknown, type?: string, fn?: boolean) => {
        onChange?.(name, value, type as never, fn);
        setState({ value, isFunction: !!fn });
      }}
    />
  );
};

const show = (props: Partial<ITemplateFieldProps> & { initial: unknown; isFunction?: boolean }) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <RowMenuContext.Provider value={registry}>
          <Host {...props} />
        </RowMenuContext.Provider>
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const tabs = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('.value-tab')].map((tab) =>
    tab.getAttribute('data-tab')
  );
const activeTab = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.value-tab[aria-pressed="true"]')?.getAttribute('data-tab');
const clickTab = (container: HTMLElement, label: string) =>
  act(() => {
    fireEvent.click(container.querySelector<HTMLElement>(`.value-tab[data-tab="${label}"]`)!);
  });

beforeEach(() => {
  for (const key of Object.keys(published)) delete published[key];
  lsp.available = true;
});

describe('the tabs a form option offers', () => {
  it('are Value, Expression and Visual where it takes templates and expressions', async () => {
    const { container } = show({ type: 'int' as never, initial: 12 });
    await waitFor(() => expect(tabs(container)).toEqual(['value', 'expression', 'visual']));
  });

  it('are Value and Template where it takes templates only', async () => {
    const { container } = show({ type: 'int' as never, initial: 12, allowFunctions: false });
    await waitFor(() => expect(tabs(container)).toEqual(['value', 'template']));
  });

  it('are none where it takes no templates', async () => {
    const { container } = show({ type: 'int' as never, initial: 12, allowTemplates: false });
    await waitFor(() =>
      expect(container.querySelector('input, [data-slate-editor]')).not.toBeNull()
    );
    expect(tabs(container)).toEqual([]);
  });

  it('leave the field menu with value actions only - no mode switches', async () => {
    show({ type: 'int' as never, initial: '$record:{pos}' });
    // the field has published its menu
    await waitFor(() => expect(Object.keys(published)).toHaveLength(1));
    for (const mode of [
      'Use Template',
      'Use Expression',
      'Use Custom Value',
      'Use Template / Expression',
    ]) {
      expect(menuLabels()).not.toContain(mode);
    }
  });
});

describe('the words of the tabs', () => {
  it("are the host's where it gives them, English where it does not", async () => {
    const { container } = show({
      type: 'int' as never,
      initial: {
        exp: '+',
        args: [
          { type: 'int', value: 1 },
          { type: 'int', value: 2 },
        ],
      },
      isFunction: true,
      valueTabsLabels: {
        value: 'Wert',
        expression: 'Ausdruck',
        cannotShowExpression: 'Dieser Ausdruck ist kein Wert.',
        replaceWithAValue: 'Durch einen Wert ersetzen',
      },
    });
    await waitFor(() => expect(activeTab(container)).toBe('expression'));
    const tab = (key: string) =>
      container.querySelector(`.value-tab[data-tab="${key}"]`)?.textContent;
    expect(tab('value')).toContain('Wert');
    expect(tab('expression')).toContain('Ausdruck');
    expect(tab('visual')).toContain('Visual');
    clickTab(container, 'value');
    await waitFor(() =>
      expect(container.querySelector('.value-tab-cannot-show')?.textContent).toContain(
        'Dieser Ausdruck ist kein Wert.'
      )
    );
    expect(container.querySelector('.value-tab-replace')?.textContent).toContain(
      'Durch einen Wert ersetzen'
    );
  });

  it("that hold a value are the host's functions of it", async () => {
    const { container } = show({
      type: 'int' as never,
      initial: '$record:{bezeichnung}',
      valueTabsLabels: {
        typeName: (type) => ({ string: 'Text', int: 'Ganzzahl' })[type] ?? type,
        conversion: (from, to) => `${from} wird in ${to} umgewandelt`,
      },
    });
    await waitFor(() =>
      expect(container.querySelector('.value-tab-conversion')?.textContent).toBe(
        'Text wird in Ganzzahl umgewandelt'
      )
    );
  });
});

describe('a saved value opens on its tab', () => {
  it('a literal on Value, written as text for a whole number', async () => {
    const { container } = show({ type: 'int' as never, initial: 12 });
    await waitFor(() => expect(activeTab(container)).toBe('value'));
    await waitFor(() =>
      expect(container.querySelector('.value-tab-text [data-slate-editor]')?.textContent).toContain(
        '12'
      )
    );
  });

  it('a template on Value as a chip, for text, a number or a whole number', async () => {
    for (const type of ['string', 'number', 'int']) {
      const { container, unmount } = show({ type: type as never, initial: '$record:{pos}' });
      await waitFor(() => expect(activeTab(container)).toBe('value'));
      await waitFor(() =>
        expect(
          container.querySelector('.value-tab-text [data-slate-editor]')?.textContent
        ).toContain('pos')
      );
      unmount();
    }
  });

  it('a template on Expression for a yes / no, a date or fixed choices', async () => {
    for (const type of ['bool', 'date']) {
      const { container, unmount } = show({ type: type as never, initial: '$record:{pos}' });
      await waitFor(() => expect(activeTab(container)).toBe('expression'));
      await waitFor(() =>
        expect(
          (container.querySelector('[data-testid="dpql-text"]') as HTMLTextAreaElement)?.value
        ).toBe('$record:{pos}')
      );
      unmount();
    }
  });

  it('a template on Template where the option takes templates only', async () => {
    const { container } = show({
      type: 'bool' as never,
      initial: '$record:{pos}',
      allowFunctions: false,
    });
    await waitFor(() => expect(activeTab(container)).toBe('template'));
  });

  it('text with templates on Value', async () => {
    const { container } = show({ type: 'string' as never, initial: 'SUP-$record:{pos}' });
    await waitFor(() => expect(activeTab(container)).toBe('value'));
    await waitFor(() =>
      expect(container.querySelector('.value-tab-text [data-slate-editor]')?.textContent).toContain(
        'SUP-'
      )
    );
  });

  it('an expression on Expression', async () => {
    const { container } = show({
      type: 'int' as never,
      initial: {
        exp: '+',
        args: [
          { type: 'int', value: 1 },
          { type: 'int', value: 2 },
        ],
      },
      isFunction: true,
    });
    await waitFor(() => expect(activeTab(container)).toBe('expression'));
  });

  it('a whole number and a number are written on a numeric keyboard, text on any', async () => {
    for (const [type, mode] of [
      ['int', 'numeric'],
      ['number', 'decimal'],
      ['string', null],
    ] as const) {
      const { container, unmount } = show({
        type: type as never,
        initial: type === 'string' ? 'x' : 12,
      });
      const editor = await waitFor(() => {
        const el = container.querySelector(
          '.value-tab-text[data-slate-editor], .value-tab-text [data-slate-editor]'
        );
        expect(el, type).toBeTruthy();
        return el as HTMLElement;
      });
      expect(editor.getAttribute('inputmode'), type).toBe(mode);
      unmount();
    }
  });

  it('a yes / no on its own control', async () => {
    const { container } = show({ type: 'bool' as never, initial: true });
    await waitFor(() => expect(activeTab(container)).toBe('value'));
    await waitFor(() => expect(container.querySelector('.reqore-checkbox')).not.toBeNull());
    expect(container.querySelector('[data-slate-editor]')).toBeNull();
  });
});

describe('one value, three views', () => {
  it('Value to Expression writes the value as expression text, and changes nothing yet', async () => {
    const onChange = vi.fn();
    const { container, getByTestId } = show({
      type: 'string' as never,
      initial: 'SUP-$record:{pos}',
      onChange,
    });
    await waitFor(() => expect(activeTab(container)).toBe('value'));
    clickTab(container, 'expression');
    await waitFor(() =>
      expect((getByTestId('dpql-text') as HTMLTextAreaElement).value).toBe(
        'concat("SUP-", $record:{pos})'
      )
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Visual starts from the value as the server reads it alone: value(12), changing nothing', async () => {
    const onChange = vi.fn();
    const { container } = show({ type: 'int' as never, initial: 12, onChange });
    clickTab(container, 'visual');
    await waitFor(() => expect(container.querySelector('.expression')).not.toBeNull());
    await waitFor(() =>
      expect(container.querySelector('.expression')?.textContent).toContain('Value')
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an empty value opens the Expression tab empty', async () => {
    for (const initial of ['', undefined]) {
      const { container, getByTestId, unmount } = show({ type: 'number' as never, initial });
      clickTab(container, 'expression');
      await waitFor(() => expect((getByTestId('dpql-text') as HTMLTextAreaElement).value).toBe(''));
      unmount();
    }
  });

  it('Expression to Value converts a lone value', async () => {
    const onChange = vi.fn();
    const { container } = show({
      type: 'int' as never,
      initial: { exp: 'value', args: [{ type: 'int', value: 15 }] },
      isFunction: true,
      onChange,
    });
    await waitFor(() => expect(activeTab(container)).toBe('expression'));
    clickTab(container, 'value');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('value', 15, 'int', false));
    await waitFor(() =>
      expect(container.querySelector('.value-tab-text [data-slate-editor]')?.textContent).toContain(
        '15'
      )
    );
  });

  it('Expression to Value refuses another expression, says so, and offers to replace it', async () => {
    const onChange = vi.fn();
    const { container } = show({
      type: 'int' as never,
      initial: {
        exp: '+',
        args: [
          { type: 'int', value: 1 },
          { type: 'int', value: 2 },
        ],
      },
      isFunction: true,
      onChange,
    });
    await waitFor(() => expect(activeTab(container)).toBe('expression'));
    clickTab(container, 'value');
    await waitFor(() => expect(container.querySelector('.value-tab-cannot-show')).not.toBeNull());
    // nothing lost: the expression is still what the field holds
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.value-tab-replace') as HTMLElement);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('value', undefined, 'int', false));
  });

  it('a lone value written on the Expression tab is held as that value', async () => {
    const onChange = vi.fn();
    const { container, getByTestId } = show({ type: 'int' as never, initial: 12, onChange });
    clickTab(container, 'expression');
    const text = await waitFor(() => getByTestId('dpql-text') as HTMLTextAreaElement);
    fireEvent.change(text, { target: { value: '15' } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('value', 15, 'int', false));
    // and the text being written stays, once the field has rendered the value it now holds
    await act(async () => {});
    expect((getByTestId('dpql-text') as HTMLTextAreaElement).value).toBe('15');
  });

  /* Typed on the Expression tab and the Value tab opened straight away, before the text has been read: what was
     typed is read first, not lost (qorus#646, found clicking through the review in the IDE). */
  it('what was typed on the Expression tab is kept when the Value tab is opened straight after', async () => {
    const onChange = vi.fn();
    const { container, getByTestId } = show({ type: 'int' as never, initial: 12, onChange });
    clickTab(container, 'expression');
    const text = await waitFor(() => getByTestId('dpql-text') as HTMLTextAreaElement);
    fireEvent.change(text, { target: { value: '15' } });
    clickTab(container, 'value');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('value', 15, 'int', false));
    await waitFor(() => expect(activeTab(container)).toBe('value'));
  });

  it('an expression typed on the Expression tab is kept when the Value tab is opened straight after', async () => {
    const onChange = vi.fn();
    const { container, getByTestId } = show({ type: 'int' as never, initial: 12, onChange });
    clickTab(container, 'expression');
    const text = await waitFor(() => getByTestId('dpql-text') as HTMLTextAreaElement);
    fireEvent.change(text, { target: { value: '1 + 2' } });
    clickTab(container, 'value');
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        'value',
        {
          exp: '+',
          args: [
            { type: 'int', value: 1 },
            { type: 'int', value: 2 },
          ],
        },
        expect.anything(),
        true
      )
    );
    await waitFor(() => expect(container.querySelector('.value-tab-cannot-show')).not.toBeNull());
  });

  it('a template on a yes / no cannot be shown on Value: it says where it is shown', async () => {
    const { container } = show({ type: 'bool' as never, initial: '$record:{pos}' });
    await waitFor(() => expect(activeTab(container)).toBe('expression'));
    clickTab(container, 'value');
    await waitFor(() =>
      expect(container.querySelector('.value-tab-cannot-show')?.textContent).toContain(
        'Expression tab'
      )
    );
  });
});

describe('a template of another type than the field', () => {
  it('is a warning, not a block: it is converted when the value is used', async () => {
    const { container } = show({ type: 'int' as never, initial: '$record:{bezeichnung}' });
    await waitFor(() =>
      expect(container.querySelector('.value-tab-conversion')?.textContent).toContain(
        'Text is converted to a whole number'
      )
    );
  });

  it('of the same kind, says nothing', async () => {
    const { container } = show({ type: 'number' as never, initial: '$record:{pos}' });
    await waitFor(() => expect(container.querySelector('.value-tab-text')).not.toBeNull());
    expect(container.querySelector('.value-tab-conversion')).toBeNull();
  });
});

describe('the Expression tab without a language server', () => {
  it('moves to the Visual tab', async () => {
    lsp.available = false;
    const { container } = show({
      type: 'int' as never,
      initial: {
        exp: '+',
        args: [
          { type: 'int', value: 1 },
          { type: 'int', value: 2 },
        ],
      },
      isFunction: true,
    });
    await waitFor(() => expect(activeTab(container)).toBe('visual'));
    expect(container.querySelector('[data-testid="dpql-text"]')).toBeNull();
  });
});

describe('what the Value tab writes as text', () => {
  /* qorus#646 (David): text, untyped values, whole numbers and numbers - templates as chips, expressions
     detected; a yes / no, a date and fixed choices keep their own control. */
  it('is text, untyped values, whole numbers and numbers - not a yes / no or a date', () => {
    expect(
      ['string', 'any', 'auto', 'int', 'softint', 'number', 'float'].every((t) =>
        isWrittenAsTextOnTheValueTab(t)
      )
    ).toBe(true);
    expect(
      ['bool', 'softbool', 'date', 'hash', 'list'].some((t) => isWrittenAsTextOnTheValueTab(t))
    ).toBe(false);
  });
});

describe('the server parse result', () => {
  it('reads a lone template and a lone value as themselves', () => {
    expect(
      loneTemplateOf({
        is_expression: true,
        value: {
          exp: 'template',
          args: [
            { type: 'auto', value: { tmpl_context: 'local', tmpl_value: 'x', raw: '$local:x' } },
          ],
        },
      })
    ).toBe('$local:x');
    expect(
      loneValueOf({
        is_expression: true,
        value: { exp: 'value', args: [{ type: 'int', value: 15 }] },
      })
    ).toEqual({ value: 15 });
    expect(loneValueOf({ is_expression: true, value: { exp: '+', args: [] } })).toBeUndefined();
    expect(
      loneValueOf({
        is_expression: true,
        value: { exp: 'value', args: [{ type: 'int', value: '$record:{pos}' }] },
      })
    ).toBeUndefined();
  });

  it('writes a value as expression text', () => {
    // nothing is nothing to write: an empty value opens the Expression tab empty, not on concat()
    expect(expressionTextOfValue('')).toBe('');
    expect(expressionTextOfValue(undefined)).toBe('');
    expect(expressionTextOfValue(12)).toBe('12');
    expect(expressionTextOfValue(true)).toBe('true');
    expect(expressionTextOfValue('open')).toBe('"open"');
    expect(expressionTextOfValue('$record:{pos}')).toBe('$record:{pos}');
    expect(expressionTextOfValue('SUP-$record:{pos}-X')).toBe(
      'concat("SUP-", $record:{pos}, "-X")'
    );
  });
});
