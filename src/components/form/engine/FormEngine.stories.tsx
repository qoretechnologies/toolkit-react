import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';
import { validateField } from '../../../helpers/validations';
import FileFieldArgSchema from '../../../stories/Data/fileFieldArgSchema.json';
import {
  _testsChangeRichText,
  _testsChangeStringField,
  _testsClickButton,
  _testsClickText,
  _testsOpenTemplateMenu,
  _testsOpenTemplates,
  _testsWaitForInputValue,
  _testsWaitForText,
  _testsWaitForTextsCount,
  _testsWaitForTextToNotExist,
  sleep,
} from '../../../stories/Tests/utils';
import {
  FormEngine,
  IFormEngineGroup,
  IFormEngineProps,
  IFormValidityData,
  IOptions,
  IOptionsSchema,
  IOptionsSchemaArg,
} from './FormEngine';

// ─── schema data ──────────────────────────────────────────────────────────────

const TestOptionsWithRequiredGroups: IOptionsSchema = {
  RequiredOption1: {
    type: 'richtext',
    ui_type: 'richtext',
    display_name: 'Required Option 1',
    desc: 'One of these options is required',
    required_groups: ['RequiredGroup'],
  },
  RequiredOption2: {
    type: 'richtext',
    ui_type: 'richtext',
    display_name: 'Required Option 2',
    desc: 'One of these options is required',
    required_groups: ['RequiredGroup'],
  },
  RequiredOption3: {
    type: 'richtext',
    ui_type: 'richtext',
    display_name: 'Required Option 3',
    desc: 'One of these options is required',
    required_groups: ['RequiredGroup'],
  },
  RequiredOption4: {
    type: 'richtext',
    ui_type: 'richtext',
    display_name: 'Required Option 4',
    desc: 'One of these options is required, I am also from a second group',
    required_groups: ['RequiredGroup', 'RequiredGroup2'],
  },
  RequiredOption5: {
    type: 'richtext',
    ui_type: 'richtext',
    display_name: 'Required Option 5',
    desc: 'I am from a second group',
    required_groups: ['RequiredGroup2'],
  },
};

