import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';

import {
  MARKDOWN_TEMPLATE_VALUE,
  MARKDOWN_TEMPLATES,
  playHoverIsDrawn,
  withHostMarkdown,
} from '../../../../stories/templateHover';
import { withCoarsePointer } from '../../../../stories/coarsePointer';
import { PHONE_VIEWPORT } from '../../../../stories/tracking';
import { StoryMeta } from '../../../../types';
import { RichTextFormField } from './RichText';
import { buildTemplates } from '../../../../helpers/templates';
import {
  QOG_FIELD_TEMPLATES,
  WORKFLOW_CONTEXT_DATA_PAYLOAD,
} from '../template/__fixtures__/qogTemplatePayloads';
import {
  chipsOf,
  completionLabels,
  expectRowsFit,
  pickerCrumbs,
  pickerFocused,
  pickerLabels,
  pickerRow,
  pickerSearch,
} from '../../../../stories/templatePicker';
import { withTouchScreen } from '../../../../stories/touchScreen';

const meta = {
  component: RichTextFormField,
  title: 'Components/Form/RichText',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <RichTextFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof RichTextFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithValue: Story = {
  args: {
    value: 'Hello world',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the RichText field pre-populated with the plain-string value "Hello world" — the editor mounts with the text rendered as a paragraph.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // Only assert on render — typing assertions would need waitFor due to debounce
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
    await expect(canvas.getByText('Hello world')).toBeInTheDocument();
  },
};

export const WithChoiceValue: Story = {
  args: {
    value: 'C07ERBFS0P6',
    allowed_values: [
      {
        display_name: 'general',
        short_desc: 'Company-wide announcements',
        value: { type: 'richtext', value: 'C07ERBFS0P6' },
      },
      { display_name: 'random', value: { type: 'richtext', value: 'C07RANDOM01' } },
    ] as never,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the RichText field holding the value of one of its own choices — the Slack channel id C07ERBFS0P6 — drawn as one chip named "general"; the id itself is not shown, and stays the stored value.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('general')).toBeInTheDocument();
    await expect(canvas.queryByText('C07ERBFS0P6')).not.toBeInTheDocument();
  },
};

