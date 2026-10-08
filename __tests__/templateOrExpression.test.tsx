// Copyright 2026 Qore Technologies, s.r.o.
// "Use Template / Expression" (qorus#646, David): a typed option opens on its own control, and one field menu
// action opens the expression editor's Text view for a template or an expression.
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
  DpqlEditor: forwardRef<any, any>(({ value, onChange, onUnavailable }, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        parse: async (text: string) =>
          /^\$[a-z]+:\{[^}]*\}$/.test(text)
            ? {
                success: true,
                expression: {
                  is_expression: true,
                  value: { exp: 'template', args: [{ type: 'auto', value: { tmpl_context: 'record', tmpl_value: 'pos', raw: text } }] },
                },
              }
            : /\+/.test(text)
              ? {
                  success: true,
                  expression: {
                    is_expression: true,
                    value: { exp: '+', args: text.split('+').map((part) => ({ type: 'int', value: Number(part.trim()) })) },
                  },
                }
              : { success: true, expression: { is_expression: true, value: { exp: 'value', args: [{ type: 'int', value: Number(text) }] } } },
        serialize: async () => '',
      }),
      []
    );
    useEffect(() => {
      if (!lsp.available) onUnavailable?.();
    }, []);
    return (
      <textarea data-testid='dpql-text' value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    );
  }),
}));

import { RowMenuContext } from '../src/components/form/engine/rowMenuContext';
import { ExpressionField } from '../src/components/form/expressions/ExpressionField';
import { ITemplateFieldProps, TemplateField } from '../src/components/form/fields/template/TemplateField';
import { expressionSeedOf, loneTemplateOf, loneValueOf } from '../src/components/form/fields/template/writtenAsText';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const TEMPLATES = {
  items: [{ label: 'Fields of the row', items: [{ label: 'pos', value: '$record:{pos}', badge: 'int' }] }],
};
const EXPRESSIONS = [{ name: 'value', display_name: 'Value', return_type: 'any', args: [{ name: 'v', ui_type: 'any' }] }];

const published: Record<string, IReqoreDropdownItem[]> = {};
const registry = {
  registerRowMenuItems: (id: string, _key: string, items: IReqoreDropdownItem[]) => {
    published[id] = items;
  },
  unregisterRowMenuItems: (id: string) => {
    delete published[id];
  },
};
const items = () => Object.values(published).flat() as { label?: unknown; onClick?: () => void }[];
const labels = () => items().map((item) => String(item.label ?? ''));