const getOptions = (allOptional = false): IQorusFormSchema => ({
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

// ─── meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof FormEngine> = {
  component: FormEngine,
  title: 'Form/Engine/FormEngine',
  args: {
    onChange: fn(),
    onSingleOptionsChange: fn(),
    onDependableOptionChange: fn(),
    onOptionsLoaded: fn(),
    onValidityChange: fn(),
    name: 'test',
  },
  parameters: {
    chromatic: {
      viewports: [2560],
    },
  },
  render: ({ value, onChange, ...rest }: IFormEngineProps) => {
    const [val, setValue] = useState(value);

    return (
      <>
        <div id='custom-portal' />
        <FormEngine
          {...rest}
          value={val}
          onChange={(_n, v, m) => {
            setValue(v);
            onChange?.(_n, v, m);
          }}
          isValid={validateField('system-options', val, {
            optionSchema: rest.options,
          })}
          stringTemplates={{
            label: 'Testing',
            items: [
              {
                label: 'Testing bool',
                badge: 'Test',
                items: [
                  {
                    label: 'Testing bool',
                    badge: 'bool',
                    value: '$local:some-bool',
                  },
                ],
              },
              {
                label: 'Testing Richtext',
                badge: 'richtext',
                items: [
                  {
                    label: 'Richtext Template',
                    badge: 'richtext',
                    value: '$local:some-richtext',
                  },
                ],
              },
            ],
          }}
        />
      </>
    );
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

// ─── stories ──────────────────────────────────────────────────────────────────

export const Basic: Story = {
  args: {
    minColumnWidth: '300px',
    options: getOptions(),
    value: {
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
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await waitFor(() => expect(canvas.getAllByDisplayValue('$local:test')[0]).toBeInTheDocument(), {
      timeout: 10000,
    });
    await waitFor(
      () =>
        expect(
          document.querySelectorAll('.reqore-collection-item.system-option').length
        ).toBeGreaterThan(0),
      { timeout: 10000 }
    );

    await sleep(500);

    await expect(args.onChange).toHaveBeenLastCalledWith(
      'test',
      expect.objectContaining({
        booleanOption: { type: 'bool', value: true },
        optionWithValue: { type: 'string', value: '123' },
        optionWithInvalidValue: { type: 'string', value: 123 },
        templateOption: { type: 'string', value: '$local:test' },
      }),
      undefined
    );
  },
};

export const Small: Story = {
  ...Basic,
  args: {
    ...Basic.args,
    size: 'small',
  },
};

export const InvalidShownOnly: Story = {
  ...Basic,
  play: async (args) => {
    await Basic.play!(args);
    await fireEvent.click(document.querySelector('.reqore-message')!);

    await waitFor(
      () =>
        expect(
          document.querySelectorAll('.reqore-collection-item.system-option').length
        ).toBeGreaterThan(0),
      { timeout: 10000 }
    );
  },
};

export const Optional: Story = {
  args: {
    minColumnWidth: '300px',
    options: getOptions(true),
  },
};

export const OptionalOpened: Story = {
  args: {
    minColumnWidth: '300px',
    options: getOptions(true),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => expect(canvas.queryAllByText(/More Options Available/)[0]).toBeInTheDocument(),
      { timeout: 10000 }
    );

    await fireEvent.click(canvas.queryAllByText(/More Options Available/)[0]);
  },
};

export const FocusedEditing: Story = {
  ...Basic,
  play: async (args) => {
    await Basic.play!(args);
    await userEvent.hover(document.querySelectorAll('.system-option')[0]);
    await _testsClickButton({ selector: '.options-item-fullscreen', nth: 0 });
    await _testsWaitForText('Focused Editing');
  },
};

export const DescriptionIsShown: Story = {
  ...Basic,
  play: async ({ canvasElement, ...rest }) => {
    const canvas = within(canvasElement);
    await Basic.play!({ canvasElement, ...rest });
    await _testsWaitForText('Option with description');
    await fireEvent.click(canvas.queryAllByText('Option with description')[0]);
    await _testsWaitForText('Help For "Option with description"');
  },
};

export const ValueCanBeRemoved: Story = {
  args: {
    options: {
      textOption: {
        type: 'string',
        ui_type: 'richtext',
        display_name: 'Text option',
        required: true,
      },
      fileOption: {
        type: 'file',
        ui_type: 'file',
        display_name: 'File option',
        required: true,
      },
    },
    value: {
      textOption: { type: 'string', value: 'hello' },
      fileOption: {
        type: 'file',
        value: { name: 'file.txt', size: 1234, content: 'file content' },
      },
    },
  },
  play: async () => {
    await _testsWaitForText('Click here to upload a different file');
    await userEvent.hover(document.querySelectorAll('.system-option')[0]);
    await _testsClickButton({ selector: '.options-item-remove', nth: 0 });
    await userEvent.hover(document.querySelectorAll('.system-option')[1]);
    await _testsClickButton({ selector: '.options-item-remove', nth: 0 });
    await _testsWaitForTextToNotExist('Click here to upload a different file');
  },
};

export const ChangeCanBeReverted: Story = {
  ...ValueCanBeRemoved,
  play: async (args) => {
    await ValueCanBeRemoved.play!(args);
    await _testsClickButton({ selector: '.options-item-revert', nth: 1 });
    await _testsWaitForText('Click here to upload a different file');
  },
};

export const AllChangesCanBeReverted: Story = {
  ...ValueCanBeRemoved,
  play: async (args) => {
    await ValueCanBeRemoved.play!(args);
    await _testsClickButton({ selector: '.fields-revert' });
    await _testsWaitForText('Click here to upload a different file');
  },
};

export const WithTypesShown: Story = {
  ...Basic,
  play: async (args) => {
    await Basic.play!(args);
    await _testsClickButton({ selector: '.fields-show-types' });
    await _testsWaitForText('<rgbcolor>');
  },
};

export const WithRequiredGroups: Story = {
  args: {
    minColumnWidth: '300px',
    options: TestOptionsWithRequiredGroups,
  },
  play: async () => {
    await waitFor(() => expect(document.querySelectorAll('.system-option').length).toBe(5), {
      timeout: 10000,
    });
  },
};

export const WithRequiredGroupsFulfilled: Story = {
  args: {
    minColumnWidth: '300px',
    options: TestOptionsWithRequiredGroups,
    value: {
      RequiredOption4: { type: 'richtext', value: 'I rule all!' },
    },
  },
  play: async () => {
    await waitFor(() => expect(document.querySelectorAll('.system-option').length).toBe(5), {
      timeout: 10000,
    });
  },
};

export const OptionDependsOnOptionOrAnotherOption: Story = {
  args: {
    minColumnWidth: '300px',
    options: {
      ...TestOptionsWithRequiredGroups,
      RequiredOption6: {
        type: 'richtext',
        ui_type: 'richtext',
        display_name: 'Required Option 6',
        desc: 'I depend on RequiredOption2 OR RequiredOption5',
        depends_on: [['RequiredOption2', 'RequiredOption5']],
        required: true,
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(document.querySelectorAll('.system-option').length).toBe(6), {
      timeout: 10000,
    });

    await _testsWaitForText(
      'This field is disabled because some dependencies are not fulfilled: "Required Option 2", "Required Option 5"'
    );
    await _testsChangeRichText('I have value', 5);
    await _testsWaitForTextToNotExist(
      'This field is disabled because some dependencies are not fulfilled: "Required Option 2", "Required Option 5"'
    );
  },
};

export const OptionDependsOnOptionInRequiredGroup: Story = {
  args: {
    minColumnWidth: '300px',
    options: {
      ...TestOptionsWithRequiredGroups,
      RequiredOption6: {
        type: 'string',
        ui_type: 'richtext',
        display_name: 'Required Option 6',
        desc: 'I depend on RequiredOption2',
        depends_on: ['RequiredOption2'],
        required: true,
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(document.querySelectorAll('.system-option').length).toBe(6), {
      timeout: 10000,
    });

    await _testsWaitForText(
      'This field is disabled because some dependencies are not fulfilled: "Required Option 2"'
    );
    await _testsChangeRichText('I have value', 2);
    await _testsWaitForTextToNotExist(
      'This field is disabled because some dependencies are not fulfilled: "Required Option 2"'
    );
  },
};

export const OptionalWithValues: Story = {
  args: {
    minColumnWidth: '300px',
    options: getOptions(true),
    value: {
      optionWithValue: { type: 'string', value: '123' },
      optionWithInvalidValue: { type: 'string', value: 123 as any },
      templateOption: { type: 'string', value: '$local:test' },
    },
  },
};

export const OptionWithAnyType: Story = {
  args: {
    options: {
      optionWithAnyType: {
        type: 'any',
        ui_type: 'any',
        display_name: 'Option with any type',
        short_desc: 'Option with any type',
        supports_templates: true,
        required: true,
      },
      optionWithAnyTypeAndValue: {
        type: 'any',
        ui_type: 'any',
        display_name: 'Option with any type and value',
        short_desc: 'Option with any type and value',
        supports_templates: true,
        required: true,
      },
      optionWithAnyTypeToChangeToTemplate: {
        type: 'any',
        ui_type: 'any',
        display_name: 'Option with any type to change',
        short_desc: 'Option with any type to change',
        supports_templates: true,
        required: true,
      },
      optionWithAnyTypeToChangeToTemplateToCustomData: {
        type: 'any',
        ui_type: 'any',
        display_name: 'Option with any type to change to custom data',
        short_desc: 'Option with any type to change to custom data',
        supports_templates: true,
        required: true,
      },
    },
    value: {
      optionWithAnyTypeAndValue: {
        type: 'number',
        value: 1234,
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  play: async ({ canvasElement }) => {
    // Fields without a value and ui_type='any' show a template dropdown labelled "Select Template"
    await _testsWaitForText('Select Template');

    // The field with user-selected type 'number' must show a number input — NOT a template dropdown.
    // This guards against the bug where availableOptions overwrites the stored type with schema 'any'.
    await _testsWaitForInputValue(1234);

    // Open the 3rd template-selector dropdown and pick a template value.
    // (.template-selector.reqore-control buttons: 1=optionWithAnyType, 2=optionWithAnyTypeToChangeToTemplate,
    //  3=optionWithAnyTypeToChangeToTemplateToCustomData — optionWithAnyTypeAndValue shows a number input, no dropdown)
    await _testsOpenTemplates(3);
    await _testsClickButton({ label: 'Testing Richtext' });
    await _testsClickButton({ label: 'Richtext Template' });

    // Open the ... menu on the 4th field (optionWithAnyTypeToChangeToTemplateToCustomData)
    // and switch it to a specific custom type (Boolean).
    await _testsOpenTemplateMenu(4);
    await _testsClickButton({ label: 'Set Custom Value' });
    await _testsClickButton({ label: 'True or False' });
  },
};

export const NonExistentOptionsFiltered: Story = {
  args: {
    value: {
      option1: { type: 'long-string', value: 'option1' },
      option2: { type: 'long-string', value: 'option2' },
      option3: { type: 'long-string', value: 'option3' },
    },
    options: {
      option1: { type: 'string', ui_type: 'long-string' },
      option2: { type: 'string', ui_type: 'long-string' },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await waitFor(() => expect(canvas.getAllByDisplayValue('option1')[0]).toBeInTheDocument(), {
      timeout: 10000,
    });
    await fireEvent.change(document.querySelectorAll('.system-option .reqore-textarea')[0], {
      target: { value: 'option1a' },
    });

    await sleep(500);

    await expect(args.onChange).toHaveBeenLastCalledWith(
      'test',
      {
        option1: { type: 'long-string', value: 'option1a' },
        option2: { type: 'long-string', value: 'option2' },
      },
      undefined
    );
  },
};

export const OptionsWithOnChangeTriggerEvents: Story = {
  args: {
    value: {
      optionWithRefetchAndReset: { type: 'long-string', value: 'option1' },
      option2: { type: 'long-string', value: 'option2' },
    },
    options: {
      optionWithRefetchAndReset: {
        type: 'string',
        ui_type: 'long-string',
        on_change: ['refetch'],
      },
      option2: { type: 'string', ui_type: 'long-string' },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await waitFor(() => expect(canvas.getAllByDisplayValue('option1')[0]).toBeInTheDocument(), {
      timeout: 10000,
    });
    await fireEvent.change(document.querySelectorAll('.system-option .reqore-textarea')[0], {
      target: { value: 'option1a' },
    });

    await sleep(500);

    await expect(args.onChange).toHaveBeenLastCalledWith(
      'test',
      {
        optionWithRefetchAndReset: { type: 'long-string', value: 'option1a' },
        option2: { type: 'long-string', value: 'option2' },
      },
      {
        events: ['refetch'],
      }
    );
  },
};

export const DependantsResetWhenParentChanges: Story = {
  args: {
    minColumnWidth: '300px',
    options: {
      optionWithDependents: {
        type: 'string',
        ui_type: 'long-string',
        display_name: 'Option with dependents',
        short_desc: 'Option with dependents',
        has_dependents: true,
        required: true,
      },
      anotherDependent: {
        type: 'string',
        ui_type: 'long-string',
        display_name: 'Another dependent',
        short_desc: 'Another dependent',
        has_dependents: true,
        required: true,
      },
      dependent1: {
        type: 'string',
        ui_type: 'long-string',
        display_name: 'Dependent 1',
        short_desc: 'Dependent 1',
        depends_on: ['optionWithDependents'],
        required: true,
      },
      dependent2: {
        type: 'hash',
        ui_type: 'hash',
        display_name: 'Dependent 2',
        short_desc: 'Dependent 2',
        depends_on: ['optionWithDependents'],
        required: true,
      },
    },
    value: {
      optionWithDependents: { type: 'long-string', value: 'I have a value' },
      anotherDependent: { type: 'long-string', value: 'My value will not change' },
      dependent1: { type: 'long-string', value: 'I have a value too' },
      dependent2: { type: 'hash', value: undefined },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => expect(canvas.getAllByDisplayValue('I have a value')[0]).toBeInTheDocument(),
      { timeout: 10000 }
    );
    await waitFor(
      () =>
        expect(document.querySelectorAll('.reqore-collection-item.system-option').length).toBe(4),
      { timeout: 10000 }
    );

    await fireEvent.change(document.querySelectorAll('.system-option .reqore-textarea')[0], {
      target: { value: 'My value changed' },
    });

    await sleep(500);

    await expect(args.onChange).toHaveBeenLastCalledWith(
      'test',
      expect.objectContaining({
        optionWithDependents: { type: 'long-string', value: 'My value changed' },
        anotherDependent: { type: 'long-string', value: 'My value will not change' },
        dependent1: { type: 'long-string', value: '' },
        dependent2: { type: 'hash', value: undefined },
      }),
      undefined
    );
  },
};

export const ValueIsFixedWhenDefaultValueDoesNotMatchAndReadOnlyIsTrue: Story = {
  args: {
    minColumnWidth: '300px',
    options: {
      wrongDefaultValue: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Option with different default_value',
        short_desc: 'This option will be fixed',
        required: true,
        default_value: { type: 'string', value: 'I am the only correct default value' },
        readonly: true,
      },
      correctDefaultValue: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Option with same default_value',
        short_desc: 'This option will stay the same',
        default_value: { type: 'string', value: 'I am the only correct default value' },
        readonly: true,
        required: true,
      },
    },
    value: {
      wrongDefaultValue: { type: 'string', value: 'I am the wrong value :(' },
      correctDefaultValue: { type: 'string', value: 'I am the only correct default value' },
    },
  },
  play: async ({ args }) => {
    await _testsWaitForTextToNotExist('I am the wrong value :(');

    await sleep(500);
    await expect(args.onChange).toHaveBeenLastCalledWith(
      'test',
      expect.objectContaining({
        wrongDefaultValue: { type: 'string', value: 'I am the only correct default value' },
        correctDefaultValue: { type: 'string', value: 'I am the only correct default value' },
      }),
      undefined
    );
  },
};

export const DoesNotCauseInfiniteRerenders: Story = {
  args: {
    minColumnWidth: '300px',
    options: {
      data_provider: {
        display_name: 'Record-Based Data Provider',
        desc: 'The record-based data provider to use for the operation',
        required: true,
        on_change: ['refetch'],
        supports_custom_values: true,
        supports_templates: true,
        type: 'string',
        ui_type: 'richtext',
        has_dependents: true,
        sort: 1,
        default_value: { type: 'richtext', value: 'Test' },
      },
      recs: {
        display_name: 'Records to Upsert',
        desc: 'One or more records to upsert of the record type',
        required: true,
        depends_on: ['data_provider'],
        supports_custom_values: true,
        supports_templates: true,
        type: 'list',
        ui_type: 'list',
        element_type: 'hash',
        ui_element_type: 'hash',
        arg_schema: {
          id: {
            type: 'richtext',
            ui_type: 'richtext',
            desc: 'varchar(20) NOT NULL; PK ID field',
            required: true,
            supports_templates: true,
            display_name: 'id',
            short_desc: 'varchar(20) NOT NULL; PK ID field',
          },
          batch_id: {
            type: 'richtext',
            ui_type: 'richtext',
            desc: 'varchar(20) NOT NULL; batch ID field',
            required: true,
            supports_templates: true,
            display_name: 'batch_id',
            short_desc: 'varchar(20) NOT NULL; batch ID field',
          },
        },
        sort: 2,
      },
    },
  },
  play: async () => {
    await _testsWaitForText('Records to Upsert');
    await _testsWaitForText('Record-Based Data Provider');
    await _testsClickButton({ label: 'Add new item for "Records to Upsert"' });
    await _testsWaitForText('batch_id');
  },
};

export const AllowedValuesOptionWithTemplateValueShowsWarning: Story = {
  args: {
    minColumnWidth: '300px',
    options: {
      option1: {
        display_name: 'Option with allowed values',
        desc: 'The option with allowed values to use for the operation',
        required: true,
        supports_custom_values: false,
        supports_templates: true,
        type: 'string',
        ui_type: 'richtext',
        allowed_values: [
          {
            display_name: 'Allowed value 1',
            short_desc: 'Allowed value 1',
            desc: 'Allowed value 1',
            value: { type: 'string', value: 'allowed-1' },
          },
          {
            display_name: 'Allowed value 2',
            short_desc: 'Allowed value 2',
            desc: 'Allowed value 2',
            value: { type: 'string', value: 'allowed-2' },
          },
        ],
        sort: 1,
      },
    },
    value: {
      option1: { type: 'string', value: '$local:test' },
    },
  },
  play: async () => {
    await _testsWaitForText(
      'This field has pre-defined allowed values, make sure the template you select is compatible with those'
    );
  },
};

export const OnValidityChange: Story = {
  parameters: {
    chromatic: { disable: true },
  },
  args: {
    options: {
      requiredField: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Required Field',
        required: true,
        preselected: true,
      },
      optionalField: {
        type: 'number',
        ui_type: 'number',
        display_name: 'Optional Field',
        preselected: true,
      },
    },
    value: {},
  },
  render: ({ value, onChange, onValidityChange, ...rest }: IFormEngineProps) => {
    const [val, setValue] = useState(value);
    const [validityData, setValidityData] = useState<IFormValidityData | null>(null);

    return (
      <>
        <FormEngine
          {...rest}
          value={val}
          onChange={(_n, v, m) => {
            setValue(v);
            onChange?.(_n, v, m);
          }}
          onValidityChange={(isValid, data) => {
            setValidityData(data);
            onValidityChange?.(isValid, data);
          }}
        />
        {validityData && (
          <div data-testid='validity-output'>
            <span data-testid='validity-is-valid'>{String(validityData.isValid)}</span>
            <span data-testid='validity-total-fields'>{validityData.fields.length}</span>
            <span data-testid='validity-invalid-count'>{validityData.invalidFields.length}</span>
            {validityData.invalidFields.map((f) => (
              <span key={f.fieldName} data-testid={`invalid-field-${f.fieldName}`}>
                {f.validation.reason}
              </span>
            ))}
          </div>
        )}
      </>
    );
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for the form to render and validity to be reported
    await waitFor(() => expect(canvas.getByTestId('validity-output')).toBeInTheDocument(), {
      timeout: 10000,
    });

    // The form should be invalid initially because requiredField is empty
    await waitFor(() => {
      expect(canvas.getByTestId('validity-is-valid').textContent).toBe('false');
      expect(canvas.getByTestId('validity-invalid-count').textContent).toBe('1');
      expect(canvas.getByTestId('invalid-field-requiredField')).toBeInTheDocument();
    });

    // onValidityChange should have been called with false and detailed data
    await waitFor(() => {
      expect(args.onValidityChange).toHaveBeenCalled();

      const calls = (args.onValidityChange as ReturnType<typeof fn>).mock.calls;
      const [isValid, data] = calls[calls.length - 1];

      expect(isValid).toBe(false);
      expect(data.isValid).toBe(false);
      expect(Array.isArray(data.fields)).toBe(true);
      expect(data.invalidFields.length).toBe(1);

      const invalidField = data.invalidFields[0];
      expect(invalidField.fieldName).toBe('requiredField');
      expect(invalidField.validation.isValid).toBe(false);
      expect(typeof invalidField.validation.reason).toBe('string');
      expect(Array.isArray(invalidField.validation.reasons)).toBe(true);
    });

    // Type a value into the required field to make the form valid. Wait for the
    // editor to mount before firing the change — querying it unguarded was the
    // source of an intermittent "please provide a DOM element" CI flake.
    await _testsChangeStringField({
      selector: '.system-option .reqore-textarea',
      value: 'hello',
    });

    // Now the form should be valid
    await waitFor(() => {
      expect(canvas.getByTestId('validity-is-valid').textContent).toBe('true');
      expect(canvas.getByTestId('validity-invalid-count').textContent).toBe('0');
    });

    // onValidityChange should have been called with true and no invalid fields
    await waitFor(() => {
      const calls = (args.onValidityChange as ReturnType<typeof fn>).mock.calls;
      const [isValid, data] = calls[calls.length - 1];

      expect(isValid).toBe(true);
      expect(data.isValid).toBe(true);
      expect(data.invalidFields).toHaveLength(0);
    });
  },
};

// ─── compact (read-first) mode ──────────────────────────────────────────────────

// `group` is server-supplied metadata not yet in the typed schema; widen locally.
type TCompactField = IOptionsSchemaArg & { group?: string };

const CompactSchema: Record<string, TCompactField> = {
  name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Name',
    short_desc: 'Unique identifier for this interface',
    required: true,
    preselected: true,
    group: 'info',
  },
  lang: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Language',
    short_desc: 'Implementation language',
    preselected: true,
    group: 'info',
    allowed_values: [
      { value: { type: 'string', value: 'qore' }, display_name: 'Qore' },
      { value: { type: 'string', value: 'python' }, display_name: 'Python' },
      { value: { type: 'string', value: 'java' }, display_name: 'Java' },
    ],
  },
  description: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Description',
    short_desc: 'What this interface does',
    required: true,
    preselected: true,
    group: 'general',
  },
  tags: {
    type: 'list',
    ui_type: 'list',
    display_name: 'Tags',
    preselected: true,
    group: 'general',
  },
  autostart: {
    type: 'number',
    ui_type: 'number',
    display_name: 'Autostart',
    short_desc: 'Number of instances to start',
    preselected: true,
    group: 'scaling',
  },
  remote: {
    type: 'bool',
    ui_type: 'bool',
    display_name: 'Remote',
    short_desc: 'Run on a remote Qorus instance',
    preselected: true,
    group: 'scaling',
  },
};

// `description` is intentionally left empty so the required-but-unset state is
// visible (a "Required — not set" row and an invalid-field message).
const CompactValue: IOptions = {
  name: { type: 'string', value: 'order-fulfilment' },
  lang: { type: 'string', value: 'python' },
  tags: { type: 'list', value: ['orders', 'batch'] },
  autostart: { type: 'number', value: 1 },
  remote: { type: 'bool', value: true },
};

// Group display metadata (icon / subtitle / order), keyed by the raw `group`.
// The server only sends the bare group key, so the consumer supplies this.
const CompactGroups: Record<string, IFormEngineGroup> = {
  info: { icon: 'IdCardLine', subtitle: 'Identity and core settings', sort: 0 },
  general: { icon: 'FileTextLine', sort: 1 },
  scaling: { icon: 'BroadcastLine', sort: 2 },
};

// Open the compact "Fields" dropdown and click the menu item with the given
// label. The dropdown's popover renders in a portal (outside canvasElement), so
// menu items are queried against the whole document.
const clickFieldsMenuItem = async (text: string) => {
  await _testsClickButton({ selector: '.options-readfirst-fields' });
  let item: Element | undefined;
  await waitFor(
    () => {
      item = Array.from(document.querySelectorAll('.reqore-menu-item')).find((element) =>
        element.textContent?.includes(text)
      );
      expect(item).toBeTruthy();
    },
    { timeout: 5000 }
  );
  await fireEvent.click(item as Element);
};

// CompactSchema plus one optional (non-preselected) field, to exercise the
// "Fields" menu add / select-all / reset actions.
const CompactFieldsMenuSchema: Record<string, TCompactField> = {
  ...CompactSchema,
  notes: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Notes',
    short_desc: 'Free-form notes',
    group: 'general',
  },
};

export const Compact: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue,
    groups: CompactGroups,
  },
};

export const CompactReadOnly: Story = {
  args: {
    ...Compact.args,
    readOnly: true,
  },
};

export const CompactEmpty: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: {},
    groups: CompactGroups,
  },
};

