import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the RadioGroup field with three language options and "Qore" pre-selected. Clicking a different option fires onChange with the new value.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const java = canvas.getByLabelText('Java');
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the RadioGroup field with three language options — each option displays its language logo alongside the label.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(canvasElement.querySelector(`img[src="${qore}"]`)).toBeInTheDocument();
    await expect(canvasElement.querySelector(`img[src="${java}"]`)).toBeInTheDocument();
    await expect(canvasElement.querySelector(`img[src="${python}"]`)).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: { ...Default.args, disabled: true },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the RadioGroup field with three language options but disabled — the group is visible and non-interactive.',
      },
    },
  },
};
