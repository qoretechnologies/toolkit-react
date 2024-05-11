import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { StringFormField } from './String';

const meta = {
  component: StringFormField,
  title: 'Components/Form/String',
  args: {
    onChange: fn(),
    onClearClick: fn(),
    'aria-label': 'Name',
  },
} as StoryMeta<typeof StringFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveAttribute('type', 'text');
    await userEvent.type(input, 'Qore');
    await expect(input).toHaveValue('Qore');
    await expect(args.onChange).toHaveBeenLastCalledWith('Qore', expect.objectContaining({}));
  },
};

export const Controllable: Story = {
  args: {
    value: 'Qore',
    label: 'Label',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');

    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue('Qore');

    await userEvent.click(input.nextElementSibling);
    await expect(args.onClearClick).toHaveBeenCalledOnce();
    await expect(input).toHaveValue('');

    await userEvent.type(input, 'Java');
    await expect(input).toHaveValue('Java');
    await expect(args.onChange).toHaveBeenLastCalledWith('Java', expect.objectContaining({}));
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <StringFormField
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

// export const WithLabel: Story = {
//   render(args) {
//     return (
//       <ReqoreControlGroup vertical gapSize='big'>
//         <StringFormField {...args} labelPosition='left' label='Left' />
//         <StringFormField {...args} labelPosition='top' label='Top' />
//         <StringFormField {...args} labelPosition='right' label='Right' />
//         <StringFormField {...args} labelPosition='bottom' label='Bottom' />
//       </ReqoreControlGroup>
//     );
//   },
//   play: async ({ canvasElement }) => {
//     const canvas = within(canvasElement);

//     for (const label of ['Left', 'Top', 'Right', 'Bottom']) {
//       const input = canvas.getByText(label);
//       await expect(input).toBeInTheDocument();
//     }
//   },
// };