export const WithChoiceValueAsDocument: Story = {
  args: {
    ...WithChoiceValue.args,
    value: [{ type: 'paragraph', children: [{ text: 'C07ERBFS0P6' }] }] as never,
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithChoiceValue`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the RichText field holding a document that is nothing but the id of one of its choices — what an edit of the chip stores — drawn as the chip "general"; the id is not shown, and nothing is emitted for it, since the document already stands for the choice.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('general')).toBeInTheDocument();
    await expect(canvas.queryByText('C07ERBFS0P6')).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 400));
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const RetypingTheChoiceReturnsItsChip: Story = {
  args: WithChoiceValue.args,
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `WithChoiceValue`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the RichText field holding a choice drawn as the chip "general". A click opens it into C07ERBFS0P6 as text; Backspace emits C07ERBFS0P, and a typed 6 emits C07ERBFS0P6 again, each as a document and still shown as text while the author types; leaving the field with Tab draws it as the chip "general" once more and emits nothing further, since that document already stands for the choice.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole('textbox');

    await userEvent.click(canvas.getByText('general'));
    await waitFor(() => {
      expect(editor.querySelector('.reqore-tag')).toBeNull();
      expect(editor.contains(document.activeElement)).toBe(true);
    });

    // One key at a time, each emitted before the next: typed within the
    // field's debounce, the two would settle as the value the field started
    // with, and nothing would be emitted at all.
    await userEvent.keyboard('{Backspace}');
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith([
        { type: 'paragraph', children: [{ text: 'C07ERBFS0P' }] },
      ])
    );
    await userEvent.keyboard('6');
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith([
        { type: 'paragraph', children: [{ text: 'C07ERBFS0P6' }] },
      ])
    );
    await expect(editor.querySelector('.reqore-tag')).toBeNull();

    await userEvent.tab();
    await waitFor(() => {
      expect(editor.querySelector('.reqore-tag')?.textContent).toContain('general');
      expect(editor.textContent).not.toContain('C07ERBFS0P6');
    });
    // Leaving the field changed nothing: the chip stands for what was emitted.
    await expect(args.onChange).toHaveBeenLastCalledWith([
      { type: 'paragraph', children: [{ text: 'C07ERBFS0P6' }] },
    ]);
  },
};

export const ClickOpensTheChoiceChip: Story = {
  args: WithChoiceValue.args,
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by a plain editor holding text.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the RichText field holding a choice drawn as the chip "general", with the default chip behavior. A click on the chip opens it into its value as editable text: the editor shows C07ERBFS0P6 and no chip, the cursor at its end, so Backspace and a typed 7 make it C07ERBFS0P7, which is what the field emits.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole('textbox');

    await userEvent.click(canvas.getByText('general'));
    await waitFor(() => {
      expect(editor.querySelector('.reqore-tag')).toBeNull();
      expect(editor.textContent).toBe('C07ERBFS0P6');
      expect(editor.contains(document.activeElement)).toBe(true);
    });

    await userEvent.keyboard('{Backspace}7');
    await waitFor(() => expect(editor.textContent).toBe('C07ERBFS0P7'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith([
        { type: 'paragraph', children: [{ text: 'C07ERBFS0P7' }] },
      ])
    );
  },
};

export const BackspaceOpensTheChoiceChip: Story = {
  args: {
    ...WithChoiceValue.args,
    choiceChip: { click: 'cursor' },
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by a plain editor holding text.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the RichText field holding a choice drawn as the chip "general", configured so that a click on the chip only places the cursor after it. Backspace then opens the chip into its value as editable text: the editor shows C07ERBFS0P6 and no chip, the cursor at its end, so one more Backspace and a typed 7 make it C07ERBFS0P7, which is what the field emits.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole('textbox');

    await userEvent.click(canvas.getByText('general'));
    await waitFor(() => expect(editor.contains(document.activeElement)).toBe(true));

    await userEvent.keyboard('{Backspace}');
    await waitFor(() => {
      expect(editor.querySelector('.reqore-tag')).toBeNull();
      expect(editor.textContent).toBe('C07ERBFS0P6');
    });

    await userEvent.keyboard('{Backspace}7');
    await waitFor(() => expect(editor.textContent).toBe('C07ERBFS0P7'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith([
        { type: 'paragraph', children: [{ text: 'C07ERBFS0P7' }] },
      ])
    );
  },
};

/** A catalog that names a reference no grammar reads: `@create` is a reference only because it names it. */
const ARRIVING_CATALOG = { items: [{ label: 'Created order', value: '@create' }] } as never;
const NO_CATALOG_YET = { items: [] } as never;

export const ChipDrawnWhenItsCatalogArrives: Story = {
  args: {
    valueFormat: 'text',
    allowTemplates: true,
    value: '@create + 1',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the RichText field holding "@create + 1" before its template catalog has arrived, so @create is text. When the catalog arrives (it names @create "Created order"), @create is drawn as the "Created order" chip, the text unchanged.',
      },
    },
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    // the catalog is fetched: it arrives after the field's first render
    const [templates, setTemplates] = useState(NO_CATALOG_YET);
    return (
      <>
        <RichTextFormField
          {...args}
          templates={templates}
          value={value}
          onChange={(next) => {
            args.onChange?.(next);
            setValue(next);
          }}
        />
        <button
          type='button'
          className='catalog-arrives'
          onClick={() => setTemplates(ARRIVING_CATALOG)}
        >
          Catalog arrives
        </button>
      </>
    );
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const editor = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('[data-slate-editor]');
      expect(el?.textContent).toContain('@create');
      return el as HTMLElement;
    });
    // no catalog yet: nothing names @create
    expect(editor.querySelector('.reqore-tag')).toBeNull();

    await userEvent.click(canvas.getByText('Catalog arrives'));

    await waitFor(() =>
      expect(editor.querySelector('.reqore-tag')?.textContent).toContain('Created order')
    );
    expect(editor.textContent).toContain('+ 1');
  },
};

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Renders the RichText field with no value — the editor mounts empty.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
  },
};

export const WithSlateValue: Story = {
  args: {
    value: [{ type: 'paragraph', children: [{ text: 'Rich text with Slate format' }] }],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the RichText field pre-populated with a Slate document rather than a plain string — the editor mounts with the paragraph node rendered as text.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
    await expect(canvas.getByText('Rich text with Slate format')).toBeInTheDocument();
  },
};

export const TemplateHoverDrawsTheDescription: Story = {
  args: {
    value: `Dear ${MARKDOWN_TEMPLATE_VALUE}, your order has shipped.`,
    valueFormat: 'text',
    templates: MARKDOWN_TEMPLATES,
  },
  decorators: [withHostMarkdown],
  parameters: {
    docs: {
      description: {
        story:
          'Renders a text field holding a template ("Dear Customer name, your order has shipped."), in a host that draws markdown. Hovered, the chip\'s card shows the description drawn as the template list draws it: "customer’s" in bold and customer.name as code, with no asterisks or backticks, on one line on a wide screen (the card is as wide as what it says, up to 560px).',
      },
    },
  },
  play: playHoverIsDrawn,
};

export const TemplateTappedOnAPhone: Story = {
  tags: ['touch'],
  args: TemplateHoverDrawsTheDescription.args,
  // the pointer is a finger where the touches are dispatched too (Storybook's own UI), as on a phone
  decorators: [withCoarsePointer, withHostMarkdown],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'Renders the same text field on a phone (390 px, touch). Tapped by a finger, the chip opens the template ' +
          'picker with its own row chosen, which says what it is - its description drawn (bold and code, no ' +
          'markdown marks) - inside the screen; a finger has no hover, so no card opens over it as well, and the ' +
          'row picked takes the chip\'s place.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const chip = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>('.reqore-tag .reqore-tag-content');
      expect(found).toBeTruthy();
      return found!;
    });
    await withTouchScreen(async (touch) => {
      await touch.tap(chip);
      await waitFor(() => expect(pickerFocused()).toBe('Customer name'));
      const what = document.querySelector<HTMLElement>(
        '.template-picker-row[aria-selected="true"] .template-picker-row-what'
      )!;
      expect(what.querySelector('strong')?.textContent).toBe('customer’s');
      expect(what.querySelector('code')?.textContent).toBe('customer.name');
      expect(what.textContent).not.toMatch(/[`*]/);
      if (touch.narrowed) {
        const { left, right } = document.querySelector<HTMLElement>('.template-picker')!.getBoundingClientRect();
        expect(left).toBeGreaterThanOrEqual(0);
        expect(right).toBeLessThanOrEqual(window.innerWidth);
      }
      // one popover: the picker, and no card over it
      expect(document.querySelectorAll('.reqore-popover-content')).toHaveLength(1);
    });
  },
};

