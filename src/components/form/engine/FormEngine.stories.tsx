import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';
import { validateField } from '../../../helpers/validations';
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
import { basicFormValue, getBasicFormOptions as getOptions } from './__fixtures__/basicFormOptions';
import { chromeFieldBases, metaFieldBases } from './__fixtures__/fieldChromeOptions';
import { mockPopulatedDefinition } from '../fields/schema-definition/mockDefinition';
import { startDpqlMockLsp } from '../expressions/dpqlMockLsp';
import { mockExpressions } from '../expressions/mockExpressions';

// schema data

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

// meta

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

// stories

export const Basic: Story = {
  args: {
    minColumnWidth: '300px',
    options: getOptions(),
    value: basicFormValue,
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
    await waitFor(
      () => expect(document.querySelectorAll('.options-item-revert').length).toBe(1),
      { timeout: 10000 }
    );
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
  play: async () => {
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
  // chromatic off: async validity-callback timing.
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

// compact (read-first) mode

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
    { timeout: 10000 }
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
  play: async () => {
    // Groups render with their display metadata; rows show formatted values.
    await _testsWaitForText('Identity and core settings');
    await _testsWaitForText('order-fulfilment');
    await _testsWaitForText('orders, batch');
    await _testsWaitForText('Yes');
    await _testsWaitForText('Required — not set');
  },
};

export const CompactReadOnly: Story = {
  args: {
    ...Compact.args,
    readOnly: true,
  },
  play: async () => {
    await _testsWaitForText('order-fulfilment');
    // Read-only hides the Draft/Ready badge (the meter itself stays)…
    await _testsWaitForTextToNotExist('Draft');
    // …and rows open in view mode: Close instead of Done, then collapse back.
    await _testsClickText('order-fulfilment');
    await _testsWaitForText('Close');
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForTextToNotExist('Close');
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
  play: async () => {
    // Both required fields read as unset; the four optional ones as "Not set".
    await _testsWaitForTextsCount('Required — not set', undefined, 2);
    await _testsWaitForTextsCount('Not set', undefined, 4);
  },
};

// Compact mode on the EXACT shared fixture behind `Basic` — every option and
// state the classic layout exercises.
export const CompactBasic: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: getOptions(),
    value: basicFormValue,
  },
  play: async () => {
    // Unresolved required/invalid fields → the header shows the Draft badge
    // (the IDE restyled-hero convention).
    await _testsWaitForText('Draft');
    // Values resolve in read-first rows: templates raw, colour as hex, hash as
    // a field-count summary.
    await _testsWaitForText('$local:test');
    await _testsWaitForText('#0000FF');
    await _testsWaitForText('Selected option'); // multilevel hash option
    await _testsWaitForText('Schema Option'); // nested arg_schema hash option
    await _testsWaitForText('Read only option with default value');
    await _testsWaitForText('Disabled option');

    // A disabled field cannot be opened: clicking does nothing, a lock with
    // the reason replaces the edit affordance. (Same for unmet dependencies.)
    const disabledRow = document.querySelector(
      '.readfirst-row[data-field="disabledOption"]'
    ) as HTMLElement;
    await expect(disabledRow.className).toContain('readfirst-row-disabled');
    await expect(disabledRow.querySelector('.options-readfirst-locked')).toBeTruthy();
    await fireEvent.click(disabledRow);
    await sleep(400);
    await expect(
      document.querySelector(
        '[data-field="disabledOption"].options-readfirst-inline, .options-readfirst-card[data-field="disabledOption"]'
      )
    ).toBeFalsy();

    // Dependency locks are navigable: the lock's popover lists the blockers
    // with their state; clicking one scrolls to + flashes it.
    const depLock = document.querySelector(
      '.readfirst-row[data-field="optionWithShortDescription"] .options-readfirst-lock-deps'
    ) as HTMLElement;
    await expect(depLock).toBeTruthy();
    await fireEvent.click(depLock);
    await _testsWaitForText('Unlocked by:');
    const depEntry = Array.from(
      document.querySelectorAll('.options-readfirst-dep .reqore-tag-content')
    ).find((element) => element.textContent?.includes('basicOption')) as HTMLElement;
    await fireEvent.click(depEntry);
    await waitFor(
      () =>
        expect(
          document
            .querySelector('.readfirst-row[data-field="basicOption"]')
            ?.className.includes('readfirst-row-flash')
        ).toBe(true),
      { timeout: 10000 }
    );
    await fireEvent.click(depLock); // close the popover

    // Fulfilling the dependency UNLOCKS the dependent row and flashes it.
    await _testsClickText('basicOption');
    await waitFor(
      () =>
        expect(
          document.querySelector('.options-readfirst-card[data-field="basicOption"]')
        ).toBeTruthy(),
      { timeout: 10000 }
    );
    // _testsChangeRichText only targets the classic layout — type directly.
    // Double click + generous sleeps: a quick single click leaves Slate without
    // a selection in the headless runner and keystrokes drop silently.
    const richtextEditor = document.querySelector(
      '.options-readfirst-card[data-field="basicOption"] [contenteditable="true"]'
    ) as HTMLElement;
    await richtextEditor.scrollIntoView();
    await sleep(500);
    await userEvent.click(richtextEditor);
    await sleep(500);
    await userEvent.click(richtextEditor);
    await sleep(500);
    await userEvent.keyboard('unlock-me');
    await sleep(500);
    // The live (debounced) unlock's flash can expire mid-typing — assert the
    // durable outcome instead: the lock is gone before Done is pressed.
    await waitFor(
      () =>
        expect(
          document.querySelector(
            '.readfirst-row[data-field="optionWithShortDescription"] .options-readfirst-lock-deps'
          )
        ).toBeFalsy(),
      { timeout: 10000 }
    );
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await waitFor(
      () =>
        expect(
          document.querySelector(
            '.readfirst-row[data-field="optionWithShortDescription"] .options-readfirst-lock-deps'
          )
        ).toBeFalsy(),
      { timeout: 10000 }
    );

    // A scalar row (Number option = 42, ui_type number) edits inline. (The
    // '123' options are ui_type richtext — complex — and open the card.)
    await _testsClickText('42');
    await waitFor(() => expect(document.querySelector('.options-readfirst-inline')).toBeTruthy(), {
      timeout: 10000,
    });
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await waitFor(
      () => expect(document.querySelectorAll('.options-readfirst-inline')).toHaveLength(0),
      { timeout: 10000 }
    );

    // Revert the dependency edit so the visual snapshot is the deterministic
    // initial form — the compact-card richtext editor types char-by-char, which
    // the headless runner can render inconsistently.
    await fireEvent.click(
      document.querySelector(
        '.readfirst-row[data-field="basicOption"] .options-readfirst-revert'
      ) as HTMLElement
    );
    await waitFor(() =>
      expect(
        document.querySelector('.readfirst-row[data-field="basicOption"] .options-readfirst-revert')
      ).toBeFalsy()
    );
  },
};

// A raw (NON-envelope) order-style payload, contrasting the fixture's
// envelope-encoded hashes: no LIST chips, JS-type colouring, opaque YAML string.
const ORDER_STATE_SAMPLE = {
  stage: 'enriching',
  retries: 3,
  validated: false,
  progress: 0.6667,
  errors: [
    {
      code: 'ENRICH-TIMEOUT',
      severity: 'warning',
      at: '2026-06-10T12:55:00Z',
      context: { service: 'geo-lookup', ms: 5031 },
    },
  ],
  checkpoints: {
    ingest: '2026-06-10T12:50:00Z',
    normalize: '2026-06-10T12:52:30Z',
    enrich: null,
  },
  scalar_list: [10, 20, 30, 40],
  embedded_yaml: 'status: partial\nremaining:\n  - geo\n  - tax\nretryable: true\n',
};

// Hash rows render the IDE workflow-orders `StructuredDataView` under the
// fade/"Show more" wrapper; doubles as the raw-vs-envelope data contrast.
export const CompactHashStructuredView: Story = {
  args: {
    ...CompactBasic.args,
    options: {
      ...getOptions(),
      orderState: {
        type: 'hash',
        ui_type: 'hash',
        display_name: 'Order state',
        short_desc: 'Raw order-style payload (no typed envelopes)',
        preselected: true,
      },
    } as IOptionsSchema,
    value: {
      ...basicFormValue,
      orderState: { type: 'hash', value: ORDER_STATE_SAMPLE },
    } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('Selected option');
    // The structured tree (ReqoreDataView) renders type-aware value cells in
    // place of the flat sub-rows.
    await waitFor(
      () =>
        expect(
          document.querySelectorAll('.options-readfirst-structured .reqore-data-view-value').length
        ).toBeGreaterThan(0),
      { timeout: 10000 }
    );
    // The raw order-style payload renders too: scalars from the un-enveloped
    // hash appear as plain value cells.
    await _testsWaitForText('Order state');
    await _testsWaitForText('enriching');

    // "Show field types" (Fields menu) also drives the per-scalar type chips
    // inside the structured tree.
    await expect(document.querySelectorAll('.reqore-data-view-type')).toHaveLength(
      document.querySelectorAll('.options-readfirst-structured .reqore-data-view-type').length
    );
    await clickFieldsMenuItem('Show field types');
    await waitFor(
      () =>
        expect(
          document.querySelectorAll('.options-readfirst-structured .reqore-data-view-type').length
        ).toBeGreaterThan(1),
      { timeout: 10000 }
    );

    // Clicking a VALUE chip in the structured tree opens the hash's editor —
    // parity with the flat sub-rows' click-to-edit. (ReqoreTag attaches the
    // click handler to the inner .reqore-tag-content span, not the tag root.)
    const valueChip = document.querySelector(
      '[data-field="orderState"] .reqore-data-view-value .reqore-tag-content'
    ) as HTMLElement;
    await fireEvent.click(valueChip);
    await waitFor(
      () =>
        expect(document.querySelector('.options-readfirst-card[data-field="orderState"]')).toBeTruthy(),
      { timeout: 10000 }
    );
  },
};

// batched commit mode (Nick's save-model decision, 2026-06-10)
// Edits stage as a draft: changed rows get a Draft chip, the sticky header
// grows a Save/Discard bar, Save emits `onCommit` (gated on validity), and
// every staged edit still emits `onChange` flagged `meta.draft`.
export const CompactBatchedCommit: Story = {
  args: {
    compact: true,
    commitMode: 'batched',
    onCommit: fn(),
    minColumnWidth: '300px',
    options: CompactSchema,
    // `description` is filled so the whole form is VALID — Save is enabled.
    value: { ...CompactValue, description: { type: 'string', value: 'All set' } } as IOptions,
    groups: CompactGroups,
  },
  play: async ({ args }) => {
    await _testsWaitForText('order-fulfilment');

    // Stage an edit: the row becomes a draft, the bar appears, nothing commits.
    await _testsClickText('order-fulfilment');
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-inline .reqore-textarea');
    await _testsChangeStringField({
      selector: '.options-readfirst-inline .reqore-textarea',
      value: 'staged-name',
    });
    await sleep(300);
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('staged-name');
    await _testsWaitForText('1 unsaved change');
    await waitFor(() => expect(document.querySelector('.options-readfirst-draft')).toBeTruthy());

    // The staged edit was emitted via onChange, flagged as a draft…
    await waitFor(() => {
      const calls = (args.onChange as ReturnType<typeof fn>).mock.calls;
      const last = calls[calls.length - 1];
      expect((last[1] as IOptions)?.name?.value).toBe('staged-name');
      expect((last[2] as { draft?: boolean })?.draft).toBe(true);
    });
    // …but NOT committed.
    await expect((args.onCommit as ReturnType<typeof fn>).mock.calls).toHaveLength(0);

    // Save: onCommit fires with the staged form; chips + bar clear.
    await _testsClickButton({ selector: '.options-readfirst-save' });
    await waitFor(() => {
      const calls = (args.onCommit as ReturnType<typeof fn>).mock.calls;
      expect(calls).toHaveLength(1);
      expect((calls[0][1] as IOptions)?.name?.value).toBe('staged-name');
    });
    await _testsWaitForTextToNotExist('1 unsaved change');
    await waitFor(() => expect(document.querySelector('.options-readfirst-draft')).toBeFalsy());

    // Discard: stage another edit, discard it — value reverts, no new commit.
    await _testsClickText('staged-name');
    await _testsWaitForInputValue('staged-name', '.options-readfirst-inline .reqore-textarea');
    await _testsChangeStringField({
      selector: '.options-readfirst-inline .reqore-textarea',
      value: 'throwaway',
    });
    await sleep(300);
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('1 unsaved change');
    await _testsClickButton({ selector: '.options-readfirst-discard' });
    await _testsWaitForText('staged-name');
    await _testsWaitForTextToNotExist('throwaway');
    await expect((args.onCommit as ReturnType<typeof fn>).mock.calls).toHaveLength(1);
  },
};

// While any field is invalid, the bar shows but Save refuses to commit.
export const CompactBatchedCommitInvalid: Story = {
  args: {
    compact: true,
    commitMode: 'batched',
    onCommit: fn(),
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue, // `description` (required) is empty → form invalid
    groups: CompactGroups,
  },
  play: async ({ args }) => {
    await _testsWaitForText('order-fulfilment');
    await _testsClickText('order-fulfilment');
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-inline .reqore-textarea');
    await _testsChangeStringField({
      selector: '.options-readfirst-inline .reqore-textarea',
      value: 'blocked-name',
    });
    await sleep(300);
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('1 unsaved change');

    // Save is disabled — clicking it must NOT commit.
    const save = document.querySelector('.options-readfirst-save') as HTMLElement;
    await fireEvent.click(save);
    await sleep(400);
    await expect((args.onCommit as ReturnType<typeof fn>).mock.calls).toHaveLength(0);
    await _testsWaitForText('1 unsaved change'); // still staged
  },
};

// parity-gap coverage (design/COMPACT_PARITY.md)

// `sensitive`: the read row masks the value (and its hover title) — the secret
// never renders as page text, in read or edit state.
export const CompactSensitive: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      apiToken: {
        type: 'string',
        ui_type: 'string',
        display_name: 'API token',
        sensitive: true,
        preselected: true,
      },
    } as IOptionsSchema,
    value: { apiToken: { type: 'string', value: 'super-secret-token' } } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('API token');
    await _testsWaitForText('••••••');
    await _testsWaitForTextToNotExist('super-secret-token');
    // Editing must not leak the secret as page TEXT either. The editor's own
    // textarea is exempt: it reflects its VALUE as a text child, which is how
    // the user edits the secret — anything else holding the text is a leak.
    await _testsClickText('••••••');
    await waitFor(
      () => expect(document.querySelector('.options-readfirst-inline')).toBeTruthy(),
      { timeout: 10000 }
    );
    await _testsWaitForTextToNotExist('super-secret-token', ':not(textarea)');
  },
};

