import { StoryObj } from '@storybook/react';
import { StoryMeta } from '../../../types';
import { FormField } from './Field';
import { fn, within, expect } from '@storybook/test';
import { useState } from 'react';
import { ReqoreControlGroup } from '@qoretechnologies/reqore';

const meta = {
  component: FormField,
  title: 'Components/Form/Field',
  args: {
    onChange: fn(),
  },
} as StoryMeta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'Filip',
    type: 'string',
  },
  render() {
    const [values, setValues] = useState({
      name: 'Filip',
      sendNotifications: true,
    } as const);

    const onChange = (field: keyof typeof values) => (value) => {
      setValues((values) => ({ ...values, [field]: value }));
    };

    return (
      <ReqoreControlGroup vertical gapSize='big'>
        <FormField
          aria-label='String'
          type='string'
          value={values.name as string}
          onChange={onChange('name') as any}
        />

        <FormField
          aria-label='Boolean'
          type='boolean'
          value={values.sendNotifications}
          onChange={onChange('sendNotifications')}
        />
      </ReqoreControlGroup>
    );
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('String')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Boolean')).toBeInTheDocument();
  },
};

export const String: Story = {
  args: {
    type: 'string',
    value: 'Filip',
  },
};
export const Boolean: Story = {
  args: {
    type: 'boolean',
    value: true,
  },
};
