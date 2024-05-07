import { StoryObj } from '@storybook/react';
import { StoryMeta } from '../../../types';
import { FormStringField } from './String';
import { userEvent, within, expect, fn } from '@storybook/test';
import { ReqoreControlGroup } from '@qoretechnologies/reqore';
import { useState } from 'react';

const meta = {
  component: FormStringField,
  title: 'Components/Form/String',
  args: {
    onChange: fn(),
    onClearClick: fn(),
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
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');

    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue('Filip');

    await userEvent.clear(input);
    await userEvent.type(input, 'David');
    await expect(input).toHaveValue('David');
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return <FormStringField {...args} value={value} onChange={(value) => setValue(value)} />;
  },
};
export const Clearable: Story = {
  args: {
    'aria-label': 'Name',
    onClearClick: fn(),
    value: 'Filip',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue('Filip');

    // click clear button
    await userEvent.click(input.nextElementSibling);
    await expect(args.onClearClick).toHaveBeenCalledOnce();
    await expect(input).toHaveValue('');
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <FormStringField
        {...args}
        value={value}
        onChange={(value) => setValue(value)}
        onClearClick={() => {
          args.onClearClick();
          setValue('');
        }}
      />
    );
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
