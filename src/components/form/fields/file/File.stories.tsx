import { StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { ReqraftFileFormField } from './File';

const meta = {
  component: ReqraftFileFormField,
  title: 'Components/Form/File',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <ReqraftFileFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof ReqraftFileFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSpecifiedExtensions: Story = {
  args: {
    options: {
      accept: {
        'image/png': ['.png'],
        'image/jpeg': ['.jpg', '.jpeg'],
        'application/pdf': ['.pdf'],
      },
    },
  },
};

export const WithValue: Story = {
  args: {
    options: {
      accept: {
        'image/png': ['.png'],
        'image/jpeg': ['.jpg', '.jpeg'],
        'application/pdf': ['.pdf'],
      },
    },
    value: {
      name: 'MyFile.pdf',
      content: 'test',
      size: 28736,
    },
  },
};

export const Small: Story = {
  args: {
    ...WithValue.args,
    valueButtonProps: { size: 'small' },
  },
};
