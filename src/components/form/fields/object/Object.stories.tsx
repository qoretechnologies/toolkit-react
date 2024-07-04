import { StoryObj } from '@storybook/react';
import { expect, fireEvent, fn } from '@storybook/test';
import { useMemo, useState } from 'react';

import jsyaml from 'js-yaml';
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

    const val = useMemo(() => {
      if (args.dataType === 'native' && typeof value === 'string') {
        if (args.resultDataType === 'yaml') {
          return jsyaml.load(value as string);
        } else if (args.resultDataType === 'json') {
          return JSON.parse(value as string);
        }
      }

      return value;
    }, [value, args.dataType, args.resultDataType]);

    return (
      <ReqraftObjectFormField
        {...args}
        value={val}
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
    value: [
      {
        key: 'value',
      },
      'Test',
      12,
      false,
    ],
  },
  async play() {
    await testsWaitForText('"value"');
  },
};

export const ValueCanBeRemoved: Story = {
  args: {
    type: 'array',
    dataType: 'native',
    resultDataType: 'native',
    value: [
      {
        key: 'value',
      },
      'Test',
      12,
      false,
    ],
  },
  async play() {
    await testsWaitForText('"value"');
    await testsClickButton({ label: 'Remove' });
    await testsWaitForText('New List');
  },
};

export const json: Story = {
  args: {
    type: 'object',
    dataType: 'json',
    value: JSON.stringify({
      key: 'value',
      bool: false,
      num: 23,
    }),
    resultDataType: 'json',
  },
  async play({ args }) {
    await testsWaitForText('"value"');
    await testsClickButton({ label: 'Text' });
    await sleep(300);
    await fireEvent.change(document.querySelector('textarea'), {
      target: {
        value: JSON.stringify(
          {
            key: 'value',
            key2: 'value2',
            bool: false,
            num: 23,
          },
          null,
          2
        ),
      },
    });
    await testsClickButton({ label: 'Save' });
    await expect(args.onChange).toHaveBeenLastCalledWith(
      JSON.stringify(
        {
          key: 'value',
          key2: 'value2',
          bool: false,
          num: 23,
        },
        null,
        2
      )
    );
    await testsClickButton({ label: 'Editor' });
    await testsWaitForText('"value2"');
  },
};

export const yaml: Story = {
  args: {
    type: 'object',
    dataType: 'yaml',
    value: jsyaml.dump({
      key: 'value',
      bool: false,
      num: 23,
    }),
    resultDataType: 'yaml',
  },
  async play({ args }) {
    await testsWaitForText('"value"');
    await testsClickButton({ label: 'Text' });
    await sleep(300);
    await fireEvent.change(document.querySelector('textarea'), {
      target: {
        value: jsyaml.dump({
          key: 'value',
          key2: 'value2',
          bool: false,
          num: 23,
        }),
      },
    });
    await testsClickButton({ label: 'Save' });
    await expect(args.onChange).toHaveBeenLastCalledWith(
      'key: value\nkey2: value2\nbool: false\nnum: 23\n'
    );
    await testsClickButton({ label: 'Editor' });
    await testsWaitForText('"value2"');
  },
};

export const YamlToJson: Story = {
  args: {
    type: 'object',
    dataType: 'yaml',
    value: jsyaml.dump({
      key: 'value',
      bool: false,
      num: 23,
    }),
    resultDataType: 'json',
  },
  async play({ args }) {
    await testsWaitForText('"value"');
    await testsClickButton({ label: 'Text' });
    await sleep(300);
    await fireEvent.change(document.querySelector('textarea'), {
      target: {
        value: jsyaml.dump({
          key: 'value',
          key2: 'value2',
          bool: false,
          num: 23,
        }),
      },
    });
    await testsClickButton({ label: 'Save' });
    await expect(args.onChange).toHaveBeenLastCalledWith(
      '{\n  "key": "value",\n  "key2": "value2",\n  "bool": false,\n  "num": 23\n}'
    );
    await testsClickButton({ label: 'Editor' });
    await testsWaitForText('"value2"');
  },
};

export const NativeToYaml: Story = {
  args: {
    type: 'object',
    dataType: 'native',
    value: {
      key: 'value',
      bool: false,
      num: 23,
    },
    resultDataType: 'yaml',
  },
  async play({ args }) {
    await testsWaitForText('"value"');
    await testsClickButton({ label: 'Text' });
    await sleep(300);
    await fireEvent.change(document.querySelector('textarea'), {
      target: {
        value: jsyaml.dump({
          key: 'value',
          key2: 'value2',
          bool: false,
          num: 23,
        }),
      },
    });
    await testsClickButton({ label: 'Save' });
    await expect(args.onChange).toHaveBeenLastCalledWith(
      jsyaml.dump({
        key: 'value',
        key2: 'value2',
        bool: false,
        num: 23,
      })
    );
    await testsClickButton({ label: 'Editor' });
    await testsWaitForText('"value2"');
  },
};