// `rules: ['valid_identifier']` flows from the schema into validation: a bad
// identifier marks the form invalid (banner + Draft badge).
export const CompactValidIdentifierRule: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      varName: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Variable name',
        rules: ['valid_identifier'],
        preselected: true,
      },
    } as unknown as IOptionsSchema,
    value: { varName: { type: 'string', value: '1-bad-identifier' } } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('Variable name');
    await _testsWaitForText('1-bad-identifier');
    // The rules-driven validation marks the form as needing attention.
    await _testsWaitForText('Draft');
    await _testsWaitForText(
      'A field is not valid and requires attention. Click here to only show invalid fields.'
    );
  },
};

// Operators (filter/mapper-style forms): the `operators` prop renders the
// operator selector + the WHERE/IS summary in the card editor.
export const CompactOperators: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    operators: {
      equals: { name: 'equals', display_name: 'Equals' },
      'not-equals': { name: 'not-equals', display_name: 'Not equals' },
    } as never,
    options: {
      status: { type: 'string', ui_type: 'string', display_name: 'Status', preselected: true },
    } as IOptionsSchema,
    value: { status: { type: 'string', value: 'COMPLETE', op: 'equals' } } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('Status');
    await _testsWaitForText('COMPLETE');
    // Operator-bearing forms always card-edit (never inline).
    await _testsClickText('COMPLETE');
    await waitFor(() => expect(document.querySelector('.options-readfirst-card')).toBeTruthy(), {
      timeout: 10000,
    });
    await expect(document.querySelectorAll('.options-readfirst-inline')).toHaveLength(0);
    // The operator row + the WHERE <field> IS <op> summary render.
    await _testsWaitForText('WHERE');
    await _testsWaitForText('equals');
  },
};

// focusedEditing in compact: the card's fullscreen affordance opens the same
// focused-editing modal the classic layout has, with the field's descriptions.
export const CompactFocusedEditing: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue,
    groups: CompactGroups,
  },
  play: async () => {
    await _testsWaitForText('Tags');
    // `tags` is a list → card editor with the fullscreen button.
    await _testsClickText('Tags');
    await waitFor(() => expect(document.querySelector('.options-readfirst-card')).toBeTruthy(), {
      timeout: 10000,
    });
    await _testsClickButton({ selector: '.options-readfirst-fullscreen' });
    await waitFor(() => expect(document.querySelector('.reqore-modal')).toBeTruthy(), {
      timeout: 10000,
    });
  },
};

// Multi-select editing: a list with element_allowed_values opens the real
// multi-select editor in the card.
export const CompactMultiSelectEditing: Story = {
  // chromatic off: ends with an open multi-select editor card (live editor state).
  parameters: { chromatic: { disable: true } },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      audiences: {
        type: 'list',
        ui_type: 'list',
        display_name: 'Audiences',
        preselected: true,
        element_allowed_values: [
          { display_name: 'Orders', value: { type: 'string', value: 'orders' } },
          { display_name: 'Batch', value: { type: 'string', value: 'batch' } },
          { display_name: 'Billing', value: { type: 'string', value: 'billing' } },
        ],
        element_allowed_values_creatable: false,
      },
    } as unknown as IOptionsSchema,
    value: { audiences: { type: 'list', value: ['orders'] } } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('Audiences');
    // Read row joins the selected items.
    await _testsWaitForText('orders');
    await _testsClickText('orders');
    await waitFor(() => expect(document.querySelector('.options-readfirst-card')).toBeTruthy(), {
      timeout: 10000,
    });
    // The real multi-select editor mounts with the selection.
    await _testsWaitForText('Orders');
  },
};

// Field-level `sort` orders compact rows (schema declared out of order).
export const CompactSortOrder: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      third: { type: 'string', ui_type: 'string', display_name: 'Third', sort: 3, preselected: true },
      first: { type: 'string', ui_type: 'string', display_name: 'First', sort: 1, preselected: true },
      second: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Second',
        sort: 2,
        preselected: true,
      },
    } as unknown as IOptionsSchema,
    value: {} as IOptions,
  },
  play: async () => {
    await _testsWaitForText('First');
    const order = Array.from(document.querySelectorAll('.readfirst-row[data-field]')).map(
      (element) => element.getAttribute('data-field')
    );
    await expect(order).toEqual(['first', 'second', 'third']);
  },
};

