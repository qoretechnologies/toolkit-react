import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { withCoarsePointer } from '../../../../stories/coarsePointer';
import { _testsWithViewport } from '../../../../stories/Tests/utils';
import { LightTheme, PHONE_VIEWPORT } from '../../../../stories/tracking';
import { ColorFormField } from './Color';

const meta = {
  component: ColorFormField,
  title: 'Components/Form/Color',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <ColorFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof ColorFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

const field = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>('.reqraft-color-field')!;
const hexInput = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLInputElement>('.w-color-editable-input input')!;
const swatch = (canvasElement: HTMLElement, color: string) =>
  canvasElement.querySelector<HTMLElement>(`.w-color-swatch > div[title="${color}"]`)!;

const CORNFLOWER = { r: 100, g: 149, b: 237, a: 1 };

export const WithValue: Story = {
  args: {
    value: CORNFLOWER,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with cornflower blue chosen: the colour area, the hue slider, the hex and R, G, B inputs (6495ED; 100, 149, 237) and the preset swatches.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(canvasElement.querySelector('.w-color-sketch')).toBeInTheDocument();
    await expect(canvasElement.querySelector('.w-color-saturation')).toBeInTheDocument();
    await expect(hexInput(canvasElement).value).toBe('6495ED');
  },
};

export const Red: Story = {
  args: {
    value: { r: 220, g: 53, b: 69, a: 1 },
  },
  parameters: {
    docs: {
      description: {
        story: 'Renders the Color field with red chosen (DC3545).',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(hexInput(canvasElement).value).toBe('DC3545');
  },
};

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with no colour stored: the picker opens on its starting colour, and nothing is stored until a colour is chosen.',
      },
    },
  },
  async play({ canvasElement, args }) {
    await expect(canvasElement.querySelector('.w-color-sketch')).toBeInTheDocument();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const WrittenAsHex: Story = {
  args: {
    value: CORNFLOWER,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with cornflower blue. When DC3545 is written into Hex, the field stores red as { r: 220, g: 53, b: 69, a: 1 } and the picker moves to it.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const hex = hexInput(canvasElement);
    await userEvent.clear(hex);
    await userEvent.type(hex, 'DC3545');
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 1 })
    );
  },
};

export const ChosenFromASwatch: Story = {
  args: {
    value: CORNFLOWER,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with cornflower blue. When the dark green swatch (#417505) is clicked, the field stores it as { r: 65, g: 117, b: 5, a: 1 }.',
      },
    },
  },
  async play({ canvasElement, args }) {
    await userEvent.click(swatch(canvasElement, '#417505'));
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith({ r: 65, g: 117, b: 5, a: 1 })
    );
    await expect(hexInput(canvasElement).value).toBe('417505');
  },
};

export const WithTransparency: Story = {
  args: {
    value: { r: 100, g: 149, b: 237, a: 0.5 },
    disableAlpha: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with transparency offered: cornflower blue at 50%, with the transparency slider under the hue slider, the preview square beside them, and an A input after R, G, B.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(canvasElement.querySelector('.w-color-alpha:not(.w-color-hue)')).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: {
    value: CORNFLOWER,
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field disabled: the picker is dimmed, and nothing in it can be reached by pointer or keyboard, so writing a colour into Hex stores nothing.',
      },
    },
  },
  async play({ canvasElement, args }) {
    await expect(field(canvasElement).inert).toBe(true);
    await expect(field(canvasElement)).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(hexInput(canvasElement), 'DC3545');
    await expect(hexInput(canvasElement).value).toBe('6495ED');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const ReadOnly: Story = {
  args: {
    value: CORNFLOWER,
    readOnly: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field read-only: the colour is shown at full strength, and nothing in the picker can be reached, so writing a colour into Hex stores nothing.',
      },
    },
  },
  async play({ canvasElement, args }) {
    await expect(field(canvasElement).inert).toBe(true);
    await userEvent.type(hexInput(canvasElement), 'DC3545');
    await expect(hexInput(canvasElement).value).toBe('6495ED');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const OnALightTheme: Story = {
  args: {
    value: CORNFLOWER,
  },
  decorators: [
    (Story) => (
      <LightTheme>
        <Story />
      </LightTheme>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with cornflower blue on a light theme: the input text and labels are dark, as the theme reads.',
      },
    },
  },
  async play({ canvasElement }) {
    // the theme's dark text, not the light text of the dark preview
    await waitFor(() =>
      expect(getComputedStyle(hexInput(canvasElement)).color).not.toBe('rgb(255, 255, 255)')
    );
  },
};

/** The sizes a finger needs, and nothing past the field's edge, at a phone's width. */
const expectFingerSized = (canvasElement: HTMLElement, narrowed: boolean) => {
  const root = field(canvasElement).getBoundingClientRect();
  const hue = canvasElement.querySelector<HTMLElement>('.w-color-hue')!.getBoundingClientRect();
  expect(hue.height).toBeGreaterThanOrEqual(24);
  for (const input of canvasElement.querySelectorAll<HTMLElement>('.w-color-editable-input input')) {
    expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  }
  const swatches = canvasElement.querySelectorAll<HTMLElement>('.w-color-swatch > div');
  expect(swatches.length).toBeGreaterThan(0);
  for (const rect of swatches) {
    const box = rect.getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    if (narrowed) {
      expect(box.right).toBeLessThanOrEqual(root.right + 0.5);
    }
  }
};

export const OnATouchScreen: Story = {
  args: {
    value: CORNFLOWER,
  },
  decorators: [withCoarsePointer],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'Renders the Color field on a phone (390 px, touch): the hue slider, the swatches and the inputs are a finger\'s size and stay inside the field. When the dark green swatch is tapped, the field stores it.',
      },
    },
  },
  async play({ canvasElement, args }) {
    await _testsWithViewport(PHONE_VIEWPORT.width, PHONE_VIEWPORT.height, async (narrowed) => {
      await waitFor(() => expectFingerSized(canvasElement, narrowed));
      await userEvent.pointer([{ keys: '[TouchA]', target: swatch(canvasElement, '#417505') }]);
      await waitFor(() =>
        expect(args.onChange).toHaveBeenLastCalledWith({ r: 65, g: 117, b: 5, a: 1 })
      );
    });
  },
};
