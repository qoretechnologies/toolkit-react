// Copyright 2026 Qore Technologies, s.r.o.
// Saved values and a template's badge (qorus#646): host seams of the template field - values the host keeps for
// reuse, offered in the field's ⋮, and where a template comes from, shown in the template picker.
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
  ITemplateFieldSavedValues,
  TemplateField,
} from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const TEMPLATES = {
  items: [
    {
      label: 'Fields of the row',
      items: [
        {
          label: 'pos',
          value: '$record:{pos}',
          badge: 'int',
          metadata: { app: 'erp', action: 'read' },
        },
        { label: 'bezeichnung', value: '$record:{bezeichnung}', badge: 'string' },
      ],
    },
  ],
};

const published: Record<string, IReqoreDropdownItem[]> = {};
const registry = {
  registerRowMenuItems: (id: string, _key: string, items: IReqoreDropdownItem[]) => {
    published[id] = items;
  },
  unregisterRowMenuItems: (id: string) => {
    delete published[id];
  },
};
const menu = () => Object.values(published).flat();
const item = (label: string) => menu().find((entry) => entry.label === label);

const Host = ({
  initial,
  onChange,
  ...props
}: Partial<ITemplateFieldProps> & { initial: unknown }) => {
  const [value, setValue] = useState<unknown>(initial);
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
      {...props}
      value={value}
      onChange={(name: string, next: unknown, type?: string, fn?: boolean) => {
        onChange?.(name, next, type as never, fn);
        setValue(next);
      }}
    />
  );
};

const show = (props: Partial<ITemplateFieldProps> & { initial: unknown }, inARow = true) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <RowMenuContext.Provider value={inARow ? registry : undefined}>
          <Host {...props} />
        </RowMenuContext.Provider>
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const saved = (over: Partial<ITemplateFieldSavedValues> = {}): ITemplateFieldSavedValues => ({
  items: [
    { id: 'a', label: 'Default quantity', description: 'A pallet', type: 'int', value: 48 },
    { id: 'b', label: 'Position', type: 'int', value: '$record:{pos}' },
    { id: 'c', label: 'Supplier', type: 'string', value: 'SUP-17' },
  ],
  onSave: vi.fn(),
  onRemove: vi.fn(),
  ...over,
});

beforeEach(() => {
  for (const key of Object.keys(published)) delete published[key];
  lsp.available = true;
});

describe('saving a value', () => {
  it('hands the value and the field type to the host', async () => {
    const savedValues = saved();
    show({ type: 'int' as never, initial: 12, savedValues });
    await waitFor(() => expect(item('Save this value')).toBeTruthy());
    act(() => (item('Save this value') as { onClick: () => void }).onClick());
    expect(savedValues.onSave).toHaveBeenCalledWith(12, 'int');
  });

  it('is not offered for an empty value, a yes / no, an expression or a read-only field', async () => {
    for (const props of [
      { type: 'int', initial: undefined },
      { type: 'bool', initial: true },
      { type: 'int', initial: { exp: '+', args: [] }, isFunction: true },
      { type: 'int', initial: 12, readOnly: true },
    ]) {
      for (const key of Object.keys(published)) delete published[key];
      const { unmount } = show({
        ...(props as Partial<ITemplateFieldProps> & { initial: unknown }),
        savedValues: saved(),
      });
      // the field has published its menu
      await waitFor(() => expect(Object.keys(published)).toHaveLength(1));
      expect(item('Save this value'), JSON.stringify(props)).toBeUndefined();
      unmount();
    }
  });

  it('is not offered where the host keeps no values', async () => {
    show({ type: 'int' as never, initial: 12, savedValues: saved({ onSave: undefined }) });
    // the field has published its menu
    await waitFor(() => expect(Object.keys(published)).toHaveLength(1));
    expect(item('Save this value')).toBeUndefined();
  });
});

