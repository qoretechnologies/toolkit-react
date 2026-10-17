import { SIZE_TO_PX } from '@qoretechnologies/reqore/dist/constants/sizes';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';

import { withCoarsePointer } from '../../../stories/coarsePointer';
import { withTouchScreen } from '../../../stories/touchScreen';
import { PHONE_VIEWPORT } from '../../../stories/tracking';
import { StoryMeta } from '../../../types';
import { FormField } from './Field';

/**
 * Direct `FormField` dispatcher stories. These exist mainly to pin the
 * soft-type / `binary` handling: a `soft*` type renders exactly like its
 * concrete base, and `binary` renders as a textarea.
 */
const meta = {
  component: FormField,
  title: 'Components/Form/Field',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState<any>(args.value);
    return (
      <FormField
        {...args}
        value={value}
        onChange={(v) => {
          args.onChange?.(v);
          setValue(v);
        }}
      />
    );
  },
} as StoryMeta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A soft Qore type (`softint`) renders identically to its concrete `int`. */
export const SoftInteger: Story = {
  args: {
    type: 'softint',
    value: 5,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a softint value — the dispatcher resolves the soft type to int and mounts the numeric input.',
      },
    },
  },
  async play({ canvasElement }) {
    // NumberFormField renders an input (a `softint` resolves to `int`).
    await expect(canvasElement.querySelector('input')).toBeInTheDocument();
  },
};

/** `binary` renders as a textarea (matching the type map's documented intent). */
export const Binary: Story = {
  args: {
    type: 'binary',
    value: 'deadbeef',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a binary value — the dispatcher mounts a textarea holding the encoded content.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(canvasElement.querySelector('textarea')).toBeInTheDocument();
  },
};

/** `byte-size` — a numeric amount + a unit selector, combined into `"512MiB"`. */
export const ByteSize: Story = {
  args: {
    type: 'byte-size',
    value: '512MiB',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a byte-size value — the dispatcher mounts the amount input and the MiB unit selector, split from "512MiB".',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByDisplayValue('512')).toBeInTheDocument();
    await expect(await canvas.findByText('MiB')).toBeInTheDocument();
  },
};

/** `url` — protocol picker + `://` + address (IDE `URLField` structure). */
export const Url: Story = {
  args: {
    type: 'url',
    value: 'https://example.com',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a url value — the dispatcher mounts the https protocol selector and the example.com address input, split from "https://example.com".',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(await canvas.findByDisplayValue('example.com')).toBeInTheDocument();
    await expect(await canvas.findByText('https')).toBeInTheDocument();
  },
};

/** `multi-select` — an array value picked from `allowed_values` (multiple). */
export const MultiSelect: Story = {
  args: {
    type: 'multi-select',
    allowed_values: [
      { value: { value: 'red', type: 'string' }, display_name: 'Red' },
      { value: { value: 'green', type: 'string' }, display_name: 'Green' },
      { value: { value: 'blue', type: 'string' }, display_name: 'Blue' },
    ],
    value: ['red', 'blue'],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a multi-select value — the two picked values (Red and Blue) render as chips using their display_name labels.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // The two selected values render as chips (by their display_name).
    await expect(await canvas.findByText('Red')).toBeInTheDocument();
    await expect(canvas.getByText('Blue')).toBeInTheDocument();
  },
};

/** Choices the server describes in markdown, as a mode's allowed values are. */
const DESCRIBED_CHOICES = [
  {
    value: { type: 'string', value: 'chat' },
    display_name: 'Chat',
    short_desc: 'Each `POST /conversations` starts a **new** thread.',
  },
  { value: { type: 'string', value: 'completion' }, display_name: 'Completion', short_desc: 'One answer per request.' },
];

const describedChoiceArgs = {
  type: 'string',
  display_name: 'Mode',
  allowed_values: DESCRIBED_CHOICES,
  value: 'chat',
} as never;

const choiceBox = (canvasElement: HTMLElement, label: string) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('.reqore-checkbox')).find((box) =>
    box.textContent?.includes(label)
  )!;

/** The description cards open on the page. */
const openCards = () => Array.from(document.querySelectorAll<HTMLElement>('.reqore-popover-content'));

export const ChoicesDescribedOnHover: Story = {
  args: describedChoiceArgs,
  parameters: {
    docs: {
      description: {
        story:
          'Renders a field whose two choices (Chat, Completion) the server describes. With a mouse there is no ⓘ: hovering Completion shows its description in a card.',
      },
    },
  },
  async play({ canvasElement }) {
    await waitFor(() => expect(choiceBox(canvasElement, 'Completion')).toBeTruthy());
    await expect(canvasElement.querySelector('.reqraft-description-info')).toBeNull();
    await userEvent.hover(choiceBox(canvasElement, 'Completion'));
    await waitFor(() =>
      expect(openCards().some((card) => card.textContent?.includes('One answer per request.'))).toBe(true)
    );
  },
};

export const ChoicesDescribedOnATouchScreen: Story = {
  tags: ['touch'],
  args: describedChoiceArgs,
  decorators: [withCoarsePointer],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          "Renders the same field on a phone (390 px, touch). Each choice has an ⓘ beside it, as big as the choice: Reqore's small control, which a finger can hit. A tap on Completion only chooses it, and no card opens. A tap on Chat's ⓘ opens Chat's description, which stays on the screen.",
      },
    },
  },
  async play({ canvasElement, args }) {
    await withTouchScreen(async (touch) => {
      const info = await waitFor(() => {
        const buttons = Array.from(
          canvasElement.querySelectorAll<HTMLElement>('.reqraft-description-info')
        );
        expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
          'About Chat',
          'About Completion',
        ]);
        return buttons;
      });
      // each ⓘ is as big as the choice it is beside, and a finger can hit both: no smaller than Reqore's small
      for (const [button, choice] of [
        [info[0], 'Chat'],
        [info[1], 'Completion'],
      ] as const) {
        const height = button.getBoundingClientRect().height;
        expect(height).toBeGreaterThanOrEqual(SIZE_TO_PX.small);
        const choiceHeight = choiceBox(canvasElement, choice).getBoundingClientRect().height;
        expect(Math.abs(height - choiceHeight)).toBeLessThanOrEqual(1);
      }
      // the box: chosen, and nothing else
      await touch.tap(choiceBox(canvasElement, 'Completion'));
      await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('completion'));
      await expect(openCards()).toHaveLength(0);
      // the ⓘ: the description
      await touch.tap(info[0]);
      const card = await waitFor(() => {
        const shown = openCards().find((each) => each.textContent?.includes('starts a new thread'));
        expect(shown).toBeTruthy();
        return shown!;
      });
      await expect(card.textContent).not.toMatch(/[`*]/);
      if (touch.narrowed) {
        const box = card.getBoundingClientRect();
        await expect(box.left).toBeGreaterThanOrEqual(0);
        await expect(box.right).toBeLessThanOrEqual(window.innerWidth);
      }
    });
  },
};