/**
 * A click in an empty rich-text field opens the template picker at the top of its templates, browsed as they nest -
 * a Qog state, a record in it, a record in that (qorus#646, David: templates in a rich-text field are offered as a
 * hierarchy, and every value is reached).
 */
export const AClickBrowsesTheTemplatesAsTheyNest: Story = {
  args: { value: '', valueFormat: 'text', templates: QOG_FIELD_TEMPLATES },
  parameters: {
    docs: {
      description: {
        story:
          'Clicks in the empty field: the template picker opens at the top - Context Data, Look up customer and ' +
          'Receive order. Receive order, then Customer, then Address open level by level, the way back above the ' +
          'rows reading Templates › Receive order › Customer › Address; City picked there is written as one chip, ' +
          'Receive order › … › Address › City, and the value is $data:{receive_order.customer.address.city}.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');
    await userEvent.click(editable);
    await waitFor(() => expect(pickerLabels()).toEqual(['Context Data', 'Look up customer', 'Receive order']));
    await userEvent.click(await pickerRow('Receive order'));
    await userEvent.click(await pickerRow('Customer'));
    await userEvent.click(await pickerRow('Address'));
    await waitFor(() => expect(pickerCrumbs()).toBe('Templates› Receive order› Customer› Address'));
    await userEvent.click(await pickerRow('City'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith('$data:{receive_order.customer.address.city}')
    );
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order › … › Address › City']));
  },
};

/** A record that is a value of its own is taken whole from the picker ("Use"), or opened for its fields. */
export const ARecordIsTakenWhole: Story = {
  args: { value: '', valueFormat: 'text', templates: QOG_FIELD_TEMPLATES },
  parameters: {
    docs: {
      description: {
        story:
          'Opens Receive order in the picker and presses Use on Customer, a record: it is written whole, as the chip ' +
          'Receive order › Customer for $data:{receive_order.customer}.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.click(await pickerRow('Receive order'));
    const customer = await pickerRow('Customer');
    await userEvent.click(customer.parentElement!.querySelector<HTMLElement>('.template-picker-use')!);
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('$data:{receive_order.customer}'));
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order › Customer']));
  },
};

/**
 * Typing a `$` reference narrows the rows to what it reaches, in the same popover (qorus#646, David's review): the
 * states for `$data:`, a state's data after `$data:receive_order.`; a state's row opens the picker at its data.
 */
export const TypingAReferenceNarrowsTheRows: Story = {
  args: { value: '', valueFormat: 'text', templates: QOG_FIELD_TEMPLATES },
  parameters: {
    docs: {
      description: {
        story:
          'Types "Order $data:": the rows are the two states and Browse all templates. Going on with ' +
          '"receive_order.", they are its data - Customer, Event type, Order ID, User name. Order ID picked takes ' +
          'the place of the typed reference: "Order $data:{receive_order.order_id}".',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');
    await userEvent.click(editable);
    await userEvent.keyboard('{Escape}');
    await userEvent.type(editable, 'Order $data:');
    await waitFor(() =>
      expect(completionLabels()).toEqual(['Look up customer', 'Receive order', 'Browse all templates'])
    );
    await userEvent.type(editable, 'receive_order.');
    await waitFor(() =>
      expect(completionLabels()).toEqual(['Customer', 'Event type', 'Order ID', 'User name', 'Browse all templates'])
    );
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith('Order $data:{receive_order.order_id}')
    );
  },
};

/** A click on a chip opens the picker at its group, its row the keyboard's; the pick takes its place. */
export const AChipIsReplacedFromItsGroup: Story = {
  args: { value: 'Hello $data:{receive_order.user_name}!', valueFormat: 'text', templates: QOG_FIELD_TEMPLATES },
  parameters: {
    docs: {
      description: {
        story:
          'Clicks the chip Receive order › User name: the picker opens at Receive order with User name chosen; ' +
          'Order ID picked takes its place: "Hello $data:{receive_order.order_id}!".',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');
    const chip = await waitFor(() => {
      const found = editable.querySelector<HTMLElement>('.reqore-tag .reqore-tag-content');
      expect(found).toBeTruthy();
      return found!;
    });
    await userEvent.click(chip);
    await waitFor(() => expect(pickerFocused()).toBe('User name'));
    await userEvent.click(await pickerRow('Order ID'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith('Hello $data:{receive_order.order_id}!')
    );
  },
};

/**
 * A template of any keys - a workflow's dynamic data - has its key written in the picker: what it holds is known
 * only when the workflow runs.
 */
export const AKeyIsWrittenForDataOfAnyKeys: Story = {
  args: { value: '', valueFormat: 'text', templates: buildTemplates(WORKFLOW_CONTEXT_DATA_PAYLOAD) },
  parameters: {
    docs: {
      description: {
        story:
          'Searches the picker for "dynamic" and picks Workflow Dynamic Data: it asks for the key to use; ' +
          '"order.id" written there is the chip for $dynamic:order.id.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');
    await userEvent.click(editable);
    const search = await pickerSearch();
    await userEvent.click(search);
    await userEvent.type(search, 'dynamic');
    await userEvent.click(await pickerRow('Workflow Dynamic Data'));
    const key = await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>('.template-picker-key input');
      expect(input).toBeTruthy();
      return input!;
    });
    // the key's box has the keyboard: the key is typed straight in
    await waitFor(() => expect(document.activeElement).toBe(key));
    await userEvent.keyboard('order.id{Enter}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('$dynamic:order.id'));
  },
};

/** The picker on a phone: it fits the screen with its margins, and is browsed by taps. */
export const ThePickerOnAPhone: Story = {
  tags: ['touch'],
  args: { value: '', valueFormat: 'text', templates: QOG_FIELD_TEMPLATES },
  decorators: [withCoarsePointer],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'On a phone, taps the empty field and then Receive order: the picker fits the screen with a margin on ' +
          'each side, its rows are tall enough for a finger, and nothing scrolls sideways.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = within(canvasElement).getByRole('textbox');
    await withTouchScreen(async (touch) => {
      await touch.tap(editable);
      await touch.tap(await pickerRow('Receive order'));
      await waitFor(() => expect(pickerLabels()).toContain('Event type'));
      if (touch.narrowed) {
        await waitFor(() => {
          const { left, right } = document.querySelector<HTMLElement>('.template-picker')!.getBoundingClientRect();
          expect(left).toBeGreaterThanOrEqual(0);
          expect(right).toBeLessThanOrEqual(window.innerWidth);
          expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
        });
      }
      expect((await pickerRow('Event type')).getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    });
  },
};

/**
 * Where the value takes a record (a field of any type, a hash), a Qog state's data and a record are taken whole from
 * the picker as well as opened (qorus#646, David's review).
 */
export const AStateIsTakenWholeWhereTheValueTakesRecords: Story = {
  args: { value: '', valueFormat: 'text', templates: QOG_FIELD_TEMPLATES, wholeRecords: true },
  parameters: {
    docs: {
      description: {
        story:
          'A value that takes a record: the picker\'s Receive order has Use beside it, which writes the state\'s ' +
          'whole data, $data:{receive_order}, as the chip Receive order; a click on the row opens its data instead.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const editable = within(canvasElement).getByRole('textbox');
    await userEvent.click(editable);
    const state = await pickerRow('Receive order');
    await userEvent.click(state.parentElement!.querySelector<HTMLElement>('.template-picker-use')!);
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('$data:{receive_order}'));
    await waitFor(() => expect(chipsOf(editable)).toEqual(['Receive order']));
  },
};

/** Where the value takes no record (a scalar field), neither a state nor a record is offered whole: only opened. */
export const AScalarValueTakesNoRecordWhole: Story = {
  args: { value: '', valueFormat: 'text', templates: QOG_FIELD_TEMPLATES, wholeRecords: false },
  parameters: {
    docs: {
      description: {
        story:
          'A value that takes no record (text, a number): Receive order and its record Customer have no Use - ' +
          'they open into their data - and every row fits the picker.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const editable = within(canvasElement).getByRole('textbox');
    await userEvent.click(editable);
    await pickerRow('Receive order');
    expect(document.querySelectorAll('.template-picker-use')).toHaveLength(0);
    await userEvent.click(await pickerRow('Receive order'));
    await pickerRow('Customer');
    expect(document.querySelectorAll('.template-picker-use')).toHaveLength(0);
    expectRowsFit(Array.from(document.querySelectorAll<HTMLElement>('.template-picker .template-picker-row')));
  },
};
