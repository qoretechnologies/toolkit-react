import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, waitFor, within } from '@storybook/test';
import { useState } from 'react';
import { validateField } from '../../../helpers/validations';
import FileFieldArgSchema from '../../../stories/Data/fileFieldArgSchema.json';
import {
  _testsChangeRichText,
  _testsClickButton,
  _testsOpenTemplateMenu,
  _testsOpenTemplates,
  _testsWaitForInputValue,
  _testsWaitForText,
  _testsWaitForTextToNotExist,
  sleep,
} from '../../../stories/Tests/utils';
import { FormEngine, IFormEngineProps, IFormValidityData, IOptionsSchema } from './FormEngine';

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
    await expect(document.querySelectorAll('.options-item-remove').length).toBe(2);
    await _testsClickButton({ selector: '.options-item-remove', nth: 0 });
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

    // Type a value into the required field to make the form valid
    const requiredInput = document.querySelectorAll(
      '.system-option .reqore-textarea'
    )[0] as HTMLTextAreaElement;
    await fireEvent.change(requiredInput, { target: { value: 'hello' } });

    await sleep(300);

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
