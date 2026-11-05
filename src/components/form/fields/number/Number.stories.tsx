import { ReqoreControlGroup } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { TemplateCatalogueProvider } from '../../../../helpers/templateCatalogueContext';
import { templateCatalogueFixture } from '../../../../stories/templateCatalogueMock';
import { pickerRow, typeAsAPerson } from '../../../../stories/templatePicker';
import { StoryMeta } from '../../../../types';
import { NumberFormField } from './Number';

const meta = {
  component: NumberFormField,
  title: 'Components/Form/Number',
  args: {
    'aria-label': 'Number',
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <ReqoreControlGroup>
        <NumberFormField
          {...args}
          value={value}
          onChange={(value) => {
            args.onChange?.(value);
            setValue(value);
          }}
        />
      </ReqoreControlGroup>
    );
  },
} as StoryMeta<typeof NumberFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Integer: Story = {
  args: {
    value: 42,
    type: 'int',
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Float`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the Number field in integer mode with 42 pre-populated. Typing a new integer updates the value and fires onChange after the debounce.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue('42');
    // typed freely, on a numeric keyboard
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toHaveAttribute('inputmode', 'numeric');

    await userEvent.clear(input);
    await userEvent.type(input, '10');
    await expect(input).toHaveValue('10');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(10), { timeout: 500 });
  },
};

export const Float: Story = {
  args: {
    value: 3.14,
    type: 'float',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Number field in float mode with 3.14 pre-populated — the input asks for a decimal keyboard and accepts decimals.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await expect(input).toHaveValue('3.14');
    await expect(input).toHaveAttribute('inputmode', 'decimal');

    await userEvent.clear(input);
    await userEvent.type(input, '10.9');
    await expect(input).toHaveValue('10.9');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(10.9), { timeout: 500 });
  },
};

export const Empty: Story = {
  args: {
    type: 'int',
  },
  parameters: {
    docs: {
      description: {
        story: 'Renders the Number field in integer mode with no value — the input mounts empty.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue('');
  },
};

export const Disabled: Story = {
  args: {
    value: 99,
    type: 'int',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Number field with a value but disabled — the input shows the value and rejects further edits.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await expect(input).toBeDisabled();
    await expect(input).toHaveValue('99');
  },
};

export const TypedFreely: Story = {
  args: {
    value: 7,
    type: 'int',
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Float`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the bare Number editor in integer mode, given no templates, after typing what is not a number: 12abc stays as typed (the form flags it, it is not cut to 12), and a decimal point typed before its digits is kept. A number field that takes templates is TemplateField around this editor: see Components/Form/Template › Number Typed Freely.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');
    await userEvent.clear(input);
    await userEvent.type(input, '12abc');
    await expect(input).toHaveValue('12abc');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('12abc'), { timeout: 500 });
    await userEvent.clear(input);
    await userEvent.type(input, '10.');
    await expect(input).toHaveValue('10.');
  },
};

/** Clicks on the number's template list, through Template contexts, to the row of `$dynamic:`. */
const openDynamicRow = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('textbox'));
  await userEvent.click(await pickerRow('Template contexts'));
  return pickerRow('$dynamic:*');
};

const WITH_TEMPLATE_CONTEXTS: Pick<Story, 'args' | 'decorators'> = {
  args: {
    templates: { items: [{ label: 'Quantity', value: '$local:quantity' }] } as never,
  },
  decorators: [
    (Story) => (
      <TemplateCatalogueProvider catalogue={templateCatalogueFixture('workflow-untyped-static')}>
        <Story />
      </TemplateCatalogueProvider>
    ),
  ],
};

/**
 * A number's input takes a template from its list: `$dynamic:*`, a context of free keys, is taken whole by its row, and
 * one of its keys is written with its Key action (David's decision), which a finger reaches as a mouse does.
 */
export const TemplateContextsWithAKeyAction: Story = {
  ...WITH_TEMPLATE_CONTEXTS,
  parameters: {
    docs: {
      description: {
        story:
          "Renders a number's input with its template list open at Template contexts: $dynamic:* is a row that takes all of it, with a Key action beside it, always shown; a context with keys to choose keeps its arrow and Use.",
      },
    },
  },
  async play({ canvasElement }) {
    const row = await openDynamicRow(canvasElement);
    await expect(row.parentElement!.querySelector('.template-picker-key-action')).toBeTruthy();
  },
};

export const AKeyOfATemplateContext: Story = {
  ...WITH_TEMPLATE_CONTEXTS,
  parameters: {
    // Interaction-only: the play assertions are the guard; the action is pictured by `TemplateContextsWithAKeyAction`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          "Renders a number's input with its template list, at Template contexts. The row $dynamic:* has a Key action. " +
          'Clicking Key asks for the key, without taking anything; `order.id` typed there and Enter pressed make the value $dynamic:order.id.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const row = await openDynamicRow(canvasElement);
    const key = row.parentElement!.querySelector<HTMLElement>('.template-picker-key-action');
    await expect(key).toBeTruthy();
    await expect(key!.textContent).toBe('Key');
    await expect(row.parentElement!.querySelector('.template-picker-use')).toBeNull();
    await userEvent.click(key!);
    await expect(args.onChange).not.toHaveBeenCalled();
    const input = await waitFor(() => {
      const found = document.querySelector<HTMLInputElement>('.template-picker-key input');
      expect(found).toBeTruthy();
      return found!;
    });
    await waitFor(() => expect(document.activeElement).toBe(input));
    await typeAsAPerson(userEvent, 'order.id');
    await expect(input.value).toBe('order.id');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('$dynamic:order.id'));
  },
};

/** The row itself, beside the Key action: all of the context, with no key asked for. */
export const ATemplateContextTakenWhole: Story = {
  ...WITH_TEMPLATE_CONTEXTS,
  parameters: {
    // Interaction-only: the play assertions are the guard, and the list is pictured by `TemplateContextsWithAKeyAction`.
    qlip: { skip: true },
    docs: {
      description: {
        story: "Clicks the row $dynamic:* in a number's template list: the value is $dynamic:*, and no key is asked for.",
      },
    },
  },
  async play({ args, canvasElement }) {
    await userEvent.click(await openDynamicRow(canvasElement));
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('$dynamic:*'));
    await expect(document.querySelector('.template-picker-key')).toBeNull();
  },
};
