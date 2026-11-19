import { MONO_FONT } from '@qoretechnologies/reqore/dist/constants/fonts';
import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, waitFor } from 'storybook/test';
import { useMemo, useState } from 'react';

import jsyaml from 'js-yaml';
import { sleep, testsClickButton, testsWaitForText } from '../../../../../__tests__/utils';
import { PHONE_VIEWPORT } from '../../../../stories/tracking';
import { _testsWithViewport } from '../../../../stories/Tests/utils';
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
          'Renders the Object field in JSON object mode with no value: the button that adds a row. Adding one opens its Name, and a name typed there is the object\'s first value. Rows are the only route: no Text tab and no text box to type JSON or YAML into (Filip, 10 Nov: "there should NEVER be a free json text").',
      },
    },
  },
  async play({ canvasElement, args }) {
    await testsClickButton({ label: 'Add new item for "Values"' });
    // the row just added opens the field it cannot be kept without: its Name
    const NAME_EDITOR = '.array-auto-item textarea[aria-label="Name"]';
    await waitFor(() => expect(canvasElement.querySelector(NAME_EDITOR)).toBeTruthy(), {
      timeout: 10000,
    });
    await userEvent.type(canvasElement.querySelector(NAME_EDITOR) as HTMLElement, 'region');
    await waitFor(
      () => expect(args.onChange).toHaveBeenLastCalledWith(JSON.stringify({ region: null }, null, 2)),
      { timeout: 10000 }
    );
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
          'Renders the Object field in YAML list mode with no value. Adding a row gives the list a Value to fill in, with no Name: a list\'s items have none.',
      },
    },
  },
  async play({ canvasElement }) {
    await testsClickButton({ label: 'Add new item for "Values"' });
    await testsWaitForText('Value');
    await expect(canvasElement.querySelector('.readfirst-row[data-field="name"]')).toBeNull();
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
          'Renders the Object field in native-array mode with mixed item types, a row each (a record, a word, a number, a yes / no), without a YAML or JSON text box.',
      },
    },
  },
  async play({ canvasElement }) {
    await testsWaitForText('Test');
    await waitFor(() => expect(canvasElement.querySelectorAll('.array-auto-item')).toHaveLength(4));
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
          'Renders the Object field with a populated native array. Clicking Remove clears the value: its rows go, and the button that adds one stays.',
      },
    },
  },
  async play({ canvasElement }) {
    await testsWaitForText('Test');
    await testsClickButton({ label: 'Remove' });
    await waitFor(() => expect(canvasElement.querySelectorAll('.array-auto-item')).toHaveLength(0));
    await testsWaitForText('Add new item for "Values"');
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
          'With `textEditing` on, as only a host that also has a guided editor of the same source does (the IDE\'s schema builders): Renders the Object field with a JSON string value. Switching to Text mode, editing the JSON and clicking Save fires onChange with the new JSON serialization, and the rows of the Editor tab show the new value.',
      },
    },
  },
  async play({ args }) {
    await testsWaitForText('value');
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
    await testsWaitForText('value2');
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
    await testsWaitForText('value');
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
    await testsWaitForText('value2');
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
    await testsWaitForText('value');
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
    await testsWaitForText('value2');
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
    await testsWaitForText('value');
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
    await testsWaitForText('value2');
  },
};

export const ItsSourceIsInMonospace: Story = {
  args: {
    // the source text route, which a host with a guided editor of the same thing turns on
    textEditing: true,
    type: 'object',
    dataType: 'yaml',
    resultDataType: 'yaml',
    value: jsyaml.dump({ region: 'eu-west', retries: 3, scopes: ['read', 'write'] }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "With `textEditing` on, the Text tab shows the value's YAML source in Reqore's monospace face. Reqore 0.79 draws a textarea in the page's font, as prose, and leaves monospace to the fields that ask for it; YAML is code, so this one asks (board f47).",
      },
    },
  },
  async play({ canvasElement }) {
    await testsWaitForText('eu-west');
    await testsClickButton({ label: 'Text' });

    await waitFor(() => {
      const textarea = canvasElement.querySelector('textarea') as HTMLTextAreaElement;

      expect(textarea.value).toContain('region: eu-west');
      // Reqore's own stack, not the browser's generic `monospace` (computed with double quotes)
      expect(getComputedStyle(textarea).fontFamily).toBe(MONO_FONT.replace(/'/g, '"'));
    });
  },
};

/** The values a story's rows hold, a record among them. */
const ROWS_VALUE = { region: 'eu-west', retries: 3, limits: { daily: 100 } };

/** The rows of `ROWS_VALUE`, and the record's value opened on rows of its own. */
const playValuesAreRows = async (canvasElement: HTMLElement) => {
  await testsWaitForText('region');
  await testsWaitForText('limits');
  await expect(canvasElement.querySelector('textarea')).toBeNull();
  await expect(canvasElement.querySelector('.reqore-tree')).toBeNull();

  // the record's value (the third row's) opens on rows of its own
  const VALUE_ROW = '.readfirst-row[data-field="value"]';
  await waitFor(() => expect(canvasElement.querySelectorAll(VALUE_ROW)).toHaveLength(3), {
    timeout: 10000,
  });
  await userEvent.click(canvasElement.querySelectorAll<HTMLElement>(VALUE_ROW)[2]);
  await waitFor(
    () => {
      const rows = [...canvasElement.querySelectorAll<HTMLElement>('.array-auto-item')];
      expect(rows, 'three rows and the record\'s one').toHaveLength(4);
      // in the record's row, under its value
      expect(rows[2].contains(rows[3])).toBe(true);
      expect(rows[3].textContent).toContain('daily');
    },
    { timeout: 10000 }
  );
};

export const ValuesAreRows: Story = {
  args: {
    type: 'object',
    dataType: 'native',
    resultDataType: 'native',
    value: ROWS_VALUE,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders an object\'s values as rows, a name and a typed value each, with no tree and no text to type JSON or YAML into (decision 027): region, retries, and limits, whose record is rows of its own (daily).',
      },
    },
  },
  play: async ({ canvasElement }) => playValuesAreRows(canvasElement),
};

export const ValuesAreRowsOnAPhone: Story = {
  ...ValuesAreRows,
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'The object\'s rows on a phone (390 px), with limits open on its own rows (daily), inside the screen.',
      },
    },
  },
  play: async (context) => {
    await _testsWithViewport(PHONE_VIEWPORT.width, PHONE_VIEWPORT.height, async (narrowed) => {
      await playValuesAreRows(context.canvasElement);

      if (narrowed) {
        context.canvasElement.querySelectorAll<HTMLElement>('.array-auto-item').forEach((row) => {
          expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(PHONE_VIEWPORT.width + 1);
        });
      }
    });
  },
};
