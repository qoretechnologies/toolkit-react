import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { RadioGroupFormField } from './RadioGroup';

import java from './images/java-96x128.png';
import python from './images/python-129x128.png';
import qore from './images/qore-106x128.png';

const meta = {
  component: RadioGroupFormField,
  title: 'Components/Form/Radio',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <RadioGroupFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof RadioGroupFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'Qore',
    items: [
      { label: 'Qore', value: 'Qore', 'aria-label': 'Qore' },
      { label: 'Java', value: 'Java', 'aria-label': 'Java' },
      { label: 'Python', value: 'Python', 'aria-label': 'Python' },
    ],
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const java = await canvas.findByLabelText('Java');
    await userEvent.click(java);
    await expect(args.onChange).toHaveBeenLastCalledWith('Java');
  },
};

export const WithImages: Story = {
  args: {
    value: 'Qore',
    items: [
      { label: 'Qore', value: 'Qore', image: qore },
      { label: 'Java', value: 'Java', image: java },
      { label: 'Python', value: 'Python', image: python },
    ],
  },
  async play({ canvasElement }) {
    await waitFor(() =>
      expect(canvasElement.querySelector(`img[src="${qore}"]`)).toBeInTheDocument()
    );
    expect(canvasElement.querySelector(`img[src="${java}"]`)).toBeInTheDocument();
    expect(canvasElement.querySelector(`img[src="${python}"]`)).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: { ...Default.args, disabled: true },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const java = await canvas.findByLabelText('Java');

    // expect rejection caused by clicking an element with pointer-events:none
    await expect(() => userEvent.click(java)).rejects.toBeTruthy();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
