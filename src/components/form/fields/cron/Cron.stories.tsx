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
    const wrapper = await canvas.findByLabelText('Cron');
    await expect(wrapper).toBeInTheDocument();

    await Promise.all(
      args.inputProps
        .map((p) => p['aria-label'])
        .map(async (label) => expect(await canvas.findByLabelText(label)).toBeInTheDocument())
    );
    const minute = await canvas.findByLabelText('Minute');
    await userEvent.clear(minute);
    await userEvent.type(minute, '30');
    await expect(args.onChange).toHaveBeenLastCalledWith('30 1 1 1 1');

    await userEvent.click(await canvas.findByRole('button'));
    await expect(args.onChange).toHaveBeenLastCalledWith('');
  },
};