export const CompactReadFirstEditing: Story = {
  parameters: {
    chromatic: { disable: true },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue,
    groups: CompactGroups,
  },
  play: async ({ args }) => {
    // Read-first: each set option shows its formatted value as a row, and the
    // real editor is NOT mounted until a row is expanded.
    await _testsWaitForText('order-fulfilment');
    // Booleans render as Yes/No, allowed_values as their display label.
    await _testsWaitForText('Yes');
    await _testsWaitForText('Python');
    // The required-but-empty field shows its placeholder instead of an editor.
    await _testsWaitForText('Required — not set');
    // No field editor (textarea) is mounted while everything is collapsed.
    await expect(document.querySelectorAll('.options-readfirst-card .reqore-textarea')).toHaveLength(
      0
    );

    // Group headers are rendered from each option's `group`.
    await _testsWaitForText('Info');
    await _testsWaitForText('Scaling');

    // Expanding the Name row reveals the real editor pre-filled with the value.
    await _testsClickText('order-fulfilment');
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-card .reqore-textarea');

    // Editing flows through the real onChange pipeline.
    await _testsChangeStringField({
      selector: '.options-readfirst-card .reqore-textarea',
      value: 'updated-name',
    });
    await waitFor(() => {
      const calls = (args.onChange as ReturnType<typeof fn>).mock.calls;
      const last = calls[calls.length - 1];
      expect((last[1] as IOptions)?.name?.value).toBe('updated-name');
    });

    // "Done" collapses the row back to read-first, showing the new value.
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('updated-name');
  },
};

