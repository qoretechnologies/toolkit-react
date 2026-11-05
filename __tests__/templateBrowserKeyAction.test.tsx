// Copyright 2026 Qore Technologies, s.r.o.
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The picker is drawn where the dropdown would draw it (see templateBrowserTakesWhole.test.tsx): Reqore's dropdown
   portal never opens in jsdom. */
vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ReqoreDropdown: (props: any) => <div data-testid='dropdown'>{props.customElements}</div>,
  };
});

const { ReqoreUIProvider } = await import('@qoretechnologies/reqore');
const { TemplateBrowser } = await import('../src/components/form/fields/template/TemplateBrowser');
const { TemplatePicker } = await import('../src/components/form/fields/template/TemplatePicker');
const { TemplateCatalogueProvider } = await import('../src/helpers/templateCatalogueContext');
const { withTemplateCatalogue } = await import('../src/helpers/templateCatalogue');

/**
 * A control that cannot be typed into (a template-only value, a number's input) writes a key for a context of free
 * keys with the row's Key action (David's decision): the row itself takes the whole value, and where a text can be
 * typed into, the key is typed and no such action is offered.
 */
const CATALOGUE = {
  contexts: [
    {
      name: 'dynamic',
      display_name: 'Dynamic data',
      kind: 'container',
      needs_arg: true,
      use_whole: true,
      whole_template: '$dynamic:*',
      free_form_keys: true,
    },
    {
      name: 'env',
      display_name: 'Environment',
      kind: 'container',
      needs_arg: true,
      use_whole: true,
      whole_template: '$env:*',
    },
  ],
} as never;

const renderBrowser = (pickerLabels?: Record<string, unknown>) => {
  const onItemSelect = vi.fn();
  const { container } = render(
    <ReqoreUIProvider>
      <TemplateCatalogueProvider catalogue={CATALOGUE} pickerLabels={pickerLabels as never}>
        <TemplateBrowser
          templates={{ items: [{ label: 'One', value: '$local:one' }] } as never}
          onItemSelect={onItemSelect}
        />
      </TemplateCatalogueProvider>
    </ReqoreUIProvider>
  );
  const row = (label: string) =>
    container.querySelector<HTMLElement>(`.template-picker-row[data-label="${label}"]`);
  const keyAction = (label: string) =>
    row(label)!.parentElement!.querySelector<HTMLElement>('.template-picker-key-action');
  fireEvent.click(row('Template contexts')!);
  return { container, onItemSelect, row, keyAction };
};

describe('the Key action of a control that cannot be typed into', () => {
  it('is offered on a context of free keys taken whole, and on no other row', () => {
    const { row, keyAction } = renderBrowser();
    expect(keyAction('$dynamic:*')).toBeTruthy();
    // as a person reads it, once, in the story `TemplateContextsWithAKeyAction`: jsdom draws a button's text for measuring
    expect(keyAction('$dynamic:*')!.getAttribute('aria-label')).toBe('Key $dynamic:');
    expect(row('$dynamic:*')!.parentElement!.querySelector('.template-picker-use')).toBeNull();
    // Qorus reads only its known keys, and it has none here: no key can be written
    expect(keyAction('$env:*')).toBeNull();
  });

  it('opens the key box, without taking anything, and the key written is the value', () => {
    const { container, onItemSelect, keyAction } = renderBrowser();
    fireEvent.click(keyAction('$dynamic:*')!);
    expect(onItemSelect).not.toHaveBeenCalled();
    const input = container.querySelector<HTMLInputElement>('.template-picker-key input')!;
    expect(input).toBeTruthy();
    // named as it is written, its key after its `:`
    expect(container.querySelector('.template-picker-key')!.textContent).toContain('$dynamic:');
    expect(container.querySelector('.template-picker-key')!.textContent).not.toContain('$dynamic:*');
    fireEvent.change(input, { target: { value: 'order.id' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onItemSelect).toHaveBeenCalledTimes(1);
    expect(onItemSelect.mock.calls[0][0].value).toBe('$dynamic:order.id');
  });

  it('leaves the row itself taking the whole value', () => {
    const { container, onItemSelect, row } = renderBrowser();
    fireEvent.click(row('$dynamic:*')!);
    expect(onItemSelect.mock.calls[0][0].value).toBe('$dynamic:*');
    expect(container.querySelector('.template-picker-key')).toBeNull();
  });

  it('says what the host gives it to say', () => {
    const { keyAction } = renderBrowser({ writeKey: '[Ḱéý]' });
    expect(keyAction('$dynamic:*')!.getAttribute('aria-label')).toBe('[Ḱéý] $dynamic:');
    expect(keyAction('$dynamic:*')!.textContent).toContain('[Ḱéý]');
  });

  it('is not offered where the text can be typed into', () => {
    // the picker an editor opens, handed the roots as they are
    const roots = withTemplateCatalogue([], CATALOGUE);
    const { container } = render(
      <ReqoreUIProvider>
        <TemplatePicker id='picker' roots={roots} levelId='contexts' onPick={vi.fn()} />
      </ReqoreUIProvider>
    );
    expect(container.querySelector('.template-picker-row[data-label="$dynamic:*"]')).toBeTruthy();
    expect(container.querySelector('.template-picker-key-action')).toBeNull();
  });
});