export const CompactReadFirstEditing: Story = {
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
    await expect(document.querySelectorAll('.reqore-textarea')).toHaveLength(0);

    // Group headers are rendered from each option's `group`.
    await _testsWaitForText('Info');
    await _testsWaitForText('Scaling');

    // Expanding the Name row reveals the real editor IN PLACE (scalar fields
    // edit inline in the row — no expanded card), pre-filled with the value.
    await _testsClickText('order-fulfilment');
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-inline .reqore-textarea');

    // Editing flows through the real onChange pipeline.
    await _testsChangeStringField({
      selector: '.options-readfirst-inline .reqore-textarea',
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

    // The per-row delete affordance: re-add Notes, then remove it via its row's
    // delete button → the confirm modal → Confirm.
    await clickFieldsMenuItem('Select all');
    await _testsWaitForText('Notes');
    await fireEvent.click(
      document.querySelector(
        '.readfirst-row[data-field="notes"] .readfirst-action'
      ) as HTMLElement
    );
    await _testsWaitForText('Remove field');
    await _testsClickButton({ label: 'Confirm' });
    await _testsWaitForTextToNotExist('Notes');
  },
};

export const CompactSearchHidden: Story = {
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
    // and pressing Enter adds the field and opens its inline editor.
    const row = document.querySelector('[data-field="notes"]') as HTMLElement;
    row.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(
      () =>
        expect(
          document.querySelectorAll('.options-readfirst-inline .reqore-textarea').length
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
  play: async () => {
    await _testsWaitForText('youtube');
    // The YAML-serialized list reads as a joined summary, never raw source.
    await _testsWaitForText(/youtube\.force-ssl/);
    await expect(document.body.textContent?.includes('%YAML')).toBe(false);
    // Opening the card must not crash on the serialized value (the regression).
    await fireEvent.click(
      document.querySelector('.readfirst-row[data-field="oauth2_scopes"]') as HTMLElement
    );
    await waitFor(
      () =>
        expect(
          document.querySelector('.options-readfirst-card[data-field="oauth2_scopes"]')
        ).toBeTruthy(),
      { timeout: 10000 }
    );
  },
};

// Regression guard: a long unbroken value forced a page h-scrollbar before the
// value column became `minmax(0, 1fr)` + `min-width: 0`; plus the sticky
// completion + search + Fields toolbar.
export const CompactOverflowAndStickyHeader: Story = {
  // A fixed-height scroll host so the sticky behaviour is observable (and
  // testable) regardless of viewport size.
  decorators: [
    (StoryComponent: React.ComponentType) => (
      <div style={{ height: 400, overflow: 'auto' }} data-testid='compact-scroll-host'>
        <StoryComponent />
      </div>
    ),
  ],
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
  play: async () => {
    await _testsWaitForText('order-fulfilment');
    // (a) The long unbroken value must not force horizontal overflow (the
    // regression was a page-wide h-scrollbar); whether it *visually* truncates
    // depends on the viewport, so assert the invariant parts: the full value is
    // preserved in the hover title and the page gains no horizontal scrollbar.
    const notesCell = document.querySelector(
      '.readfirst-row[data-field="notes"] > :nth-child(2)'
    ) as HTMLElement;
    await expect(notesCell.getAttribute('title')).toContain('tsrest-youtube://');
    await expect(document.body.scrollWidth).toBeLessThanOrEqual(document.body.clientWidth);
    // (b) The completion + search toolbar stays pinned while the form scrolls.
    const host = document.querySelector('[data-testid="compact-scroll-host"]') as HTMLElement;
    host.scrollTop = host.scrollHeight;
    await waitFor(() => {
      expect(host.scrollTop).toBeGreaterThan(0);
      const search = document.querySelector(
        'input[placeholder="Filter fields..."]'
      ) as HTMLElement;
      const hostTop = host.getBoundingClientRect().top;
      expect(search.getBoundingClientRect().top).toBeGreaterThanOrEqual(hostTop - 1);
      expect(search.getBoundingClientRect().top).toBeLessThan(hostTop + 150);
    });
  },
};

// on_change/refetch + has_dependents flow through the same handleValueChange
// as classic — the read-first editor must fire and reset the same way.
export const CompactOnChangeAndDependents: Story = {
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
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-inline .reqore-textarea');
    await _testsChangeStringField({
      selector: '.options-readfirst-inline .reqore-textarea',
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
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-inline .reqore-textarea');
    await _testsChangeStringField({
      selector: '.options-readfirst-inline .reqore-textarea',
      value: 'edited-again',
    });
    await sleep(300); // settle
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('edited-again'); // gate

    await clickFieldsMenuItem('Revert all changes');
    await _testsWaitForText('order-fulfilment');
  },
};

// compact parity with the classic story matrix

// The WHOLE `TQorusType` union as a literal catalog grouped by family —
// renderable types show real read-first values; reference/special types are
// documented rows. Keep in sync when a field type is added.
const FieldTypeCatalogGroups: Record<string, IFormEngineGroup> = {
  text: { label: 'Text & string', sort: 0 },
  number: { label: 'Numbers', sort: 1 },
  choice: { label: 'Choice & toggles', sort: 2 },
  structured: { label: 'Structured (list / hash)', sort: 3 },
  visual: { label: 'Colour & file', sort: 4 },
  special: { label: 'Any, null & special', sort: 5 },
  interface: { label: 'Interface references', sort: 6 },
  chrome: { label: 'Field chrome (icon / image / intent / badge / actions / tags)', sort: 7 },
  info: { label: 'Descriptions & messages', sort: 8 },
  meta: { label: 'Meta (sensitive / rules / defaults)', sort: 9 },
  fieldstack: { label: 'Field stack (merged: byte-size / url / schema-definition)', sort: 10 },
};

/**
 * Expression fields in compact. The read-first row renders the offline DPQL
 * summary of the `{exp,args}` AST (`renderExpressionToText`); drilling in opens
 * the full `ExpressionField` in the card — the Visual builder (catalogue offline
 * via `mockExpressions`) plus the Text/DPQL editor, whose seed + Explain are
 * served by the in-test `dpqlMockLsp`. No instance/LSP required.
 */
export const CompactExpressions: Story = {
  // chromatic off: ends with the live ExpressionField editor (Text mode) open.
  parameters: { chromatic: { disable: true } },
  args: {
    name: 'exprForm',
    compact: true,
    options: {
      condition: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Condition',
        supports_expressions: true,
        expressions: mockExpressions,
      },
    } as unknown as IOptionsSchema,
    value: {
      condition: {
        type: 'string',
        is_expression: true,
        value: {
          exp: '==',
          args: [
            { type: 'string', value: '$local:name' },
            { type: 'string', value: 'John' },
          ],
        },
      },
    } as unknown as IOptions,
  },
  play: async () => {
    const stop = startDpqlMockLsp();
    try {
      // Read-first: the offline DPQL summary of the AST.
      await _testsWaitForText('"$local:name" == "John"');

      // Drill in → the card hosts the ExpressionField (Visual builder).
      await fireEvent.click(
        document.querySelector('.readfirst-row[data-field="condition"]') as HTMLElement
      );
      await waitFor(
        () =>
          expect(
            document.querySelector('.options-readfirst-card[data-field="condition"] .expression')
          ).toBeInTheDocument(),
        { timeout: 10000 }
      );
      // The builder resolves the operator from the offline catalogue.
      await _testsWaitForText('Logical Equals');

      // Text/DPQL tab — seeded from the AST via the mock LSP (dpql/serialize).
      const textBtn = Array.from(
        document.querySelectorAll(
          '.options-readfirst-card[data-field="condition"] .expression-field button'
        )
      ).find((b) => b.textContent?.trim() === 'Text') as HTMLElement;
      await fireEvent.click(textBtn);
      await waitFor(
        () =>
          expect(
            document.querySelector(
              '.options-readfirst-card[data-field="condition"] [data-testid="expression-preview"]'
            )
          ).toBeInTheDocument(),
        { timeout: 10000 }
      );

      // Explain — the canonical rendering over the mock dpql/renderExpression.
      await fireEvent.click(
        document.querySelector(
          '.options-readfirst-card[data-field="condition"] .expression-explain'
        ) as HTMLElement
      );
      await waitFor(
        () =>
          expect(
            document.querySelector(
              '.options-readfirst-card[data-field="condition"] [data-testid="expression-explanation"]'
            )
          ).toBeInTheDocument(),
        { timeout: 10000 }
      );
    } finally {
      stop();
    }
  },
};

const langImg = (color: string, letter: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${color}"/><text x="16" y="23" font-size="20" fill="white" text-anchor="middle" font-family="sans-serif">${letter}</text></svg>`
  )}`;

/**
 * Enum field with per-value images (the IDE `language` field shape: `type:
 * 'enum'` + `items: [{ value, title, image }]`). Read-first shows the selected
 * value's label + logo on the VALUE side (not the field name); drilling in
 * lists every choice in the radio editor. Regression guard for both: the enum
 * editor previously read only `allowed_values` (empty for `items`), and the
 * value cell never rendered the option image.
 */
export const CompactEnumWithImages: Story = {
  // chromatic off: ends with the radio editor open in the card.
  parameters: { chromatic: { disable: true } },
  args: {
    name: 'langForm',
    compact: true,
    options: {
      lang: {
        type: 'enum',
        ui_type: 'enum',
        display_name: 'Language',
        items: [
          { value: 'qore', title: 'Qore', image: langImg('#c0007a', 'Q') },
          { value: 'python', title: 'Python', image: langImg('#3776ab', 'P') },
          { value: 'java', title: 'Java', image: langImg('#e76f00', 'J') },
        ],
      },
    } as unknown as IOptionsSchema,
    value: {
      lang: { type: 'enum', value: 'qore' },
    } as unknown as IOptions,
  },
  play: async () => {
    // Bug 1: read-first shows the selected option's label + its logo on the VALUE
    // side (collapsed — a choice with logos cards rather than splaying inline).
    await waitFor(
      () => {
        const row = document.querySelector('.readfirst-row[data-field="lang"]');
        expect(row?.textContent).toContain('Qore');
        expect(row?.querySelector('.reqore-icon img')).toBeTruthy();
      },
      { timeout: 10000 }
    );

    // Bug 2: drilling in lists every enum choice WITH its logo (the editor was
    // empty before — it only read `allowed_values`, never the IDE `items`).
    await fireEvent.click(document.querySelector('.readfirst-row[data-field="lang"]') as HTMLElement);
    await waitFor(
      () => {
        const card = document.querySelector('.options-readfirst-card[data-field="lang"]');
        // labels are title-case in the DOM; the uppercase look is CSS only.
        expect(card?.textContent).toContain('Python');
        expect(card?.textContent).toContain('Java');
        expect(card?.querySelectorAll('.reqore-checkbox img').length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );
  },
};

/**
 * The REAL IDE `lang` shape: `ui_type: 'enum'` whose values are richtext-wrapped
 * (`{ type: 'richtext', value: 'qore' }`) and `allowed_values` carry per-option
 * images. Regression guard: the editor must dispatch by the schema's `enum`,
 * not the value's `richtext` type — otherwise drilling in shows a rich-text box
 * instead of the language radio.
 */
export const CompactEnumRichtextValue: Story = {
  parameters: { chromatic: { disable: true } },
  args: {
    name: 'langForm',
    compact: true,
    options: {
      lang: {
        type: 'enum',
        ui_type: 'enum',
        display_name: 'Language',
        required: true,
        default_value: { type: 'richtext', value: 'qore' },
        allowed_values: [
          { display_name: 'Qore', value: { type: 'richtext', value: 'qore' }, image: langImg('#c0007a', 'Q') },
          { display_name: 'Python', value: { type: 'richtext', value: 'python' }, image: langImg('#3776ab', 'P') },
          { display_name: 'Java', value: { type: 'richtext', value: 'java' }, image: langImg('#e76f00', 'J') },
        ],
      },
    } as unknown as IOptionsSchema,
    value: {
      lang: { type: 'richtext', value: 'qore' },
    } as unknown as IOptions,
  },
  play: async () => {
    // Read-first resolves the richtext-wrapped value to its label + logo.
    await waitFor(
      () => {
        const row = document.querySelector('.readfirst-row[data-field="lang"]');
        expect(row?.textContent).toContain('Qore');
        expect(row?.querySelector('.reqore-icon img')).toBeTruthy();
      },
      { timeout: 10000 }
    );
    // Drill in → the RADIO renders (not a rich-text box) with every language.
    await fireEvent.click(document.querySelector('.readfirst-row[data-field="lang"]') as HTMLElement);
    await waitFor(
      () => {
        const card = document.querySelector('.options-readfirst-card[data-field="lang"]');
        expect(card?.textContent).toContain('Python');
        expect(card?.textContent).toContain('Java');
        expect(card?.querySelectorAll('.reqore-checkbox').length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );
  },
};

const expandModeFixture = {
  options: {
    alpha: { type: 'string', ui_type: 'string', display_name: 'Alpha' },
    beta: { type: 'string', ui_type: 'string', display_name: 'Beta' },
  } as unknown as IOptionsSchema,
  value: {
    alpha: { type: 'string', value: 'one' },
    beta: { type: 'string', value: 'two' },
  } as unknown as IOptions,
};
const _isRowOpen = (field: string): boolean =>
  !!document.querySelector(
    `.readfirst-row[data-field="${field}"].readfirst-row-editing, .options-readfirst-card[data-field="${field}"]`
  );

/**
 * `expandMode: 'single'` (the default): opening a second row collapses the
 * first — the accordion model that keeps the read-first list scannable.
 */
export const CompactSingleExpand: Story = {
  parameters: { chromatic: { disable: true } },
  args: { name: 'expandSingle', compact: true, ...expandModeFixture },
  play: async () => {
    await waitFor(
      () => expect(document.querySelector('.readfirst-row[data-field="beta"]')).toBeTruthy(),
      { timeout: 10000 }
    );
    await fireEvent.click(document.querySelector('.readfirst-row[data-field="alpha"]') as HTMLElement);
    await waitFor(() => expect(_isRowOpen('alpha')).toBe(true), { timeout: 10000 });
    await fireEvent.click(document.querySelector('.readfirst-row[data-field="beta"]') as HTMLElement);
    await waitFor(
      () => {
        expect(_isRowOpen('beta')).toBe(true);
        expect(_isRowOpen('alpha')).toBe(false); // collapsed by opening beta
      },
      { timeout: 10000 }
    );
  },
};

/** `expandMode: 'multi'`: several rows can stay open at once (form-fill flow). */
export const CompactMultiExpand: Story = {
  parameters: { chromatic: { disable: true } },
  args: { name: 'expandMulti', compact: true, expandMode: 'multi', ...expandModeFixture },
  play: async () => {
    await waitFor(
      () => expect(document.querySelector('.readfirst-row[data-field="beta"]')).toBeTruthy(),
      { timeout: 10000 }
    );
    await fireEvent.click(document.querySelector('.readfirst-row[data-field="alpha"]') as HTMLElement);
    await waitFor(() => expect(_isRowOpen('alpha')).toBe(true), { timeout: 10000 });
    await fireEvent.click(document.querySelector('.readfirst-row[data-field="beta"]') as HTMLElement);
    await waitFor(
      () => {
        expect(_isRowOpen('beta')).toBe(true);
        expect(_isRowOpen('alpha')).toBe(true); // stays open
      },
      { timeout: 10000 }
    );
  },
};

export const CompactFieldTypes: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    groups: FieldTypeCatalogGroups,
    options: {
      // Text & string
      text: { type: 'string', ui_type: 'string', display_name: 'String', group: 'text' },
      longText: { type: 'string', ui_type: 'long-string', display_name: 'Long string', group: 'text' },
      markdownText: { type: 'string', ui_type: 'markdown', display_name: 'Markdown', group: 'text' },
      richText: { type: 'richtext', ui_type: 'richtext', display_name: 'Rich text', group: 'text' },
      template: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Template (templated string)',
        supports_templates: true,
        group: 'text',
      },
      schedule: { type: 'string', ui_type: 'cron', display_name: 'Cron', group: 'text' },
      when: { type: 'date', ui_type: 'date', display_name: 'Date', group: 'text' },
      endpoint: { type: 'string', ui_type: 'url', display_name: 'URL', group: 'text' },
      contact: { type: 'string', ui_type: 'email', display_name: 'Email', group: 'text' },
      payload: { type: 'binary', ui_type: 'binary', display_name: 'Binary', group: 'text' },
      script: { type: 'string', ui_type: 'code-editor', display_name: 'Code editor', group: 'text' },
      raw: { type: 'data', ui_type: 'data', display_name: 'Data', group: 'text' },
      // Numbers
      count: { type: 'int', ui_type: 'number', display_name: 'Integer', group: 'number' },
      ratio: { type: 'float', ui_type: 'number', display_name: 'Float', group: 'number' },
      amount: { type: 'number', ui_type: 'number', display_name: 'Number', group: 'number' },
      // Choice & toggles
      enabled: { type: 'bool', ui_type: 'bool', display_name: 'Boolean', group: 'choice' },
      language: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Select (allowed_values)',
        group: 'choice',
        allowed_values: [
          { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
          { display_name: 'Python', value: { type: 'string', value: 'python' } },
        ],
      },
      severity: {
        type: 'string',
        ui_type: 'enum',
        display_name: 'Enum (select-string)',
        group: 'choice',
        allowed_values: [
          { display_name: 'Low', value: { type: 'string', value: 'low' } },
          { display_name: 'Medium', value: { type: 'string', value: 'medium' } },
          { display_name: 'High', value: { type: 'string', value: 'high' } },
        ],
      },
      tags: {
        type: 'list',
        ui_type: 'list',
        display_name: 'Multi-select (element_allowed_values)',
        group: 'choice',
        element_allowed_values: [
          { display_name: 'Orders', value: { type: 'string', value: 'orders' } },
          { display_name: 'Batch', value: { type: 'string', value: 'batch' } },
        ],
        element_allowed_values_creatable: false,
      },
      // Structured (list / hash)
      items: { type: 'list', ui_type: 'list', display_name: 'List', group: 'structured' },
      itemsYaml: {
        type: 'list',
        ui_type: 'list',
        display_name: 'List (YAML-serialized)',
        group: 'structured',
      },
      typedItems: {
        type: 'list',
        ui_type: 'list',
        ui_element_type: 'string',
        display_name: 'List (typed elements)',
        group: 'structured',
      },
      span: { type: 'range', ui_type: 'range', display_name: 'Range', group: 'structured' },
      config: { type: 'hash', ui_type: 'hash', display_name: 'Hash', group: 'structured' },
      connectionInfo: {
        type: 'hash',
        ui_type: 'hash',
        display_name: 'Hash (structured / arg_schema)',
        group: 'structured',
        arg_schema: {
          host: { type: 'string', display_name: 'Host' },
          port: { type: 'int', display_name: 'Port' },
          secure: { type: 'bool', display_name: 'Secure' },
        },
      },
      freeConfig: {
        type: 'free-hash',
        ui_type: 'free-hash',
        display_name: 'Free hash',
        group: 'structured',
      },
      bigConfig: {
        type: 'hash',
        ui_type: 'hash',
        display_name: 'Hash (many fields)',
        group: 'structured',
      },
      // Colour & file
      colour: { type: 'rgbcolor', ui_type: 'rgbcolor', display_name: 'Colour', group: 'visual' },
      tint: {
        type: 'rgbcolor',
        ui_type: 'rgbcolor',
        display_name: 'Colour (with alpha)',
        group: 'visual',
      },
      upload: { type: 'file', ui_type: 'file', display_name: 'File', group: 'visual' },
      // Any, null & special
      dynamic: { type: 'any', ui_type: 'any', display_name: 'Any', group: 'special' },
      detected: { type: 'auto', ui_type: 'auto', display_name: 'Auto', group: 'special' },
      maybe: { type: 'null', ui_type: 'null', display_name: 'Null', group: 'special' },
      provider: {
        type: 'data-provider',
        ui_type: 'data-provider',
        display_name: 'Data provider',
        group: 'special',
      },
      ctx: { type: 'context', ui_type: 'context', display_name: 'Context', group: 'special' },
      mappings: {
        type: 'processor-mappings',
        ui_type: 'processor-mappings',
        display_name: 'Processor mappings',
        group: 'special',
      },
      // Interface references (all share the string editor)
      mapperRef: { type: 'mapper', ui_type: 'mapper', display_name: 'Mapper', group: 'interface' },
      workflowRef: { type: 'workflow', ui_type: 'workflow', display_name: 'Workflow', group: 'interface' },
      serviceRef: { type: 'service', ui_type: 'service', display_name: 'Service', group: 'interface' },
      jobRef: { type: 'job', ui_type: 'job', display_name: 'Job', group: 'interface' },
      connectionRef: { type: 'connection', ui_type: 'connection', display_name: 'Connection', group: 'interface' },
      constantRef: { type: 'constant', ui_type: 'constant', display_name: 'Constant', group: 'interface' },
      classRef: { type: 'class', ui_type: 'class', display_name: 'Class', group: 'interface' },
      errorsRef: { type: 'errors', ui_type: 'errors', display_name: 'Errors', group: 'interface' },
      fsmRef: { type: 'fsm', ui_type: 'fsm', display_name: 'FSM', group: 'interface' },
      functionRef: { type: 'function', ui_type: 'function', display_name: 'Function', group: 'interface' },
      groupRef: { type: 'group', ui_type: 'group', display_name: 'Group', group: 'interface' },
      mapperCodeRef: { type: 'mapper-code', ui_type: 'mapper-code', display_name: 'Mapper code', group: 'interface' },
      queueRef: { type: 'queue', ui_type: 'queue', display_name: 'Queue', group: 'interface' },
      pipelineRef: { type: 'pipeline', ui_type: 'pipeline', display_name: 'Pipeline', group: 'interface' },
      slaRef: { type: 'sla', ui_type: 'sla', display_name: 'SLA', group: 'interface' },
      stepRef: { type: 'step', ui_type: 'step', display_name: 'Step', group: 'interface' },
      typeRef: { type: 'type', ui_type: 'type', display_name: 'Type', group: 'interface' },
      valueMapRef: { type: 'value-map', ui_type: 'value-map', display_name: 'Value map', group: 'interface' },
      // Field chrome
      // Rows show icon/image + the intent stripe; badge/actions/tags get
      // their room on the expanded edit card (list-typed here so the card
      // opens and shows them).
      chromeIcon: { ...chromeFieldBases.chromeIcon, group: 'chrome' },
      chromeImage: { ...chromeFieldBases.chromeImage, group: 'chrome' },
      chromeIntent: { ...chromeFieldBases.chromeIntent, group: 'chrome' },
      chromeBadge: {
        type: 'list',
        ui_type: 'list',
        display_name: 'With badges (on the card)',
        badge: ['beta', 2],
        group: 'chrome',
      },
      chromeActions: {
        type: 'list',
        ui_type: 'list',
        display_name: 'With actions (on the card)',
        actions: [{ label: 'Test connection', icon: 'PlayLine' }],
        group: 'chrome',
      },
      chromeTags: {
        type: 'list',
        ui_type: 'list',
        display_name: 'With tags (on the card)',
        tags: [{ label: 'advanced' }, { label: 'networking' }],
        group: 'chrome',
      },
      chromeEverything: {
        type: 'list',
        ui_type: 'list',
        display_name: 'Full chrome',
        icon: 'Settings3Line',
        intent: 'info',
        badge: 'beta',
        actions: [{ label: 'Inspect', icon: 'SearchLine' }],
        tags: [{ label: 'demo' }],
        group: 'chrome',
      },
      // Descriptions & messages
      // One capability per row (the catalog idiom); the combined stress story
      // is CompactShowcase. Tier 1 (danger/warning) auto-opens the row's
      // info panel + stripes the edge; Tier 2 (info/success) waits behind ⓘ.
      infoShortDesc: {
        type: 'string',
        ui_type: 'string',
        display_name: 'short_desc (ⓘ panel + hover title)',
        short_desc: 'A one-line summary shown in the info panel and the hover title.',
        group: 'info',
      },
      infoLongDesc: {
        type: 'string',
        ui_type: 'string',
        display_name: 'desc (? help dialog)',
        desc: 'Full **markdown** documentation, opened via the `?` icon.',
        group: 'info',
      },
      infoBothDescs: {
        type: 'string',
        ui_type: 'string',
        display_name: 'short_desc + desc',
        short_desc: 'Summary line for the panel.',
        desc: 'And the long-form markdown behind the `?`.',
        group: 'info',
      },
      infoMsgCritical: {
        type: 'string',
        ui_type: 'string',
        display_name: 'messages: danger + warning (auto-open)',
        messages: [
          { intent: 'danger', title: 'Broken', content: 'This value fails validation upstream.' },
          { intent: 'warning', content: 'Deprecated — migrate before 2026-09.' },
        ],
        group: 'info',
      },
      infoMsgQuiet: {
        type: 'string',
        ui_type: 'string',
        display_name: 'messages: info + success (behind ⓘ)',
        messages: [
          { intent: 'info', content: 'Requests are signed automatically.' },
          { intent: 'success', content: 'Connection verified.' },
        ],
        group: 'info',
      },
      // Meta
      metaSensitive: { ...metaFieldBases.metaSensitive, group: 'meta' },
      metaRule: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Rule: valid_identifier',
        rules: ['valid_identifier'],
        group: 'meta',
      },
      metaDefault: { ...metaFieldBases.metaDefault, group: 'meta' },
      // Field stack (merged from dpql): the upgraded field types compact now
      // wraps. `url` is already covered above (the `endpoint` row).
      byteSize: {
        type: 'byte-size',
        ui_type: 'byte-size',
        display_name: 'Byte size',
        group: 'fieldstack',
      },
      schemaDef: {
        type: 'hash',
        ui_type: 'schema-definition',
        display_name: 'Schema definition',
        group: 'fieldstack',
      },
      expr: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Expression',
        supports_expressions: true,
        group: 'fieldstack',
      },
      // cast through `unknown`: this set spans the whole TQorusType union, far
      // more ui_types than the IOptionsSchema literal union models, though the
      // engine renders them all at runtime.
    } as unknown as IOptionsSchema,
    value: {
      // Text & string
      text: { type: 'string', value: 'hello' },
      longText: {
        type: 'string',
        value: 'A longer paragraph of text that wraps across more than one line in the editor.',
      },
      markdownText: { type: 'string', value: '# Heading\nSome **bold** text' },
      richText: { type: 'richtext', value: [{ type: 'paragraph', children: [{ text: 'rich note' }] }] },
      template: { type: 'string', value: '$config:billing_url' },
      schedule: { type: 'string', value: '0 0 * * *' },
      when: { type: 'date', value: '2026-06-09' },
      endpoint: { type: 'string', value: 'https://example.com/webhook' },
      contact: { type: 'string', value: 'ops@example.com' },
      payload: { type: 'binary', value: 'DEADBEEF' },
      script: { type: 'string', value: 'sub main() { return 1; }' },
      raw: { type: 'data', value: 'raw-bytes' },
      // Numbers
      count: { type: 'int', value: 42 },
      ratio: { type: 'float', value: 0.75 },
      amount: { type: 'number', value: 7 },
      // Choice & toggles
      enabled: { type: 'bool', value: true },
      language: { type: 'string', value: 'python' },
      severity: { type: 'string', value: 'medium' },
      tags: {
        type: 'list',
        value: [
          { type: 'string', value: 'orders' },
          { type: 'string', value: 'batch' },
        ],
      },
      // Structured
      items: { type: 'list', value: ['a', 'b'] },
      itemsYaml: { type: 'list', value: '%YAML 1.2\n---\n["x", "y", "z"]\n' },
      typedItems: {
        type: 'list',
        value: [
          { type: 'string', value: 'one' },
          { type: 'string', value: 'two' },
        ],
      },
      span: { type: 'range', value: [1, 5] },
      config: { type: 'hash', value: { region: 'eu', tier: 'gold' } },
      connectionInfo: {
        type: 'hash',
        value: {
          host: { type: 'string', value: 'db.local' },
          port: { type: 'int', value: 5432 },
          secure: { type: 'bool', value: true },
        },
      },
      freeConfig: { type: 'free-hash', value: '%YAML 1.2\n---\nretries: 3\ntimeout: 30\n' },
      bigConfig: {
        type: 'hash',
        value: {
          region: 'eu-west',
          tier: 'gold',
          retries: 3,
          timeout: 30,
          ssl: true,
          pool_size: 10,
          namespace: 'orders',
          shard: 'a',
          replica: 'r2',
          backoff: 'expo',
        },
      },
      // Colour & file
      colour: { type: 'rgbcolor', value: { r: 0, g: 0, b: 255, a: 1 } },
      tint: { type: 'rgbcolor', value: { r: 255, g: 0, b: 0, a: 0.5 } },
      upload: { type: 'file', value: { name: 'config.txt', size: 1234, content: 'data' } },
      // Any, null & special
      dynamic: { type: 'any', value: 'auto-detected' },
      detected: { type: 'auto', value: 7 },
      maybe: { type: 'null', value: null },
      provider: { type: 'data-provider', value: 'factory/db-connection' },
      ctx: { type: 'context', value: '$local:flow-context' },
      mappings: { type: 'processor-mappings', value: 'orders → invoices' },
      // Interface references
      mapperRef: { type: 'mapper', value: 'order-to-invoice' },
      workflowRef: { type: 'workflow', value: 'order-process' },
      serviceRef: { type: 'service', value: 'billing-service' },
      jobRef: { type: 'job', value: 'nightly-reconcile' },
      connectionRef: { type: 'connection', value: 'pgsql-main' },
      constantRef: { type: 'constant', value: 'MAX_RETRIES' },
      classRef: { type: 'class', value: 'OrderValidator' },
      errorsRef: { type: 'errors', value: 'order-errors' },
      fsmRef: { type: 'fsm', value: 'payment-fsm' },
      functionRef: { type: 'function', value: 'normalize_amount' },
      groupRef: { type: 'group', value: 'finance' },
      mapperCodeRef: { type: 'mapper-code', value: 'amount-helpers' },
      queueRef: { type: 'queue', value: 'inbound-orders' },
      pipelineRef: { type: 'pipeline', value: 'ingest-pipeline' },
      slaRef: { type: 'sla', value: 'gold-sla' },
      stepRef: { type: 'step', value: 'validate-step' },
      typeRef: { type: 'type', value: 'qore/order' },
      valueMapRef: { type: 'value-map', value: 'country-codes' },
      // Field chrome
      chromeIcon: { type: 'string', value: 'db.local' },
      chromeImage: { type: 'string', value: 'qorus-app' },
      chromeIntent: { type: 'string', value: 'needs attention' },
      chromeBadge: { type: 'list', value: ['one', 'two'] },
      chromeActions: { type: 'list', value: ['ping'] },
      chromeTags: { type: 'list', value: ['a'] },
      chromeEverything: { type: 'list', value: ['x', 'y'] },
      // Descriptions & messages
      infoShortDesc: { type: 'string', value: 'plain value' },
      infoLongDesc: { type: 'string', value: 'documented value' },
      infoBothDescs: { type: 'string', value: 'fully described value' },
      infoMsgCritical: { type: 'string', value: 'failing value' },
      infoMsgQuiet: { type: 'string', value: 'quiet value' },
      // Meta
      metaSensitive: { type: 'string', value: 'hunter2-token' },
      metaRule: { type: 'string', value: 'valid_name' },
      metaDefault: { type: 'number', value: 30 },
      // Field stack (merged)
      byteSize: { type: 'byte-size', value: '512MiB' },
      schemaDef: { type: 'hash', value: mockPopulatedDefinition as never },
      expr: {
        type: 'string',
        is_expression: true,
        value: {
          exp: '==',
          args: [
            { type: 'string', value: '$local:name' },
            { type: 'string', value: 'John' },
          ],
        },
      } as never,
    } as IOptions,
  },
  play: async () => {
    // Each type renders a read-first value (no editor mounted yet). Representative
    // assertions across the display behaviours: scalars, Yes/No, allowed-value
    // labels, list joins, richtext flattening, colour hex/rgba, filename, and
    // the hash "N fields" summary.
    await _testsWaitForText('hello'); // string
    await _testsWaitForText('$config:billing_url'); // templated string
    await _testsWaitForText('rich note'); // richtext flattened to plain text
    await _testsWaitForText('https://example.com/webhook'); // url
    await _testsWaitForText('42'); // integer
    await _testsWaitForText('0.75'); // float
    await _testsWaitForText('Yes'); // bool → Yes/No
    await _testsWaitForText('2026-06-09'); // date
    await _testsWaitForText('0 0 * * *'); // cron
    await _testsWaitForText('Python'); // select → allowed_value display label
    await _testsWaitForText('Medium'); // enum → allowed_value display label
    await _testsWaitForText('orders, batch'); // multi-select joined
    await _testsWaitForText('a, b'); // list joined
    await _testsWaitForText('x, y, z'); // YAML-serialized list summarised
    await _testsWaitForText('#0000FF'); // colour → uppercase hex
    await _testsWaitForText('rgba(255, 0, 0, 0.5)'); // colour with alpha → rgba()
    await _testsWaitForText('config.txt'); // file → filename
    await _testsWaitForText('3 fields'); // structured hash → field count summary
    await _testsWaitForText('order-to-invoice'); // interface reference → raw value

    // Field stack (merged from dpql): byte-size shows its value string; the
    // schema-definition summarises as the schema name (+ table count) rather
    // than a raw hash key-count.
    await _testsWaitForText('512MiB');
    await _testsWaitForText(/example_customer_addresses/);
    // Expression field → read-first shows the offline DPQL summary of the AST.
    await _testsWaitForText('"$local:name" == "John"');
    await expect(document.querySelectorAll('.options-readfirst-card')).toHaveLength(0);

    // A hash renders its read-first preview (the structured tree by default)
    // beneath the row. A short hash shows in full; a tall one clips behind the
    // "Show more" gradient fade (the clipped content stays in the DOM).
    await _testsWaitForText('db.local'); // hash sub-value rendered in the tree
    await _testsWaitForText('Show more'); // the many-field hash clips + fades

    // Field chrome: icon/image render before the label, intent stripes the row,
    // sensitive masks, the default-value note number shows.
    await waitFor(() =>
      expect(
        document.querySelectorAll('[data-field="chromeIcon"] .options-readfirst-row-icon').length +
          document.querySelectorAll('[data-field="chromeImage"] .reqore-icon img').length
      ).toBeGreaterThan(1)
    );
    await waitFor(() => {
      const intentRow = document.querySelector('[data-field="chromeIntent"]') as HTMLElement;
      expect(intentRow?.style?.boxShadow).toBeTruthy();
    });
    await _testsWaitForText('••••••');
    await _testsWaitForTextToNotExist('hunter2-token');

    // Descriptions & messages: Tier-1 messages auto-open the row's info panel
    // (visible without interaction); Tier-2 messages and short_desc wait
    // behind the ⓘ toggle. NB: toggling rebuilds the row's DOM (the info-row
    // wrapper appears/disappears) — query fresh nodes per click.
    await _testsWaitForText('This value fails validation upstream.');
    await _testsWaitForText('Deprecated — migrate before 2026-09.');
    const catalogPanel = (field: string) =>
      document.querySelector(
        `.options-readfirst-info-row[data-field="${field}"] .options-readfirst-info-panel`
      );
    await expect(catalogPanel('infoMsgQuiet')).toBeNull();
    await fireEvent.click(
      document.querySelector(
        '.readfirst-row[data-field="infoMsgQuiet"] .options-readfirst-info-slot [role="button"]'
      ) as HTMLElement
    );
    await _testsWaitForText('Requests are signed automatically.');
    await _testsWaitForText('Connection verified.');
    // short_desc sits behind ⓘ too; desc renders the ? help affordance.
    await expect(catalogPanel('infoShortDesc')).toBeNull();
    await fireEvent.click(
      document.querySelector(
        '.readfirst-row[data-field="infoShortDesc"] .options-readfirst-info-slot [role="button"]'
      ) as HTMLElement
    );
    await _testsWaitForText('A one-line summary shown in the info panel and the hover title.');
    await expect(
      document.querySelector('.readfirst-row[data-field="infoLongDesc"] .options-readfirst-help')
    ).toBeTruthy();

    // badge / actions / tags surface on the expanded edit card.
    await _testsClickText('Full chrome');
    await waitFor(
      () =>
        expect(
          document.querySelector('.options-readfirst-card[data-field="chromeEverything"]')
        ).toBeTruthy(),
      { timeout: 10000 }
    );
    await _testsWaitForText('beta'); // badge
    await _testsWaitForText('Inspect'); // action button
    await _testsWaitForText('demo'); // tag
    await _testsClickButton({ selector: '.options-readfirst-done' });

    // Expanding a scalar row mounts the real editor in place (inline row).
    await _testsClickText('hello');
    await waitFor(() => expect(document.querySelector('.options-readfirst-inline')).toBeTruthy(), {
      timeout: 10000,
    });
  },
};

// The catalog with EVERY field open for edit at once (scalars inline, complex
// as cards) — one screen for editor chrome/alignment, and a canary for editors
// that break when mounted together.
// Activate one row per pass, re-querying each time: expanding REBUILDS the
// row's DOM, so captured nodes go stale. Shared by both everything-open stories.
const _compactExpandAllRows = async () => {
  const readRows = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '.readfirst-row:not(.readfirst-row-editing):not(.readfirst-row-disabled):not(.readfirst-row-hidden)'
      )
    );
  // Generous guard: the catalog has ~70 fields.
  for (let guard = 0; guard < 120; guard++) {
    const remaining = readRows();
    if (!remaining.length) break;
    await fireEvent.click(remaining[0]);
    await waitFor(() => expect(readRows().length).toBeLessThan(remaining.length), {
      timeout: 10000,
    });
  }
  // Everything is open: no read rows remain, and the editor count (inline
  // rows + cards) matches the catalog's size.
  await expect(readRows()).toHaveLength(0);
  const editors =
    document.querySelectorAll('.options-readfirst-inline').length +
    document.querySelectorAll('.options-readfirst-card').length;
  await expect(editors).toBeGreaterThan(60);
};

export const CompactFieldTypesEditing: Story = {
  // chromatic off: 69 live editors (async mounts) — flaky and snapshot-heavy.
  parameters: { chromatic: { disable: true } },
  // multi: this story expands every row at once (single-open would collapse them).
  args: { ...CompactFieldTypes.args, expandMode: 'multi' as const },
  play: async () => {
    await _testsWaitForText('hello');
    await _compactExpandAllRows();
  },
};

// Same catalog, EVERY field required and NOTHING set, all open: each editor in
// its required/invalid state — the canary for editors that misbehave on an
// empty required value.
export const CompactFieldTypesEditingAllRequired: Story = {
  // chromatic off: 69 live editors (async mounts) — flaky and snapshot-heavy.
  parameters: { chromatic: { disable: true } },
  args: {
    ...CompactFieldTypes.args,
    expandMode: 'multi' as const,
    options: Object.fromEntries(
      Object.entries(CompactFieldTypes.args!.options as IOptionsSchema).map(([name, option]) => [
        name,
        { ...(option as object), required: true },
      ])
    ) as IOptionsSchema,
    value: {} as IOptions,
  },
  play: async () => {
    await _testsWaitForText('String');
    // Everything is required and unset: the invalid-fields banner shows.
    await _testsWaitForText(/fields are not valid and require attention/);
    await _compactExpandAllRows();
    // The editors render their own required messages (the read-row Required
    // tags are replaced by the editor strip while editing).
    await waitFor(() =>
      expect(
        within(document.body).queryAllByText('This field is required').length
      ).toBeGreaterThan(20)
    );

    // The empty `any` card: custom values are disallowed for `any` (the
    // value's TYPE is picked first), so its only control is the template menu
    // — which therefore renders as a labelled "Set value" trigger instead of
    // the bare ⋮. Picking a type from the menu mounts that type's editor.
    await _testsClickText('Set value');
    await _testsClickText('Set Custom Value');
    // Scope the type pick to the open menu — with every editor expanded, an
    // editor toolbar can carry its own "Text" label.
    await waitFor(() =>
      expect(
        within(document.querySelector('.reqore-menu') as HTMLElement).getByText('Text')
      ).toBeInTheDocument()
    );
    await fireEvent.click(
      within(document.querySelector('.reqore-menu') as HTMLElement).getByText('Text')
    );
    await waitFor(
      () =>
        expect(
          document.querySelector(
            '.options-readfirst-card[data-field="dynamic"] [contenteditable="true"]'
          )
        ).toBeTruthy(),
      { timeout: 10000 }
    );
  },
};

// required_groups linkage: unmet members show a "One of" chip (tap-popover →
// scroll + flash siblings, hover highlights); satisfied groups show "covered
// by". Members live in DIFFERENT panels to prove cross-panel linkage.
export const CompactRequiredGroups: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    groups: {
      general: { label: 'General', sort: 0 },
      connection: { label: 'Connection', sort: 1 },
    },
    options: {
      byUrl: {
        type: 'string',
        ui_type: 'string',
        display_name: 'By URL',
        required_groups: ['target'],
        preselected: true,
        group: 'general',
      },
      byHost: {
        type: 'string',
        ui_type: 'string',
        display_name: 'By host',
        required_groups: ['target'],
        preselected: true,
        group: 'connection',
      },
      byFile: {
        type: 'string',
        ui_type: 'string',
        display_name: 'By file',
        required_groups: ['target'],
        preselected: true,
        group: 'connection',
      },
    } as IOptionsSchema,
    value: {} as IOptions,
  },
  play: async () => {
    // All members show the required placeholder, the Draft badge, and the
    // linking chip.
    await _testsWaitForTextsCount('Required — not set', undefined, 3);
    await _testsWaitForText('Draft');
    await _testsWaitForTextsCount('One of: target', undefined, 3);

    // The chip's popover lists the siblings; locating one flashes its row
    // (cross-panel: byUrl sits in General, byHost in Connection).
    const chip = document.querySelector(
      '.readfirst-row[data-field="byUrl"] .options-readfirst-required-group .reqore-tag-content'
    ) as HTMLElement;
    await fireEvent.click(chip);
    await _testsWaitForText('Set one of these fields (target):');
    const memberEntry = Array.from(
      document.querySelectorAll('.options-readfirst-group-member .reqore-tag-content')
    ).find((element) => element.textContent?.includes('By host')) as HTMLElement;
    await fireEvent.click(memberEntry);
    await waitFor(
      () =>
        expect(
          document
            .querySelector('.readfirst-row[data-field="byHost"]')
            ?.className.includes('readfirst-row-flash')
        ).toBe(true),
      { timeout: 10000 }
    );
    await fireEvent.click(chip); // close the popover

    // Setting one member: expand it, type a value, collapse — its value shows.
    await _testsClickText('By URL');
    await waitFor(
      () =>
        expect(document.querySelector('.options-readfirst-inline .reqore-textarea')).toBeTruthy(),
      { timeout: 10000 }
    );
    await _testsChangeStringField({
      selector: '.options-readfirst-inline .reqore-textarea',
      value: 'https://example.com',
    });
    await sleep(300);
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('https://example.com');

    // One fulfilled member satisfies the group → the badge flips to Ready, the
    // chips disappear, and the empty siblings explain WHY they stopped being
    // required.
    await _testsWaitForText('Ready');
    await _testsWaitForTextsCount('Not set — covered by “By URL”', undefined, 2);
    await expect(document.querySelectorAll('.options-readfirst-required-group')).toHaveLength(0);
  },
};

// compact mirrors of the classic dependency × required-group stories

// Compact members must be listed to be visible (classic shows every option).
const CompactRequiredGroupMembers = Object.fromEntries(
  Object.entries(TestOptionsWithRequiredGroups).map(([name, schema]) => [
    name,
    { ...schema, preselected: true },
  ])
) as IOptionsSchema;

// Helper: type into an open compact card's richtext editor (the classic
// _testsChangeRichText helper targets div.system-option, which compact cards
// don't have). Mirrors that helper's double click + generous sleeps: a single
// quick click leaves the Slate editor without an internal selection in the
// headless test-runner and every keystroke is silently dropped.
const _compactTypeIntoCardRichText = async (field: string, value: string) => {
  const editor = document.querySelector(
    `.options-readfirst-card[data-field="${field}"] [contenteditable="true"]`
  ) as HTMLElement;
  await editor.scrollIntoView();
  await sleep(500);
  await userEvent.click(editor);
  await sleep(500);
  await userEvent.click(editor);
  await sleep(500);
  await userEvent.keyboard(value);
  await sleep(500);
};

// Mirror of `OptionDependsOnOptionOrAnotherOption`: an ANY-OF dependency
// (`[[a, b]]`) locks the row; the lock popover renders the "any of:" group;
// fulfilling EITHER blocker unlocks (and flashes) the dependent row.
export const CompactOptionDependsOnOptionOrAnotherOption: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      ...CompactRequiredGroupMembers,
      RequiredOption6: {
        type: 'richtext',
        ui_type: 'richtext',
        display_name: 'Required Option 6',
        desc: 'I depend on RequiredOption2 OR RequiredOption5',
        depends_on: [['RequiredOption2', 'RequiredOption5']],
        required: true,
        preselected: true,
      },
    } as IOptionsSchema,
    value: {} as IOptions,
  },
  play: async () => {
    await _testsWaitForText('Required Option 6');

    // Locked, with the navigable popover showing the ANY-OF group.
    const depLock = document.querySelector(
      '.readfirst-row[data-field="RequiredOption6"] .options-readfirst-lock-deps'
    ) as HTMLElement;
    await expect(depLock).toBeTruthy();
    await fireEvent.click(depLock);
    await _testsWaitForText('Unlocked by:');
    await _testsWaitForText('any of:');

    // Locate the second blocker from the popover (scroll + flash).
    const depEntry = Array.from(
      document.querySelectorAll('.options-readfirst-dep .reqore-tag-content')
    ).find((element) => element.textContent?.includes('Required Option 5')) as HTMLElement;
    await fireEvent.click(depEntry);
    await waitFor(
      () =>
        expect(
          document
            .querySelector('.readfirst-row[data-field="RequiredOption5"]')
            ?.className.includes('readfirst-row-flash')
        ).toBe(true),
      { timeout: 10000 }
    );
    await fireEvent.click(depLock); // close the popover

    // Fulfilling EITHER side of the any-of unlocks the dependent row.
    await _testsClickText('Required Option 5');
    await waitFor(
      () =>
        expect(
          document.querySelector('.options-readfirst-card[data-field="RequiredOption5"]')
        ).toBeTruthy(),
      { timeout: 10000 }
    );
    // Short value on purpose: the unlock-flash fires on the FIRST keystroke
    // that makes the dependency truthy and only lasts ~1.6s — typing a long
    // string into the richtext card can outlive the flash window before the
    // assertion below starts polling.
    await _compactTypeIntoCardRichText('RequiredOption5', 'ok');
    // The unlock is LIVE (debounced) — the dependent row's lock drops while
    // the card is still open. Don't race the 1.4s unlock flash here (the
    // popover-click flash above covers the animation); assert the lock state.
    await waitFor(
      () =>
        expect(
          document.querySelector(
            '.readfirst-row[data-field="RequiredOption6"] .options-readfirst-lock-deps'
          )
        ).toBeFalsy(),
      { timeout: 10000 }
    );
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await waitFor(
      () =>
        expect(
          document.querySelector(
            '.readfirst-row[data-field="RequiredOption6"] .options-readfirst-lock-deps'
          )
        ).toBeFalsy(),
      { timeout: 10000 }
    );

    // Settle to a deterministic snapshot: revert the fulfilling edit (the card
    // is already closed above; the compact-card richtext editor types
    // char-by-char), re-locking the dependent back to the initial state.
    await fireEvent.click(
      document.querySelector(
        '.readfirst-row[data-field="RequiredOption5"] .options-readfirst-revert'
      ) as HTMLElement
    );
    await waitFor(() =>
      expect(
        document.querySelector(
          '.readfirst-row[data-field="RequiredOption6"] .options-readfirst-lock-deps'
        )
      ).toBeTruthy()
    );
  },
};

// The dependency targets a required-group MEMBER: fulfilling it unlocks the
// dependent row AND satisfies the group — both linkage systems on one form.
export const CompactOptionDependsOnOptionInRequiredGroup: Story = {
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      ...CompactRequiredGroupMembers,
      RequiredOption6: {
        type: 'string',
        ui_type: 'richtext',
        display_name: 'Required Option 6',
        desc: 'I depend on RequiredOption2',
        depends_on: ['RequiredOption2'],
        required: true,
        preselected: true,
      },
    } as IOptionsSchema,
    value: {} as IOptions,
  },
  play: async () => {
    await _testsWaitForText('Required Option 6');

    // Both linkage systems are visible at once: group chips on the members,
    // the dependency lock on the dependent row.
    await _testsWaitForText('One of: RequiredGroup');
    const depLock = document.querySelector(
      '.readfirst-row[data-field="RequiredOption6"] .options-readfirst-lock-deps'
    ) as HTMLElement;
    await expect(depLock).toBeTruthy();
    await fireEvent.click(depLock);
    await _testsWaitForText('Unlocked by:');
    // A single flat dependency — no "any of:" grouping.
    await _testsWaitForTextToNotExist('any of:');
    await fireEvent.click(depLock); // close the popover

    // Fulfil the group member: the dependent row unlocks…
    await _testsClickText('Required Option 2');
    await waitFor(
      () =>
        expect(
          document.querySelector('.options-readfirst-card[data-field="RequiredOption2"]')
        ).toBeTruthy(),
      { timeout: 10000 }
    );
    await _compactTypeIntoCardRichText('RequiredOption2', 'I have value');
    // The live (debounced) unlock can land seconds after the last keystroke
    // under test-runner load — give it the suite-standard 10s.
    await waitFor(
      () =>
        expect(
          document.querySelector(
            '.readfirst-row[data-field="RequiredOption6"] .options-readfirst-lock-deps'
          )
        ).toBeFalsy(),
      { timeout: 10000 }
    );
    await _testsClickButton({ selector: '.options-readfirst-done' });

    // …and the required group is satisfied: empty siblings explain why.
    await _testsWaitForText('Not set — covered by “Required Option 2”');

    // Settle to a deterministic snapshot: revert the fulfilling edit (the
    // compact-card richtext editor types char-by-char), re-locking the
    // dependent back to the initial state.
    await fireEvent.click(
      document.querySelector(
        '.readfirst-row[data-field="RequiredOption2"] .options-readfirst-revert'
      ) as HTMLElement
    );
    await waitFor(() =>
      expect(
        document.querySelector(
          '.readfirst-row[data-field="RequiredOption6"] .options-readfirst-lock-deps'
        )
      ).toBeTruthy()
    );
  },
};

// An `any`-typed option shows its value and expands to the type-aware editor.
export const CompactAnyType: Story = {
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

// optionsLoader (async, transport-agnostic schema source)

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

// The decided "stripe-expand" info display (design/COMPACT_INFO_DISPLAY.md,
// 2026-06-11): intent stripe on Tier-1 rows + a per-row expandable panel
// (auto-open on Tier 1, ⓘ otherwise). Stress fields on top of the Basic fixture.

const INFO_STRESS_OPTIONS = {
  apiEndpoint: {
    type: 'string',
    ui_type: 'string',
    display_name: 'API endpoint',
    short_desc:
      'The upstream REST endpoint this service calls; supports environment templates and is validated against the allow-list on save.',
    preselected: true,
    messages: [
      {
        intent: 'warning',
        title: 'Deprecation',
        content: 'v1 endpoints are deprecated — migrate to /v2 before 2026-09.',
      },
      { intent: 'info', content: 'Requests are signed automatically.' },
    ],
  },
  // field chrome, so the display is exercised with it present
  chromeIcon: { ...chromeFieldBases.chromeIcon, preselected: true },
  chromeImage: { ...chromeFieldBases.chromeImage, preselected: true },
  // Schema intent AND a warning message on one field — the schema stripe and
  // the message-severity stripe interact (message wins).
  chromeIntent: {
    ...chromeFieldBases.chromeIntent,
    display_name: 'With intent (danger) + message',
    preselected: true,
    messages: [{ intent: 'warning', content: 'This field also carries a warning message.' }],
  },
  chromeCard: {
    type: 'list',
    ui_type: 'list',
    display_name: 'Full chrome (card)',
    icon: 'Settings3Line',
    badge: 'beta',
    actions: [{ label: 'Inspect', icon: 'SearchLine' }],
    tags: [{ label: 'demo' }],
    preselected: true,
  },
  // required-group pair: "One of" chips + covered-by notes coexist with the
  // info affordances
  authToken: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Auth token',
    required_groups: ['auth'],
    preselected: true,
  },
  authCertFile: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Auth cert file',
    required_groups: ['auth'],
    preselected: true,
  },
  // meta
  metaSensitive: { ...metaFieldBases.metaSensitive, preselected: true },
  metaDefault: { ...metaFieldBases.metaDefault, preselected: true },
} as unknown as IOptionsSchema;

// Every option carries a short_desc AND a (markdown) desc — full description
// coverage is the worst case for crowding. Existing fixture descriptions are
// kept; only missing ones are filled in.
const withFullDescriptions = (schema: IOptionsSchema): IOptionsSchema =>
  Object.fromEntries(
    Object.entries(schema).map(([name, option]) => {
      const label = ((option as { display_name?: string }).display_name || name).toLowerCase();
      return [
        name,
        {
          ...(option as object),
          short_desc:
            (option as { short_desc?: string }).short_desc ||
            `Configures ${label} — affects how the interface behaves at runtime.`,
          desc:
            (option as { desc?: string }).desc ||
            `Detailed documentation for **${label}**.\n\nSupports markdown:\n\n- when to set it\n- what the default does\n- related fields and \`templates\``,
        },
      ];
    })
  ) as IOptionsSchema;