export const CompactRequiredOnlyAndSearch: Story = {
  parameters: {
    chromatic: { disable: true },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue,
    groups: CompactGroups,
  },
  play: async () => {
    // All groups/fields listed to start.
    await _testsWaitForText('Language');
    await _testsWaitForText('Scaling');

    // "Required only" (in the Fields menu) narrows the list to required fields
    // (Name, Description); optional fields and any now-empty group disappear.
    await clickFieldsMenuItem('Required only');
    await _testsWaitForTextToNotExist('Language');
    await _testsWaitForTextToNotExist('Scaling');
    await _testsWaitForText('Name');
    await _testsWaitForText('Description');

    // Toggle it back off — everything returns.
    await clickFieldsMenuItem('Required only');
    await _testsWaitForText('Language');

    // The search box filters rows by label.
    await _testsChangeStringField({
      selector: 'input[placeholder="Filter fields..."]',
      value: 'remote',
    });
    await _testsWaitForText('Remote');
    await _testsWaitForTextToNotExist('Name');
    await _testsWaitForTextToNotExist('Language');
  },
};

export const CompactFieldsMenu: Story = {
  parameters: {
    chromatic: { disable: true },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactFieldsMenuSchema,
    value: CompactValue,
    groups: CompactGroups,
  },
  play: async () => {
    await _testsWaitForText('Tags');
    // 'Notes' is optional and unset, so it is not listed as a row yet.
    await _testsWaitForTextToNotExist('Notes');

    // "Select all" adds every optional field — Notes now appears as a row.
    await clickFieldsMenuItem('Select all');
    await _testsWaitForText('Notes');

    // "Default fields" drops the user-added optional fields — Notes is removed.
    await clickFieldsMenuItem('Default fields');
    await _testsWaitForTextToNotExist('Notes');
  },
};

