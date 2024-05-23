import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { CronFormField } from './Cron';

const meta = {
  component: CronFormField,
  title: 'Components/Form/Cron',
  args: {
    wrapperProps: {
      'aria-label': 'Cron',
    },
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <CronFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof CronFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: '1 1 1 1 1',
    inputProps: ['Minute', 'Hour', 'Day', 'Month', 'Weekday'].map((label) => ({
      'aria-label': label,
    })),
  },

  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const wrapper = canvas.getByLabelText('Cron');
    await expect(wrapper).toBeInTheDocument();

    await Promise.all(
      args.inputProps
        .map((p) => p['aria-label'])
        .map((label) => expect(canvas.getByLabelText(label)).toBeInTheDocument())
    );
    await userEvent.clear(canvas.getByLabelText('Minute'));
    await userEvent.type(canvas.getByLabelText('Minute'), '30');
    await expect(args.onChange).toHaveBeenLastCalledWith('30 1 1 1 1');

    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onChange).toHaveBeenLastCalledWith('');
  },
};
