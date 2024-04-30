import { StoryObj } from '@storybook/react';
import { StoryMeta } from '../../../types';
import { FormStringField } from './String';

const meta = {
  component: FormStringField,
  title: 'Components/Form/String',
} as StoryMeta<typeof FormStringField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Value: Story = {
  args: {
    value: 'Hello, World!',
  },
};
export const WithLabel: Story = {
  args: {
    label: 'Label',
  },
};