export const CompactSearchHidden: Story = {
  parameters: {
    chromatic: { disable: true },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactFieldsMenuSchema,
    value: CompactValue,
    groups: CompactGroups,
  },
  play: async () => {
    await _testsWaitForText('Tags');
    // 'Notes' is an optional, unset field — not listed among the rows.
    await _testsWaitForTextToNotExist('Notes');

    // The top search spans hidden fields too: typing 'notes' surfaces it as an
    // add-able row even though it isn't part of the form yet.
    await _testsChangeStringField({
      selector: 'input[placeholder="Filter fields..."]',
      value: 'notes',
    });
    await _testsWaitForText('Notes');
    await _testsWaitForText('Not in form — add');

    // Rows are keyboard-operable (role=button + Enter): focusing the hidden row
    // and pressing Enter adds the field and opens its editor.
    const row = document.querySelector('[data-field="notes"]') as HTMLElement;
    row.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(
      () =>
        expect(
          document.querySelectorAll('.options-readfirst-card .reqore-textarea').length
        ).toBeGreaterThan(0),
      { timeout: 10000 }
    );
  },
};

// CompactSchema plus several optional fields, so the form is taller and there
// are "additional options" to surface (used to show the sticky add bar).
const CompactScrollableSchema: Record<string, TCompactField> = {
  ...CompactSchema,
  notes: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Notes',
    short_desc: 'Free-form notes',
    group: 'general',
  },
  order_keys: {
    type: 'list',
    ui_type: 'list',
    display_name: 'Order keys',
    short_desc: 'Workflow order keys',
    group: 'general',
  },
  sla_warning: {
    type: 'number',
    ui_type: 'number',
    display_name: 'SLA warning',
    short_desc: 'SLA warning threshold (seconds)',
    group: 'scaling',
  },
  alert_on_error: {
    type: 'bool',
    ui_type: 'bool',
    display_name: 'Alert on error',
    short_desc: 'Raise an alert when the workflow errors',
    group: 'scaling',
  },
};

