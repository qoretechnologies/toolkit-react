import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { RichTextFormField } from './RichText';

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
          'Renders the RichText field holding a choice drawn as the chip "general", with the default chip behaviour. A click on the chip opens it into its value as editable text: the editor shows C07ERBFS0P6 and no chip, the cursor at its end, so Backspace and a typed 7 make it C07ERBFS0P7, which is what the field emits.',
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