const field = (props: Partial<ITemplateFieldProps>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <RowMenuContext.Provider value={registry}>
          <TemplateField
            name='value'
            allowTemplates
            allowCustomValues
            componentFromType
            templates={TEMPLATES as never}
            filterTemplatesByType={false}
            expressions={EXPRESSIONS as never}
            onChange={vi.fn()}
            {...props}
          />
        </RowMenuContext.Provider>
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

beforeEach(() => {
  for (const key of Object.keys(published)) delete published[key];
  lsp.available = true;
});

describe('the field menu of an option that takes templates and expressions', () => {
  it('offers one action, "Use Template / Expression", not one for each', async () => {
    field({ type: 'int' as never, value: 12, allowFunctions: true, allowTextExpressions: true });
    await waitFor(() => expect(labels()).toContain('Use Template / Expression'));
    expect(labels()).not.toContain('Use Template');
    expect(labels()).not.toContain('Use Expression');
  });

  it('opens the Text view, seeded with what the field holds, and emits nothing yet', async () => {
    const onChange = vi.fn();
    const { container, getByTestId } = field({
      type: 'int' as never,
      value: 12,
      allowFunctions: true,
      allowTextExpressions: true,
      onChange,
    });
    await waitFor(() => expect(labels()).toContain('Use Template / Expression'));
    act(() => items().find((item) => item.label === 'Use Template / Expression')!.onClick!());
    await waitFor(() => expect(container.querySelector('.expression-field')).not.toBeNull());
    expect((getByTestId('dpql-text') as HTMLTextAreaElement).value).toBe('12');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('a template-only option', () => {
  it('keeps "Use Template", the picker, and the bare template it stores', async () => {
    field({ type: 'int' as never, value: 12, allowFunctions: false });
    await waitFor(() => expect(labels()).toContain('Use Template'));
    expect(labels()).not.toContain('Use Template / Expression');
  });
});

describe('a saved template in a typed option that takes expressions', () => {
  it('opens in the Text view as the template, rewriting nothing', async () => {
    const onChange = vi.fn();
    const { container, getByTestId } = field({
      type: 'int' as never,
      value: '$record:{pos}',
      allowFunctions: true,
      allowTextExpressions: true,
      onChange,
    });
    await waitFor(() => expect(container.querySelector('.expression-field')).not.toBeNull());
    expect((getByTestId('dpql-text') as HTMLTextAreaElement).value).toBe('$record:{pos}');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('a lone template written in the Text view', () => {
  it('is stored as the bare template, not an expression wrapping it', async () => {
    const onChange = vi.fn();
    const { getByTestId } = field({
      type: 'int' as never,
      value: 12,
      allowFunctions: true,
      allowTextExpressions: true,
      onChange,
    });
    await waitFor(() => expect(labels()).toContain('Use Template / Expression'));
    act(() => items().find((item) => item.label === 'Use Template / Expression')!.onClick!());
    const text = await waitFor(() => getByTestId('dpql-text') as HTMLTextAreaElement);
    fireEvent.change(text, { target: { value: '$record:{pos}' } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('value', '$record:{pos}', 'int', false));
  });

  it('is read out of the server parse result as the template it is', () => {
    expect(
      loneTemplateOf({
        is_expression: true,
        value: { exp: 'template', args: [{ type: 'auto', value: { tmpl_context: 'local', tmpl_value: 'x', raw: '$local:x' } }] },
      })
    ).toBe('$local:x');
    expect(loneTemplateOf({ is_expression: true, value: { exp: '+', args: [] } })).toBeUndefined();
  });

  it('seeds the Text view as written', () => {
    expect(expressionSeedOf('$local:x')).toBe('$local:x');
    expect(expressionSeedOf(12)).toBe('12');
    expect(expressionSeedOf(true)).toBe('true');
    expect(expressionSeedOf('just text')).toBe('');
  });
});

describe('the Text view without a language server', () => {
  it('falls back to the Visual view, and says why', async () => {
    lsp.available = false;
    const { container, queryByTestId } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <ExpressionField
            value={{ is_expression: true, value: undefined } as never}
            onChange={vi.fn()}
            expressions={EXPRESSIONS as never}
            defaultMode='text'
            initialText='12'
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(container.querySelector('.expression-text-unavailable')).not.toBeNull());
    expect(queryByTestId('dpql-text')).toBeNull();
  });
});

describe("the Text view's template picker", () => {
  it('offers the field\'s templates and puts the one chosen into the text', async () => {
    const { container, getByTestId } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <ExpressionField
            value={{ is_expression: true, value: undefined } as never}
            onChange={vi.fn()}
            expressions={EXPRESSIONS as never}
            localTemplates={{ items: [{ label: 'pos', value: '$record:{pos}' }] } as never}
            defaultMode='text'
            initialText='1 +'
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    const picker = await waitFor(() => {
      const el = container.querySelector<HTMLElement>('.expression-text-template-picker');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    fireEvent.click(picker);
    const item = await waitFor(() => {
      const el = [...document.querySelectorAll<HTMLElement>('.reqore-menu-item')].find((i) => i.textContent?.includes('pos'));
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    fireEvent.click(item);
    await waitFor(() => expect((getByTestId('dpql-text') as HTMLTextAreaElement).value).toBe('1 + $record:{pos}'));
  });
});

describe('a lone value written in the Text view', () => {
  it('is stored as the value it is, not an expression wrapping it', async () => {
    const onChange = vi.fn();
    const { getByTestId } = field({
      type: 'int' as never,
      value: 12,
      allowFunctions: true,
      allowTextExpressions: true,
      onChange,
    });
    await waitFor(() => expect(labels()).toContain('Use Template / Expression'));
    act(() => items().find((item) => item.label === 'Use Template / Expression')!.onClick!());
    const text = await waitFor(() => getByTestId('dpql-text') as HTMLTextAreaElement);
    fireEvent.change(text, { target: { value: '15' } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('value', 15, 'int', false));
  });

  it('is read out of the server parse result as the value it is', () => {
    expect(loneValueOf({ is_expression: true, value: { exp: 'value', args: [{ type: 'int', value: 15 }] } })).toEqual({
      value: 15,
    });
    expect(loneValueOf({ is_expression: true, value: { exp: 'value', args: [{ type: 'bool', value: false }] } })).toEqual({
      value: false,
    });
    expect(loneValueOf({ is_expression: true, value: { exp: '+', args: [] } })).toBeUndefined();
    // a field of the record is not a value: it is an expression of the row
    expect(
      loneValueOf({ is_expression: true, value: { exp: 'value', args: [{ type: 'int', value: '$record:{pos}' }] } })
    ).toBeUndefined();
  });
});

describe('the Text view of a field going from an expression to a value', () => {
  it('keeps the text being written: the value is held, not cleared', async () => {
    const Host = () => {
      const [state, setState] = useState<{ value: unknown; isFunction: boolean }>({ value: 12, isFunction: false });
      return (
        <ReqoreUIProvider>
          <FetchContext.Provider value={emptyFetchContext()}>
            <RowMenuContext.Provider value={registry}>
              <TemplateField
                name='value'
                type={'int' as never}
                allowTemplates
                allowCustomValues
                componentFromType
                allowFunctions
                allowTextExpressions
                templates={TEMPLATES as never}
                expressions={EXPRESSIONS as never}
                value={state.value}
                isFunction={state.isFunction}
                onChange={(_n: string, value: unknown, _t?: string, isFunction?: boolean) =>
                  setState({ value, isFunction: !!isFunction })
                }
              />
            </RowMenuContext.Provider>
          </FetchContext.Provider>
        </ReqoreUIProvider>
      );
    };
    const { getByTestId } = render(<Host />);
    await waitFor(() => expect(labels()).toContain('Use Template / Expression'));
    act(() => items().find((item) => item.label === 'Use Template / Expression')!.onClick!());
    const text = await waitFor(() => getByTestId('dpql-text') as HTMLTextAreaElement);
    // an expression first: the field holds it as an expression
    fireEvent.change(text, { target: { value: '1 + 2' } });
    await waitFor(() => expect((getByTestId('dpql-text') as HTMLTextAreaElement).value).toBe('1 + 2'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    // then a value: held as the value 15
    fireEvent.change(getByTestId('dpql-text'), { target: { value: '15' } });
    await waitFor(() => expect((getByTestId('dpql-text') as HTMLTextAreaElement).value).toBe('15'));
    // held as the value 15 now: the text written stays
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect((getByTestId('dpql-text') as HTMLTextAreaElement).value).toBe('15');
  });
});