export const CompactScrollable: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactScrollableSchema,
    value: CompactValue,
    groups: CompactGroups,
  },
};

// Repro for the "r.map is not a function" crash when opening a `list` field with
// no element constraints (e.g. a connection's `oauth2_scopes`) that carries a
// `default` array. Exact shape from the live server's protocol options.
const OAuth2ScopesSchema = {
  name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Name',
    preselected: true,
  },
  oauth2_scopes: {
    type: 'list',
    display_name: 'OAuth2 Scopes',
    short_desc: 'List of OAuth2 scopes to request',
    desc: 'List of OAuth2 scope strings to request',
    default: [
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/youtube',
      'email',
      'profile',
      'openid',
    ],
  },
} as any;

export const CompactListYamlField: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      ...OAuth2ScopesSchema,
      oauth2_scopes: { ...OAuth2ScopesSchema.oauth2_scopes, preselected: true },
    },
    value: {
      name: { type: 'string', value: 'youtube' },
      // The real shape the IDE hands the field: the list serialized as a YAML
      // string. The read row must SUMMARISE it (not print `%YAML 1.2 --- …`), and
      // opening it must not crash (see __tests__/common.test.ts + readFirst.test.ts).
      oauth2_scopes: {
        type: 'list',
        value:
          '%YAML 1.2\n---\n["https://www.googleapis.com/auth/youtube.force-ssl", "https://www.googleapis.com/auth/youtube.upload", "email", "profile"]\n' as any,
      },
    },
  },
};

// Regression guard for (a) horizontal overflow from a long unbroken value and
// (b) the sticky-top toolbar. The `notes` value is a long URL-like string with no
// break points: with a bare `1fr` value track it forced a horizontal scrollbar;
// the value column is now `minmax(0, 1fr)` + the cell has `min-width: 0`, so it
// ellipsis-truncates. Render in a short/narrow viewport and scroll to see the
// completion + search + Fields header stay pinned.
export const CompactOverflowAndStickyHeader: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactScrollableSchema,
    groups: CompactGroups,
    value: {
      ...CompactValue,
      notes: {
        type: 'string',
        value:
          'tsrest-youtube://www.googleapis.com/youtube/v3/very/long/path/segment/that/keeps/going/and/going/without/any/spaces/to/break/on',
      },
    },
  },
};

// Verifies that compact mode honours the rich options-schema behaviours
// (on_change/refetch + has_dependents/depends_on) — these flow through the same
// `handleValueChange`/`renderOption` the classic layout uses, so editing a field
// in the expanded read-first editor must still fire `on_change` events and reset
// its dependents.
export const CompactOnChangeAndDependents: Story = {
  parameters: {
    chromatic: { disable: true },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      source: {
        type: 'string',
        ui_type: 'long-string',
        display_name: 'Source',
        short_desc: 'Changing this refetches options and resets its dependents',
        has_dependents: true,
        on_change: ['refetch'],
        required: true,
        preselected: true,
      },
      target: {
        type: 'string',
        ui_type: 'long-string',
        display_name: 'Target',
        short_desc: 'Depends on Source',
        depends_on: ['source'],
        required: true,
        preselected: true,
      },
    } as IOptionsSchema,
    value: {
      source: { type: 'long-string', value: 'orders' },
      target: { type: 'long-string', value: 'staging' },
    } as IOptions,
  },
  play: async ({ args }) => {
    // Read-first: both fields show their values as rows.
    await _testsWaitForText('orders');
    await _testsWaitForText('staging');

    // Expand the Source row and change it.
    await _testsClickText('orders');
    await _testsWaitForInputValue('orders', '.options-readfirst-card .reqore-textarea');
    await _testsChangeStringField({
      selector: '.options-readfirst-card .reqore-textarea',
      value: 'invoices',
    });

    // The change must (a) carry the on_change 'refetch' event and (b) reset the
    // dependent 'target' — exactly as in the classic layout.
    await waitFor(() => {
      const calls = (args.onChange as ReturnType<typeof fn>).mock.calls;
      const refetchCall = calls.find((call) => (call[2] as any)?.events?.includes('refetch'));
      expect(refetchCall).toBeTruthy();
      const value = refetchCall![1] as IOptions;
      expect(value?.source?.value).toBe('invoices');
      expect(value?.target?.value).not.toBe('staging');
    });
  },
};

