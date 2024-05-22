import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor } from '@storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { ColorFormField } from './Color';

const meta = {
  component: ColorFormField,
  title: 'Components/Form/Color',
  args: {
    onChange: fn(),
  },
} as StoryMeta<typeof ColorFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: { r: 0, g: 0, b: 0, a: 1 },
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
  async play({ canvasElement, args }) {
    await waitFor(() => expect(canvasElement.querySelector('.sketch-picker')).toBeInTheDocument());
    const colorPanel = canvasElement.querySelector('.saturation-white');
    const valueInput = canvasElement.querySelector('input');
    await expect(colorPanel).toBeInTheDocument();
    await expect(valueInput).toBeInTheDocument();
    await expect(valueInput).toHaveValue('000000');

    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: colorPanel,
      coords: { x: 0, y: 0 },
    });
    await expect(valueInput).toHaveValue('FFFFFF');
    await expect(args.onChange).toHaveBeenLastCalledWith({
      r: 255,
      g: 255,
      b: 255,
      a: 1,
    });
  },
};
