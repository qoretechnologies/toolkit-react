import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { BooleanFormField } from './Boolean';

const meta = {
  component: BooleanFormField,
  title: 'Components/Form/Boolean',
  args: {
    onChange: fn(),
    'aria-label': 'Boolean',
  },
  render(args) {
    const [checked, setChecked] = useState(args.checked);
    return (
      <BooleanFormField
        {...args}
        checked={checked}
        onChange={(checked) => {
          args.onChange?.(checked);
          setChecked(checked);
        }}
      />
    );
  },
} as StoryMeta<typeof BooleanFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checked: Story = {
  args: {
    checked: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Boolean field in the checked state. Clicking the toggle flips it to unchecked and fires onChange with false.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Yes')).toBeInTheDocument();
    await expect(canvas.getByText('No')).toBeInTheDocument();

    await userEvent.click(canvas.getByLabelText('Boolean'));
    await expect(args.onChange).toHaveBeenLastCalledWith(false);
  },
};

export const Unchecked: Story = {
  args: {
    checked: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Boolean field in the unchecked state. Clicking the toggle flips it to checked and fires onChange with true.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('No')).toBeInTheDocument();

    await userEvent.click(canvas.getByLabelText('Boolean'));
    await expect(args.onChange).toHaveBeenLastCalledWith(true);
  },
};

export const Unset: Story = {
  args: {
    checked: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Boolean field without a default choice. The switch remains visibly unset until the user explicitly chooses Yes or No.',
      },
    },
  },
};

export const UnsetSelectsYes: Story = {
  args: {
    checked: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Verifies that an unset Boolean field saves the first explicit Yes selection instead of treating the missing value as No.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByLabelText('Boolean'));
    await expect(args.onChange).toHaveBeenLastCalledWith(true);
  },
};

export const Disabled: Story = {
  args: {
    checked: true,
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Boolean field checked and disabled — the toggle is visible but non-interactive.',
      },
    },
  },
};
