import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import FileFieldArgSchema from '../../../../stories/Data/fileFieldArgSchema.json';

/**
 * The schema + value behind `Form/Engine/FormEngine › Basic`. Extracted here so
 * the Basic story and the Subtle Edit Showcase render the *same* options — every
 * field type and state the real form exercises (allowed-values, multilevel hash,
 * nested arg_schema, file, date, rgbcolor, auto, list, messages, disabled,
 * readonly, depends_on, templates) — with no subset and no drift between them.
 */
export const getBasicFormOptions = (allOptional = false): IQorusFormSchema => ({
  basicOption: { type: 'string', ui_type: 'richtext', preselected: !allOptional },
  optionWithDescription: {
    type: 'string',
    ui_type: 'richtext',
    display_name: 'Option with description',
    short_desc: 'Option with description',
    desc: 'Option with markdown `description`\n\r ## Nice',
    preselected: !allOptional,
    supports_templates: true,
  },
  optionWithDefaultValue: {
    type: 'file',
    ui_type: 'file',
    type_options: {
      accept: {
        'text/plain': ['.txt'],
      },
    },
    display_name: 'Option with default value',
    preselected: !allOptional,
    supports_templates: true,
    default_value: {
      type: 'file',
      value: {
        name: 'file.txt',
        size: 1234,
        content: 'file content',
      },
    },
  },
  booleanOption: {
    type: 'bool',
    ui_type: 'bool',
    display_name: 'Boolean option',
    required: !allOptional,
    default_value: { type: 'bool', value: true },
    supports_templates: true,
  },
  optionWithShortDescription: {
    type: 'list',
    ui_type: 'list',
    display_name: 'Option with short description',
    short_desc: 'Option with short description',
    required: !allOptional,
    depends_on: ['basicOption', 'nonExistentOption'],
    supports_templates: true,
  },
  hiddenOption: {
    type: 'string',
    ui_type: 'richtext',
    display_name: 'I am hidden',
    short_desc: 'I am hidden because I am not preselected or required',
  },
  preselectedOption: {
    type: 'auto',
    ui_type: 'richtext',
    display_name: 'I am preselected',
    short_desc: 'I am visible without any value because I am preselected',
    preselected: true,
  },
  optionWithValue: {
    type: 'string',
    ui_type: 'richtext',
    display_name: 'Option with value',
    supports_templates: true,
  },
  optionWithInvalidValue: {
    type: 'string',
    ui_type: 'richtext',
    display_name: 'Option with invalid value',
  },
  templateOption: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Template option',
    supports_templates: true,
  },
  numberOption: {
    type: 'int',
    ui_type: 'number',
    display_name: 'Number option',
    preselected: !allOptional,
    default_value: { type: 'int', value: 42 },
  },
  richTextOption: {
    type: 'richtext',
    ui_type: 'richtext',
    display_name: 'Rich Text option',
    supports_templates: true,
  },
  optionWithMessages: {
    short_desc: 'Option with some messages',
    preselected: !allOptional,
    type: 'string',
    ui_type: 'richtext',
    display_name: 'Option with messages',
    supports_templates: true,
    messages: [
      {
        title: 'Success',
        intent: 'success',
        content: 'A successful message with title',
      },
      {
        intent: 'danger',
        content: 'A dangerous message',
      },
    ],
  },
  disabledOption: {
    type: 'number',
    ui_type: 'number',
    display_name: 'Disabled option',
    disabled: true,
    preselected: !allOptional,
  },
  readOnlyOption: {
    type: 'number',
    ui_type: 'number',
    display_name: 'Read only option with default value',
    default_value: { type: 'number', value: 123 },
    default_value_desc: 'Default value is 123',
    readonly: true,
    preselected: !allOptional,
  },
  readOnlyOptionWithValue: {
    type: 'number',
    ui_type: 'number',
    display_name: 'Read only option with default value and value',
    default_value: { type: 'number', value: 123 },
    default_value_desc: 'Default value is 123',
    default_value_display_name: 'The 123 value',
    readonly: true,
    preselected: !allOptional,
  },
  optionWithAllowedValuesCreatable: {
    type: 'number',
    ui_type: 'number',
    display_name: 'Fillable option with allowed values',
    allowed_values: [
      {
        display_name: 'Allowed value 1',
        short_desc: 'Allowed value 1',
        desc: 'Allowed value 1',
        value: { type: 'number', value: 10 },
      },
      {
        display_name: 'Allowed value 2',
        short_desc: 'Allowed value 2',
        desc: 'Allowed value 2',
        value: { type: 'number', value: 20 },
      },
    ],
    required: !allOptional,
    supports_templates: true,
    allowed_values_creatable: true,
  },
  optionWithBrokenAllowedValues: {
    type: 'string',
    ui_type: 'string',
    supports_templates: true,
    display_name: 'Option with allowed values',
    allowed_values: [
      {
        display_name: 'Allowed value 1',
        short_desc: 'Allowed value 1',
        value: { type: 'string', value: 'abcde' },
      },
      // Testing invalid allowed value — missing display_name and wrong value type
      {
        value: { type: 'number', value: 12345 },
        short_desc: 'Allowed value 2',
      } as any,
    ],
    required: !allOptional,
  },
  selectedOption: {
    type: 'hash',
    ui_type: 'hash',
    supports_templates: true,
    required: true,
    display_name: 'Selected option',
    default_value: {
      type: 'hash',
      value: {
        option1: { type: 'string', value: 'value1' },
        option2: {
          type: 'hash',
          value: {
            option3: { type: 'string', value: 'value3' },
            option4: {
              type: 'list',
              value: [
                { type: 'string', value: 'value4' },
                { type: 'string', value: 'value5' },
              ],
            },
          },
        },
      },
    },
  },
  optionWithDependents: {
    supports_templates: true,
    type: 'date',
    ui_type: 'date',
    display_name: 'Option with dependents',
    short_desc: 'Option with dependents',
    has_dependents: true,
    required: !allOptional,
  },
  colorOption: {
    type: 'rgbcolor',
    ui_type: 'rgbcolor',
    required: true,
    supports_templates: true,
    default_value: { type: 'rgbcolor', value: { r: 255, g: 0, b: 0, a: 1 } },
  },
  schemaOption: {
    supports_templates: true,
    type: 'hash',
    ui_type: 'hash',
    preselected: !allOptional,
    display_name: 'Schema Option',
    short_desc: 'Option with nested arg_schema',
    arg_schema: {
      schemaOption1: {
        type: 'file',
        ui_type: 'file',
        display_name: 'Schema option 1',
        required: true,
        arg_schema: FileFieldArgSchema as IQorusFormSchema,
      },
      schemaOption2: {
        type: 'hash',
        ui_type: 'hash',
        display_name: 'Schema option with arg_schema',
        required: true,
        arg_schema: {
          schemaOption3: {
            type: 'string',
            ui_type: 'string',
            display_name: 'Schema option 3',
            required: true,
          },
        },
      },
      optionWithAutoType: {
        type: 'auto',
        ui_type: 'auto',
        display_name: 'Option with auto type',
        default_value: { type: 'auto', value: 'allowed' },
        required: true,
      },
    } as IQorusFormSchema,
  },
});

/** The `value` the Basic story seeds the form with. */
export const basicFormValue = {
  optionWithValue: { type: 'string', value: '123' },
  optionWithInvalidValue: { type: 'string', value: 123 as any },
  readOnlyOptionWithValue: { type: 'number', value: 456 },
  templateOption: { type: 'string', value: '$local:test' },
  schemaOption: {
    type: 'hash',
    value: {
      schemaOption2: {
        type: 'hash',
        value: {
          schemaOption3: {
            type: 'string',
            value: 'test',
          },
        },
      },
    },
  },
  richTextOption: {
    type: 'richtext',
    value: [
      {
        type: 'paragraph',
        children: [
          { text: 'This is a rich text option ' },
          {
            type: 'tag',
            label: 'Richtext Template',
            value: '$local:some-richtext',
            children: [{ text: '' }],
          },
          { text: '' },
        ],
      },
    ],
  },
  colorOption: { type: 'rgbcolor', value: { r: 0, g: 0, b: 255, a: 1 } },
};