const infoDisplayArgs = {
  compact: true,
  minColumnWidth: '300px',
  options: withFullDescriptions({ ...getOptions(), ...INFO_STRESS_OPTIONS } as IOptionsSchema),
  value: {
    ...basicFormValue,
    apiEndpoint: { type: 'string', value: 'https://api.example.com/v1' },
    chromeIcon: { type: 'string', value: 'db.local' },
    chromeImage: { type: 'string', value: 'qorus-app' },
    chromeIntent: { type: 'string', value: 'needs attention' },
    chromeCard: { type: 'list', value: ['x', 'y'] },
    metaSensitive: { type: 'string', value: 'hunter2-token' },
    metaDefault: { type: 'number', value: 30 },
  } as IOptions,
};

// The flagship "real form" story: the Basic fixture + stress fields with full
// descriptions — how compact mode looks and feels in actual use.
export const CompactShowcase: Story = {
  args: infoDisplayArgs,
  play: async () => {
    await _testsWaitForText('API endpoint');
    // Tier-1 panels auto-open: the warning is visible without any interaction.
    await _testsWaitForText('v1 endpoints are deprecated — migrate to /v2 before 2026-09.');
    await expect(document.querySelectorAll('.options-readfirst-info-panel').length).toBeGreaterThan(
      0
    );
    // The unmet-dependency hint surfaces on the dependent field's row.
    await _testsWaitForText(
      'This field is disabled because some dependencies are not fulfilled: "basicOption"'
    );
    // ONE info mechanism: no subtitle lines, no badge — just the panel + ⓘ.
    await expect(document.querySelectorAll('.options-readfirst-subtitle')).toHaveLength(0);
    await expect(document.querySelectorAll('.options-readfirst-info-badge')).toHaveLength(0);

    // Field chrome coexists: icon/logo before labels, the schema-intent row
    // striped, sensitive masked, the intent field's own warning auto-open.
    await expect(
      document.querySelector('[data-field="chromeIcon"] .options-readfirst-row-icon')
    ).toBeTruthy();
    await expect(document.querySelector('[data-field="chromeImage"] .reqore-icon img')).toBeTruthy();
    await waitFor(() => {
      // The message-bearing row is wrapped in an info-row div with the same
      // data-field — target the .readfirst-row itself for the stripe.
      const intentRow = document.querySelector(
        '.readfirst-row[data-field="chromeIntent"]'
      ) as HTMLElement;
      expect(intentRow?.style?.boxShadow).toBeTruthy();
    });
    await _testsWaitForText('••••••');
    await _testsWaitForText('This field also carries a warning message.');
    // The required-group linkage chips render alongside the info affordances.
    await _testsWaitForText('One of: auth');

    // Toggling a panel adds/removes the info-row wrapper, REBUILDING the row's
    // DOM — re-query the toggle for every click and assert panel state on the
    // wrapper element.
    const infoToggle = (field: string) =>
      document.querySelector(
        `.readfirst-row[data-field="${field}"] .options-readfirst-info-slot [role="button"]`
      ) as HTMLElement;
    const infoPanel = (field: string) =>
      document.querySelector(
        `.options-readfirst-info-row[data-field="${field}"] .options-readfirst-info-panel`
      );

    // Tier-2-only fields (info messages, default-value notes, short_desc) stay
    // one line: panel closed, ⓘ toggle in the fixed slot. Toggling open reveals
    // the default-value note; toggling again hides it.
    await expect(infoPanel('metaDefault')).toBeNull();
    await expect(infoToggle('metaDefault')).toBeTruthy();
    await fireEvent.click(infoToggle('metaDefault'));
    await _testsWaitForText('Default: thirty — Falls back to 30 seconds when unset.');
    await fireEvent.click(infoToggle('metaDefault'));
    await waitFor(() => expect(infoPanel('metaDefault')).toBeNull());

    // Auto-open panels can be dismissed the same way (override sticks).
    await expect(infoPanel('apiEndpoint')).toBeTruthy();
    await fireEvent.click(infoToggle('apiEndpoint'));
    await waitFor(() => expect(infoPanel('apiEndpoint')).toBeNull());
    await fireEvent.click(infoToggle('apiEndpoint'));
    await _testsWaitForText('v1 endpoints are deprecated — migrate to /v2 before 2026-09.');
  },
};

// The same stress form in a 360 px container — stacked rows, panels full-width.
export const CompactShowcaseMobile: Story = {
  args: infoDisplayArgs,
  decorators: [
    (StoryComponent: React.ComponentType) => (
      <div style={{ maxWidth: 360, margin: '0 auto', border: '1px dashed #ffffff22' }}>
        <StoryComponent />
      </div>
    ),
  ],
  play: async () => {
    await _testsWaitForText('API endpoint');
    await _testsWaitForText('v1 endpoints are deprecated — migrate to /v2 before 2026-09.');
  },
};
