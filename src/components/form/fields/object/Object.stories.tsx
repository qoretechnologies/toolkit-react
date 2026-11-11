import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn } from 'storybook/test';
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Object field in JSON object mode with no value. Clicking "New object" seeds an empty JSON object in the editor. The editor is the only route: no Text tab and no text box to type JSON or YAML into (Filip, 10 Nov: "there should NEVER be a free json text").',
      },
    },
  },
  async play({ canvasElement }) {
    await testsWaitForText('New object');
    await testsClickButton({ label: 'New object' });
    await testsWaitForText('{');
    await testsWaitForText('}');
    // nobody is asked to type the value as source
    await expect(canvasElement.querySelector('textarea')).toBeNull();
    await expect(canvasElement.querySelector('.reqore-tabs-list')).toBeNull();
  },
};

export const List: Story = {
  args: {
    type: 'array',
    dataType: 'yaml',
    resultDataType: 'yaml',
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Object`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the Object field in YAML list mode with no value. Clicking "New list" seeds an empty list in the editor.',
      },
    },
  },
  async play() {
    await testsWaitForText('New list');
    await testsClickButton({ label: 'New list' });
    await testsWaitForText('[');
    await testsWaitForText(']');
  },
};

export const Disabled: Story = {
  args: {
    type: 'array',
    dataType: 'native',
    resultDataType: 'native',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Object field in native-array mode but disabled — the field is visible and non-interactive.',
      },
    },
  },
};

export const Small: Story = {
  args: {
    type: 'array',
    size: 'small',
    dataType: 'native',
    resultDataType: 'yaml',
    value: [
      {
        key: 'value',
      },
      'Test',
      12,
      false,
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Object field in native-array mode at "small" size with mixed item types — object, string, number and boolean.',
      },
    },
  },
};

export const DisabledWithValue: Story = {
  args: {
    type: 'array',
    dataType: 'native',
    resultDataType: 'json',
    value: [
      {
        key: 'value',
      },
      'Test',
      12,
      false,
    ],
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Object field in native-array mode with a populated value but disabled — the items are visible in read-only form.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Object field in native-array mode with mixed item types — the native editor shows the items without a YAML/JSON textarea alternative.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Object field with a populated native array. Clicking Remove clears the value and the field falls back to the "New list" placeholder.',
      },
    },
  },
  async play() {
    await testsWaitForText('"value"');
    await testsClickButton({ label: 'Remove' });
    await testsWaitForText('New list');
  },
};

export const Json: Story = {
  args: {
    // the source text route, which a host with a guided editor of the same thing turns on (a schema builder)
    textEditing: true,
    type: 'object',
    dataType: 'json',
    value: JSON.stringify({
      key: 'value',
      bool: false,
      num: 23,
    }),
    resultDataType: 'json',
  },
  parameters: {
    docs: {
      description: {
        story:
          'With `textEditing` on, as only a host that also has a guided editor of the same source does (the IDE\'s schema builders): Renders the Object field with a JSON string value. Switching to Text mode, editing the JSON and clicking Save fires onChange with the new JSON serialization.',
      },
    },
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

export const Yaml: Story = {
  args: {
    // the source text route, which a host with a guided editor of the same thing turns on (a schema builder)
    textEditing: true,
    type: 'object',
    dataType: 'yaml',
    value: jsyaml.dump({
      key: 'value',
      bool: false,
      num: 23,
    }),
    resultDataType: 'yaml',
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Json`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'With `textEditing` on, as only a host that also has a guided editor of the same source does (the IDE\'s schema builders): Renders the Object field with a YAML string value. Switching to Text mode, editing the YAML and clicking Save fires onChange with the new YAML serialization.',
      },
    },
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
    // the source text route, which a host with a guided editor of the same thing turns on (a schema builder)
    textEditing: true,
    type: 'object',
    dataType: 'yaml',
    value: jsyaml.dump({
      key: 'value',
      bool: false,
      num: 23,
    }),
    resultDataType: 'json',
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Json`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'With `textEditing` on, as only a host that also has a guided editor of the same source does (the IDE\'s schema builders): Renders the Object field with a YAML input value and JSON output — editing the YAML in Text mode and saving fires onChange with the equivalent JSON string.',
      },
    },
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
    // the source text route, which a host with a guided editor of the same thing turns on (a schema builder)
    textEditing: true,
    type: 'object',
    dataType: 'native',
    value: {
      key: 'value',
      bool: false,
      num: 23,
    },
    resultDataType: 'yaml',
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Json`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'With `textEditing` on, as only a host that also has a guided editor of the same source does (the IDE\'s schema builders): Renders the Object field with a native object value and YAML output — editing in Text mode and saving fires onChange with the YAML serialization.',
      },
    },
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
