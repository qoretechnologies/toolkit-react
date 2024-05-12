import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { useState } from 'react';

import { longStringText } from '../../../../../mock/fields';
import { StoryMeta } from '../../../../types';
import { LongStringFormField } from './LongString';

const meta = {
  component: LongStringFormField,
  title: 'Components/Form/LongString',
  args: {
    onChange: fn(),
    onClearClick: fn(),
    'aria-label': `LongString`,
    value: longStringText,
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <LongStringFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof LongStringFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('LongString');

    await step('Initial asserts', async () => {
      await expect(textarea).toBeInTheDocument();
      await expect(textarea).toHaveValue(args.value);
    });

    await step('Clear Longstring field', async () => {
      await userEvent.click(textarea.nextElementSibling);
      await expect(textarea).toHaveValue('');
      await expect(args.onChange).toHaveBeenLastCalledWith('');
      await expect(args.onClearClick).toHaveBeenCalledOnce();
    });

    await step('Type in the input', async () => {
      await userEvent.type(textarea, 'Qore');
      await expect(textarea).toHaveValue('Qore');
      await expect(args.onChange).toHaveBeenLastCalledWith('Qore');

      await userEvent.clear(textarea);
      await userEvent.type(textarea, args.value, { delay: null });
    });
  },
};