export const CompactRevertAndShowTypes: Story = {
  parameters: {
    chromatic: { disable: true },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue,
    groups: CompactGroups,
  },
  play: async () => {
    await _testsWaitForText('order-fulfilment');

    // Edit Name, then collapse — because it now differs from the loaded value, a
    // per-field revert (↺) appears on the row.
    await _testsClickText('order-fulfilment');
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-card .reqore-textarea');
    await _testsChangeStringField({
      selector: '.options-readfirst-card .reqore-textarea',
      value: 'changed-name',
    });
    await sleep(300); // settle: let the edit propagate before collapsing
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('changed-name'); // gate

    // Per-field revert restores the loaded value. (Hover-only action — click it
    // directly rather than via _testsClickButton's userEvent visibility checks.)
    const revert = document.querySelector(
      '[data-field="name"] .options-readfirst-revert'
    ) as HTMLElement;
    expect(revert).toBeTruthy();
    await fireEvent.click(revert);
    await _testsWaitForText('order-fulfilment');
    await _testsWaitForTextToNotExist('changed-name');

    // "Show field types" (Fields menu) annotates each row with its type.
    await clickFieldsMenuItem('Show field types');
    await _testsWaitForText('<string>');

    // Edit again, then the global "Revert all changes" restores everything.
    await _testsClickText('order-fulfilment');
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-card .reqore-textarea');
    await _testsChangeStringField({
      selector: '.options-readfirst-card .reqore-textarea',
      value: 'edited-again',
    });
    await sleep(300); // settle
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('edited-again'); // gate

    await clickFieldsMenuItem('Revert all changes');
    await _testsWaitForText('order-fulfilment');
  },
};

// ─── compact parity with the classic story matrix ──────────────────────────────

// Read-first display + expand-to-edit across EVERY field type the engine
// renders (one option per UI type). This is the comprehensive field-type
// reference for compact mode — keep it in sync when a new field type is added.
export const CompactFieldTypes: Story = {
  parameters: { chromatic: { disable: true } },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      text: { type: 'string', ui_type: 'string', display_name: 'String', preselected: true },
      longText: {
        type: 'string',
        ui_type: 'long-string',
        display_name: 'Long string',
        preselected: true,
      },
      markdownText: {
        type: 'string',
        ui_type: 'markdown',
        display_name: 'Markdown',
        preselected: true,
      },
      richText: {
        type: 'richtext',
        ui_type: 'richtext',
        display_name: 'Rich text',
        preselected: true,
      },
      template: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Template (templated string)',
        supports_templates: true,
        preselected: true,
      },
      count: { type: 'int', ui_type: 'number', display_name: 'Integer', preselected: true },
      ratio: { type: 'float', ui_type: 'number', display_name: 'Float', preselected: true },
      enabled: { type: 'bool', ui_type: 'bool', display_name: 'Boolean', preselected: true },
      when: { type: 'date', ui_type: 'date', display_name: 'Date', preselected: true },
      schedule: { type: 'string', ui_type: 'cron', display_name: 'Cron', preselected: true },
      colour: { type: 'rgbcolor', ui_type: 'rgbcolor', display_name: 'Colour', preselected: true },
      upload: { type: 'file', ui_type: 'file', display_name: 'File', preselected: true },
      language: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Select (allowed_values)',
        preselected: true,
        allowed_values: [
          { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
          { display_name: 'Python', value: { type: 'string', value: 'python' } },
        ],
      },
      tags: {
        type: 'list',
        ui_type: 'list',
        display_name: 'Multi-select (element_allowed_values)',
        preselected: true,
        element_allowed_values: [
          { display_name: 'Orders', value: { type: 'string', value: 'orders' } },
          { display_name: 'Batch', value: { type: 'string', value: 'batch' } },
        ],
        element_allowed_values_creatable: false,
      },
      items: { type: 'list', ui_type: 'list', display_name: 'List', preselected: true },
      config: { type: 'hash', ui_type: 'hash', display_name: 'Hash', preselected: true },
      // cast through `unknown`: this set spans more ui_types (long-string, markdown,
      // cron, file, date, float) than the IOptionsSchema literal union models,
      // though the engine renders them all at runtime.
    } as unknown as IOptionsSchema,
    value: {
      text: { type: 'string', value: 'hello' },
      longText: {
        type: 'string',
        value: 'A longer paragraph of text that wraps across more than one line in the editor.',
      },
      markdownText: { type: 'string', value: '# Heading\nSome **bold** text' },
      richText: {
        type: 'richtext',
        value: [{ type: 'paragraph', children: [{ text: 'rich note' }] }],
      },
      template: { type: 'string', value: '$config:billing_url' },
      count: { type: 'int', value: 42 },
      ratio: { type: 'float', value: 0.75 },
      enabled: { type: 'bool', value: true },
      when: { type: 'date', value: '2026-06-09' },
      schedule: { type: 'string', value: '0 0 * * *' },
      colour: { type: 'rgbcolor', value: { r: 0, g: 0, b: 255, a: 1 } },
      upload: { type: 'file', value: { name: 'config.txt', size: 1234, content: 'data' } },
      language: { type: 'string', value: 'python' },
      tags: {
        type: 'list',
        value: [
          { type: 'string', value: 'orders' },
          { type: 'string', value: 'batch' },
        ],
      },
      items: { type: 'list', value: ['a', 'b'] },
      config: { type: 'hash', value: { k: 'v' } },
    } as IOptions,
  },
  play: async () => {
    // Each type renders a read-first value (no editor mounted yet). Representative
    // assertions across the display behaviours: scalars, Yes/No, allowed-value
    // labels, list joins, richtext flattening, and the opaque "Set" marker.
    await _testsWaitForText('hello'); // string
    await _testsWaitForText('$config:billing_url'); // templated string
    await _testsWaitForText('rich note'); // richtext flattened to plain text
    await _testsWaitForText('42'); // integer
    await _testsWaitForText('0.75'); // float
    await _testsWaitForText('Yes'); // bool → Yes/No
    await _testsWaitForText('2026-06-09'); // date
    await _testsWaitForText('0 0 * * *'); // cron
    await _testsWaitForText('Python'); // select → allowed_value display label
    await _testsWaitForText('orders, batch'); // multi-select joined
    await _testsWaitForText('a, b'); // list joined
    await _testsWaitForText('Set'); // opaque hash / colour / file → "Set"
    await expect(document.querySelectorAll('.options-readfirst-card')).toHaveLength(0);

    // Expanding a row mounts the real editor.
    await _testsClickText('hello');
    await waitFor(() => expect(document.querySelector('.options-readfirst-card')).toBeTruthy(), {
      timeout: 10000,
    });
  },
};

