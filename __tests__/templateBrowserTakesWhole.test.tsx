import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* The picker is drawn where the dropdown would draw it (see templateDropdownDrawsDescriptions.test.tsx): Reqore's
   dropdown portal never opens in jsdom. */
vi.mock('@qoretechnologies/reqore', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ReqoreDropdown: (props: any) => <div data-testid='dropdown'>{props.customElements}</div>,
  };
});

const { ReqoreUIProvider } = await import('@qoretechnologies/reqore');
const { TemplateBrowser } = await import('../src/components/form/fields/template/TemplateBrowser');
const { QOG_FIELD_TEMPLATES } =
  await import('../src/components/form/fields/template/__fixtures__/qogTemplatePayloads');

const renderBrowser = (wholeRecords: boolean) => {
  const onItemSelect = vi.fn();
  const { container } = render(
    <ReqoreUIProvider>
      <TemplateBrowser
        templates={QOG_FIELD_TEMPLATES}
        wholeRecords={wholeRecords}
        onItemSelect={onItemSelect}
      />
    </ReqoreUIProvider>
  );
  const row = (label: string) =>
    container.querySelector<HTMLElement>(`.template-picker-row[data-label="${label}"]`);
  return { container, onItemSelect, row };
};

/**
 * A Qog state's data taken whole (qorus#646, David's review) is a value of its type, as a host reads a pick's type:
 * a hash, not the app the state is grouped by.
 */
describe('a state taken whole from the template picker', () => {
  it('is handed on as its whole data, of type hash', () => {
    const { row, onItemSelect } = renderBrowser(true);
    const state = row('Receive order');
    expect(state, 'the row Receive order').toBeTruthy();
    const use = state!.parentElement!.querySelector<HTMLElement>('.template-picker-use');
    expect(use, 'Use beside Receive order').toBeTruthy();
    fireEvent.click(use!);
    expect(onItemSelect).toHaveBeenCalledTimes(1);
    const item = onItemSelect.mock.calls[0][0];
    expect(item.value).toBe('$data:{receive_order}');
    expect(item.badge).toBe('hash');
    expect(item.metadata.type).toBe('hash');
  });

  it('is not offered whole where the value takes no record', () => {
    const { row, container } = renderBrowser(false);
    expect(row('Receive order'), 'the row Receive order').toBeTruthy();
    expect(container.querySelectorAll('.template-picker-use')).toHaveLength(0);
  });
});
