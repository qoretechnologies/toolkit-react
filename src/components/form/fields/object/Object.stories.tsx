import { StoryObj } from '@storybook/react';
import { fireEvent, fn } from '@storybook/test';
import { useState } from 'react';

import { sleep, testsClickButton, testsWaitForText } from '../../../../../__tests__/utils';
import { StoryMeta } from '../../../../types';
import { ReqraftObjectFormField } from './Object';

const meta = {
  component: ReqraftObjectFormField,
  title: 'Components/Form/Object',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <ReqraftObjectFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof ReqraftObjectFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Object: Story = {
  args: {
    type: 'object',
    dataType: 'json',
    resultDataType: 'json',
  },
  async play() {
    await testsWaitForText('New Object');
    await testsClickButton({ label: 'New Object' });
    await testsWaitForText('{');
    await testsWaitForText('}');
  },
};

export const List: Story = {
  args: {
    type: 'array',
    dataType: 'yaml',
    resultDataType: 'yaml',
  },
  async play() {
    await testsWaitForText('New List');
    await testsClickButton({ label: 'New List' });
    await testsWaitForText('[');
    await testsWaitForText(']');
  },
};

export const NativeOnly: Story = {
  args: {
    type: 'array',
    dataType: 'native',
    resultDataType: 'native',
  },
  async play() {
    await testsWaitForText('New List');
    await testsClickButton({ label: 'New List' });
    await testsWaitForText('[');
    await testsWaitForText(']');
  },
};

export const Json: Story = {
  args: {
    type: 'object',
    dataType: 'json',
    value: JSON.stringify({
      key: 'value',
    }),
    resultDataType: 'json',
  },
  async play() {
    await testsWaitForText('"value"');
    await testsClickButton({ label: 'Text' });
    await sleep(300);
    await fireEvent.change(document.querySelector('textarea'), {
      target: {
        value: JSON.stringify({
          key: 'value',
          key2: 'value2',
        }),
      },
    });
  },
};