// `required_groups` (one-of) renders the required marker on each member.
export const CompactRequiredGroups: Story = {
  parameters: { chromatic: { disable: true } },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      byUrl: {
        type: 'string',
        ui_type: 'string',
        display_name: 'By URL',
        required_groups: ['target'],
        preselected: true,
      },
      byHost: {
        type: 'string',
        ui_type: 'string',
        display_name: 'By host',
        required_groups: ['target'],
        preselected: true,
      },
    } as IOptionsSchema,
    value: {} as IOptions,
  },
  play: async () => {
    // Both members of the required group show the required placeholder.
    await _testsWaitForTextsCount('Required — not set', undefined, 2);

    // Setting one member: expand it, type a value, collapse — its value shows.
    await _testsClickText('By URL');
    await waitFor(
      () => expect(document.querySelector('.options-readfirst-card .reqore-textarea')).toBeTruthy(),
      { timeout: 10000 }
    );
    await _testsChangeStringField({
      selector: '.options-readfirst-card .reqore-textarea',
      value: 'https://example.com',
    });
    await sleep(300);
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('https://example.com');
  },
};

// An `any`-typed option shows its value and expands to the type-aware editor.
export const CompactAnyType: Story = {
  parameters: { chromatic: { disable: true } },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      dynamic: { type: 'any', ui_type: 'any', display_name: 'Dynamic', preselected: true },
    } as IOptionsSchema,
    value: { dynamic: { type: 'string', value: 'flexible' } } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('flexible');
    await _testsClickText('flexible');
    await waitFor(() => expect(document.querySelector('.options-readfirst-card')).toBeTruthy(), {
      timeout: 10000,
    });
  },
};

// A schema-level `readonly` field whose value differs from its default is fixed
// back to the default (engine `fixOptions`); the read row shows the default.
export const CompactReadonlyDefaultFix: Story = {
  parameters: { chromatic: { disable: true } },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      fixed: {
        type: 'number',
        ui_type: 'number',
        display_name: 'Fixed',
        readonly: true,
        default_value: { type: 'number', value: 123 },
        preselected: true,
      },
    } as IOptionsSchema,
    value: { fixed: { type: 'number', value: 999 } } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('123');
    await _testsWaitForTextToNotExist('999');
  },
};

// Values for options that aren't in the schema are filtered out, not rendered.
export const CompactNonExistentFiltered: Story = {
  parameters: { chromatic: { disable: true } },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      real: { type: 'string', ui_type: 'string', display_name: 'Real', preselected: true },
    } as IOptionsSchema,
    value: {
      real: { type: 'string', value: 'shown' },
      ghost: { type: 'string', value: 'should-not-show' },
    } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('shown');
    await _testsWaitForTextToNotExist('should-not-show');
  },
};

// A field with a long `desc` shows a help affordance that opens the help dialog.
export const CompactHelpDialog: Story = {
  parameters: { chromatic: { disable: true } },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      helped: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Helped',
        short_desc: 'Short description',
        desc: 'A longer help description shown in the dialog.',
        preselected: true,
      },
    } as IOptionsSchema,
    value: { helped: { type: 'string', value: 'value' } } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('Helped');
    // Clicking the row's help affordance opens the help dialog with the long desc.
    await fireEvent.click(document.querySelector('.options-readfirst-help')!);
    await _testsWaitForText('A longer help description shown in the dialog.');
  },
};

// Read-first rendering is render-stable — it doesn't emit a storm of onChanges.
export const CompactDoesNotCauseInfiniteRerenders: Story = {
  parameters: { chromatic: { disable: true } },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue,
    groups: CompactGroups,
  },
  play: async ({ args }) => {
    await _testsWaitForText('order-fulfilment');
    await sleep(800); // settle — let any render loop manifest
    const calls = (args.onChange as ReturnType<typeof fn>).mock.calls.length;
    expect(calls).toBeLessThan(10);
  },
};

// ─── optionsLoader (async, transport-agnostic schema source) ────────────────────

// Resolve the schema after a short delay so the skeleton/loading state is
// genuinely exercised before the rows render.
const loadCompactSchemaAsync = (): Promise<IQorusFormSchema> =>
  new Promise((resolve) => setTimeout(() => resolve(CompactSchema as IQorusFormSchema), 60));

// Compact engine with NO `options` prop — the engine fetches the schema itself
// via `optionsLoader`, owning the loading lifecycle, then renders read-first.
export const CompactOptionsLoader: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    value: CompactValue,
    groups: CompactGroups,
    optionsLoader: loadCompactSchemaAsync,
  },
  play: async ({ args }) => {
    // Rows appear only after the async load resolves, and `onOptionsLoaded`
    // fires with the loaded schema.
    await _testsWaitForText('Name');
    await waitFor(() => expect(args.onOptionsLoaded).toHaveBeenCalled());
  },
};

// A rejected load surfaces the engine's error state instead of the form.
export const CompactOptionsLoaderError: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    value: CompactValue,
    groups: CompactGroups,
    optionsLoader: () =>
      new Promise<IQorusFormSchema>((_resolve, reject) =>
        setTimeout(() => reject(new Error('Could not load options from the server')), 60)
      ),
  },
  play: async () => {
    await _testsWaitForText('Could not load options from the server');
  },
};

// Classic (non-compact) parity: the same async source feeds the standard layout.
export const OptionsLoader: Story = {
  args: {
    minColumnWidth: '300px',
    value: CompactValue,
    optionsLoader: loadCompactSchemaAsync,
  },
  play: async ({ args }) => {
    await _testsWaitForText('Name');
    await waitFor(() => expect(args.onOptionsLoaded).toHaveBeenCalled());
  },
};
