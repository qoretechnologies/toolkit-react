import { StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
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

export const WithValue: Story = {
  args: {
    value: { r: 100, g: 149, b: 237, a: 1 },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with a cornflower-blue RGBA value pre-selected in the sketch picker.',
      },
    },
  },
  async play({ canvasElement }) {
    const picker = canvasElement.querySelector('.sketch-picker');
    const colorPanel = canvasElement.querySelector('.saturation-white');

    await expect(picker).toBeInTheDocument();
    await expect(colorPanel).toBeInTheDocument();
  },
};

export const Red: Story = {
  args: {
    value: { r: 220, g: 53, b: 69, a: 1 },
  },
  parameters: {
    docs: {
      description: {
        story: 'Renders the Color field with a red RGBA value pre-selected in the sketch picker.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(canvasElement.querySelector('.sketch-picker')).toBeInTheDocument();
  },
};

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Renders the Color field with no value — the sketch picker mounts empty.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(canvasElement.querySelector('.sketch-picker')).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: {
    value: { r: 100, g: 149, b: 237, a: 1 },
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Color field with a value but disabled — the sketch picker is visible but non-interactive.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(canvasElement.querySelector('.sketch-picker')).toBeInTheDocument();
  },
};
