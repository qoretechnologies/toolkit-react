// Copyright 2026 Qore Technologies, s.r.o.
// A number field reports the kind of number its type holds (qorus#646): the auto field and the template
// field's type-picked editor handed the number field no kind, so it took every number for a whole one, and a
// float field reported `12.5` as the text "12.5".
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { numberKindOf } from '../src/components/form/fields/number/Number';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

describe('numberKindOf', () => {
  it.each([
    ['float', 'float'],
    ['softfloat', 'float'],
    ['*float', 'float'],
    ['number', 'float'],
    ['softnumber', 'float'],
    ['int', 'int'],
    ['integer', 'int'],
    ['*softint', 'int'],
    [undefined, 'int'],
  ])('reads %s as %s', (type, kind) => {
    expect(numberKindOf(type)).toBe(kind);
  });
});

const typeInto = async (container: HTMLElement, text: string) => {
  const input = await waitFor(() => {
    const element = container.querySelector<HTMLInputElement>('input');
    expect(element).toBeTruthy();
    return element!;
  });
  fireEvent.change(input, { target: { value: text } });
};

/** A form with one number row of `type`, opened. */
const renderRow = async (type: string) => {
  const onChange = vi.fn();
  const view = render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='kind'
          value={{} as never}
          options={{ amount: { type, ui_type: type, display_name: 'Amount' } } as never}
          onChange={onChange}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  await waitFor(() => expect(view.container.querySelector('[data-field="amount"]')).toBeTruthy());
  fireEvent.click(view.container.querySelector('[data-field="amount"]')!);
  return { onChange, ...view };
};

/** Every value the form handed its host for the row. */
const reported = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.map(([, value]) => (value as Record<string, any> | undefined)?.amount?.value);

describe('the auto field in a form', () => {
  it.each([
    ['float', '12.5', 12.5],
    ['number', '12.5', 12.5],
    ['int', '42', 42],
  ])('reports what is typed into a %s row as the number', async (type, text, number) => {
    const { container, onChange } = await renderRow(type);

    await typeInto(container, text);

    await waitFor(() => expect(reported(onChange)).toContain(number));
  });

  it('still reports a decimal typed into a whole-number row as typed, for the form to flag', async () => {
    const { container, onChange } = await renderRow('int');

    await typeInto(container, '12.5');

    await waitFor(() => expect(reported(onChange)).toContain('12.5'));
  });
});

describe("the template field's editor picked by type", () => {
  it('reports what is typed into a float field as the number', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <TemplateField name='ratio' type='float' componentFromType onChange={onChange} />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await typeInto(container, '0.75');

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('ratio', 0.75));
  });
});
