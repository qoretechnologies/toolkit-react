import { StoryObj } from '@storybook/react';
import { StoryMeta } from '../../../../types';
import { FormStringField } from './String';
import { userEvent, within, expect, fn } from '@storybook/test';
import { ReqoreControlGroup } from '@qoretechnologies/reqore';
import { useState } from 'react';

const meta = {
  component: FormStringField,
  title: 'Components/Form/String',
  args: {
    onChange: fn(),
  },
} as StoryMeta<typeof FormStringField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    'aria-label': 'Name',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveAttribute('type', 'text');
    await userEvent.type(input, 'Filip');
    await expect(input).toHaveValue('Filip');
    await expect(args.onChange).toHaveBeenLastCalledWith('Filip', expect.objectContaining({}));
  },
};

export const Controllable: Story = {
  args: {
    value: 'Filip',
    label: 'Label',
    'aria-label': 'Name',
    onClearClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');

    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue('Filip');

    await userEvent.click(input.nextElementSibling);
    await expect(args.onClearClick).toHaveBeenCalledOnce();
    await expect(input).toHaveValue('');

    await userEvent.type(input, 'David');
    await expect(input).toHaveValue('David');
    await expect(args.onChange).toHaveBeenLastCalledWith('David', expect.objectContaining({}));
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <FormStringField
        {...args}
        value={value}
        onChange={(value, event) => {
          args.onChange?.(value, event);
          setValue(value);
        }}
        onClearClick={() => {
          args.onClearClick?.();
          setValue('');
        }}
      />
    );
  },
};

export const Sensitive: Story = {
  args: {
    'aria-label': 'Name',
    sensitive: true,
    value: 'password',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveValue('password');
  },
};

export const WithLabel: Story = {
  render(args) {
    return (
      <ReqoreControlGroup vertical gapSize='big'>
        <FormStringField {...args} labelPosition='left' label='Left' />
        <FormStringField {...args} labelPosition='top' label='Top' />
        <FormStringField {...args} labelPosition='right' label='Right' />
        <FormStringField {...args} labelPosition='bottom' label='Bottom' />
      </ReqoreControlGroup>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const label of ['Left', 'Top', 'Right', 'Bottom']) {
      const input = canvas.getByText(label);
      await expect(input).toBeInTheDocument();
    }
  },
};