describe('a saved value', () => {
  it('is offered in the fields of its type only', async () => {
    show({ type: 'int' as never, initial: undefined, savedValues: saved() });
    await waitFor(() => expect(item('Use a saved value')).toBeTruthy());
    expect((item('Use a saved value')!.items ?? []).map((entry) => entry.label)).toEqual([
      'Default quantity',
      'Position',
    ]);
  });

  it('is the value at once, on the Value tab', async () => {
    const onChange = vi.fn();
    const { container } = show({
      type: 'int' as never,
      initial: undefined,
      savedValues: saved(),
      onChange,
    });
    await waitFor(() => expect(item('Use a saved value')).toBeTruthy());
    const entry = item('Use a saved value')!.items!.find(
      (one) => one.label === 'Default quantity'
    )!;
    act(() => (entry.onClick as () => void)());
    expect(onChange).toHaveBeenCalledWith('value', 48, 'int', false);
    await waitFor(() =>
      expect(container.querySelector('[data-slate-editor].value-tab-text')?.textContent).toContain(
        '48'
      )
    );
  });

  it('is a template where it was one: on the Expression tab of a yes / no', async () => {
    const onChange = vi.fn();
    const { container } = show({
      type: 'bool' as never,
      initial: undefined,
      savedValues: saved({
        items: [{ id: 'p', label: 'Flag field', type: 'bool', value: '$record:{pos}' }],
      }),
      onChange,
    });
    await waitFor(() => expect(item('Use a saved value')).toBeTruthy());
    act(() => (item('Use a saved value')!.items![0].onClick as () => void)());
    expect(onChange).toHaveBeenCalledWith('value', '$record:{pos}', 'bool', false);
    await waitFor(() =>
      expect(
        container.querySelector('.value-tab[aria-pressed="true"]')?.getAttribute('data-tab')
      ).toBe('expression')
    );
  });

  it('can be removed, as the host keeps it', async () => {
    const savedValues = saved();
    show({ type: 'int' as never, initial: undefined, savedValues });
    await waitFor(() => expect(item('Use a saved value')).toBeTruthy());
    const entry = item('Use a saved value')!.items![0] as {
      rightAction: { onClick: (e: unknown) => void };
    };
    entry.rightAction.onClick({ stopPropagation: vi.fn() });
    expect(savedValues.onRemove).toHaveBeenCalledWith('a');
  });

  it("is in the field's own menu where it has no row to publish to", async () => {
    const savedValues = saved();
    const { container } = show({ type: 'int' as never, initial: 12, savedValues }, false);
    const more = await waitFor(() => {
      const el = container.querySelector<HTMLElement>('.template-more');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    fireEvent.click(more);
    const save = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.reqore-popover-content .save-value');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    fireEvent.click(save);
    expect(savedValues.onSave).toHaveBeenCalledWith(12, 'int');
    expect(document.querySelector('.reqore-popover-content .use-saved-value')).toBeTruthy();
  });

  it("says what it does in the host's words", async () => {
    show({
      type: 'int' as never,
      initial: 12,
      savedValues: saved({
        labels: { save: 'Wert speichern', use: 'Gespeicherten Wert verwenden' },
      }),
    });
    await waitFor(() => expect(item('Wert speichern')).toBeTruthy());
    expect(item('Gespeicherten Wert verwenden')).toBeTruthy();
  });
});

describe("a template's badge", () => {
  it('is what the host says, beside its name in the template picker', async () => {
    const templateBadge = vi.fn((template: { metadata?: { action?: string } }) =>
      template.metadata?.action ? { label: `Action: ${template.metadata.action}` } : undefined
    );
    const { container } = show(
      {
        type: 'bool' as never,
        initial: '$record:{pos}',
        allowFunctions: false,
        templateBadge: templateBadge as never,
      },
      false
    );
    await waitFor(() => expect(container.textContent).toContain('Action: read'));
    expect(templateBadge).toHaveBeenCalledWith(expect.objectContaining({ value: '$record:{pos}' }));
  });
});
