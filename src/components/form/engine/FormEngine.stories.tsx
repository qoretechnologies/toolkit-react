import { ReqoreInput } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { Meta, StoryObj } from '@storybook/react-vite';
import { ChangeEvent, useEffect, useState } from 'react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { validateField } from '../../../helpers/validations';
import { defaultQorusTypes } from '../../../hooks/useQorusTypes';
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
import { startDpqlMockLsp } from '../expressions/dpqlMockLsp';
import { mockExpressions } from '../expressions/mockExpressions';
import { mockPopulatedDefinition } from '../fields/schema-definition/mockDefinition';
import { defaultMarkdownRenderer } from '../fields/markdown/MarkdownView';
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
    // `useQorusTypes` resolves the type catalogue as `size(data) ? data : defaultQorusTypes`,
    // so a reachable, authenticated instance *replaces* the built-in list rather than
    // supplementing it. These stories never opt into live data (no `live: true`), but the
    // request fires anyway — which made `Option With Any Type` pass locally (401 → built-in
    // list, so "Boolean" exists) and fail in CI, where the token is valid and the server's
    // list decides the labels. Pin the catalogue so the type names the plays click are ours.
    mockData: [
      {
        // `query()` builds `${instance}api/latest/${url}`, and the hook's url is
        // `/system/qorus-type-info` — hence the doubled slash. Both spellings are listed
        // so the mock keeps matching if that leading slash is ever dropped.
        url: 'https://hq.qoretechnologies.com:8092/api/latest//system/qorus-type-info',
        method: 'GET',
        status: 200,
        response: defaultQorusTypes,
      },
      {
        url: 'https://hq.qoretechnologies.com:8092/api/latest/system/qorus-type-info',
        method: 'GET',
        status: 200,
        response: defaultQorusTypes,
      },
    ],
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
                label: 'Test (local)',
                badge: 'local',
                value: '$local:test',
              },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine over the shared basic-schema fixture — every option and value the classic layout exercises (booleans, strings with values, templates, invalid types) is present.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Basic FormEngine at size=small — the same fixture but with the compact size preset applied to every control.',
      },
    },
  },
  args: {
    ...Basic.args,
    size: 'small',
  },
};

export const InvalidShownOnly: Story = {
  ...Basic,
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Basic FormEngine, then clicks the invalid-fields message chip in the header — only the invalid options stay visible.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with only the optional half of the basic schema — the More Options Available collapsible box is shown but not opened.',
      },
    },
  },
  args: {
    minColumnWidth: '300px',
    options: getOptions(true),
  },
};

export const OptionalOpened: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with only the optional half of the basic schema, then clicks the More Options Available banner — the optional fields drop down into the form.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Basic FormEngine, hovers an option and clicks its fullscreen action — the Focused Editing modal opens over that single field.',
      },
    },
  },
  play: async (args) => {
    await Basic.play!(args);
    await userEvent.hover(document.querySelectorAll('.system-option')[0]);
    await _testsClickButton({ selector: '.options-item-fullscreen', nth: 0 });
    await _testsWaitForText('Focused Editing');
  },
};

export const DescriptionIsShown: Story = {
  ...Basic,
  parameters: {
    docs: {
      description: {
        story:
          "Renders the Basic FormEngine and clicks the Option with description label — the help panel opens with the option's long-form description.",
      },
    },
  },
  play: async ({ canvasElement, ...rest }) => {
    const canvas = within(canvasElement);
    await Basic.play!({ canvasElement, ...rest });
    await _testsWaitForText('Option with description');
    await fireEvent.click(canvas.queryAllByText('Option with description')[0]);
    await _testsWaitForText('Help For "Option with description"');
  },
};

export const ValueCanBeRemoved: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine holding a text option and a file option, both with values. Hovering each row and clicking its remove action clears the value and marks the row as revertable.',
      },
    },
  },
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
    await waitFor(() => expect(document.querySelector('.options-item-remove')).toBeTruthy(), {
      timeout: 10000,
    });
    await _testsClickButton({ selector: '.options-item-remove', nth: 0 });
    await waitFor(() => expect(document.querySelectorAll('.options-item-revert').length).toBe(1), {
      timeout: 10000,
    });
    await userEvent.hover(document.querySelectorAll('.system-option')[1]);
    await waitFor(() => expect(document.querySelector('.options-item-remove')).toBeTruthy(), {
      timeout: 10000,
    });
    await _testsClickButton({ selector: '.options-item-remove', nth: 0 });
    await _testsWaitForTextToNotExist('Click here to upload a different file');
  },
};

export const ChangeCanBeReverted: Story = {
  ...ValueCanBeRemoved,
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ValueCanBeRemoved fixture after both values are removed, then clicks the per-row revert action — the file value comes back.',
      },
    },
  },
  play: async (args) => {
    await ValueCanBeRemoved.play!(args);
    await _testsClickButton({ selector: '.options-item-revert', nth: 1 });
    await _testsWaitForText('Click here to upload a different file');
  },
};

export const AllChangesCanBeReverted: Story = {
  ...ValueCanBeRemoved,
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ValueCanBeRemoved fixture after both values are removed, then clicks the form-level revert action — the entire form goes back to its original values.',
      },
    },
  },
  play: async (args) => {
    await ValueCanBeRemoved.play!(args);
    await _testsClickButton({ selector: '.fields-revert' });
    await _testsWaitForText('Click here to upload a different file');
  },
};

export const WithTypesShown: Story = {
  ...Basic,
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Basic FormEngine and clicks the show-types header action — every option label picks up its Qore type badge (e.g. <rgbcolor>).',
      },
    },
  },
  play: async (args) => {
    await Basic.play!(args);
    await _testsClickButton({ selector: '.fields-show-types' });
    await _testsWaitForText('<rgbcolor>');
  },
};

export const WithRequiredGroups: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders FormEngine with five options that all belong to one required_groups group — every row mounts and the group's one-of-required indicator is shown.",
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders the required-group schema with one of the group's options already filled — the group's one-of-required indicator marks the group as satisfied.",
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with a required option that depends on Required Option 2 OR Required Option 5 — the field is disabled until either dependency is filled, then the disabled note clears.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with a required option that depends on Required Option 2 alone — filling Required Option 2 clears the disabled note.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with only the optional half of the basic schema plus pre-existing values — the optional fields are already populated and the More Options Available banner is hidden.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders four options typed as any with templates enabled — empty ones show a Select Template dropdown, the pre-typed number field renders as a Number input and the operator can switch types via the More menu.',
      },
    },
  },
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
    await _testsClickButton({ label: 'Boolean' });
  },
};

export const NonExistentOptionsFiltered: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with a value that carries three fields but a schema that declares only two — the extra option is filtered out and onChange fires without it.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders FormEngine with an option that declares on_change: ['refetch']. Editing the field fires onChange with meta.events set to ['refetch'] so the host can re-fetch dependent options.",
      },
    },
  },
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

// A stand-in for a host-injected `code-editor` renderer. Reqraft does not
// ship a CodeEditor (Monaco is a heavy dep the toolkit shouldn't pull in);
// the IDE / consumers inject one via `componentOverrides`. This stand-in
// renders a textarea AND a visible "syntax: <language>" tag so the
// `inherit_props` story (below) can prove the inherited `language` prop
// flows through to the renderer at render time.
const CodeEditorStandin = ({
  value,
  onChange,
  language,
  size,
}: {
  value?: unknown;
  onChange?: (value: string) => void;
  language?: unknown;
  size?: TSizes;
}) => (
  <div data-testid='code-editor-mock'>
    <div data-testid='code-editor-language' style={{ fontFamily: 'monospace', marginBottom: 4 }}>
      syntax: {String(language ?? 'plain')}
    </div>
    <ReqoreInput
      fluid
      size={size}
      icon='CodeLine'
      placeholder='Source code (stand-in code-editor)'
      value={typeof value === 'string' ? value : ''}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value)}
    />
  </div>
);

// qorus#347-followup: an option can declare `inherit_props` — a JSON map of
// `<prop-name-on-renderer>` → `<sibling-field-name>` — and FormEngine
// resolves each entry at render time, forwarding the sibling's current
// value as a runtime prop on this field's renderer. Unlike `on_change:
// ['refetch']` (which requires a server round-trip to reshape the
// schema), `inherit_props` is purely a render-time prop forwarding —
// fast, JSON-safe, and the receiving renderer decides how to use the
// value (e.g. CodeEditor maps `language: "qore"` to its highlighter
// mode). This story demonstrates the canonical case: a `source` field
// (rendered by a host-injected code-editor) inherits `language` from
// a sibling `lang` picker, so flipping the picker live-changes the
// editor's syntax highlighting with no refetch.
/**
 * The same stand-in without the "syntax: <language>" tag.
 *
 * That tag exists to prove an inherited `language` prop reaches the renderer,
 * and the stories that assert it keep it. Where the row already shows a Language
 * control directly above the editor, it is the same fact stated twice — which is
 * what the review flagged on `CompactRowAbsorbsLanguage`.
 */
const CodeEditorStandinNoSyntax = (props: Parameters<typeof CodeEditorStandin>[0]) => (
  <div data-testid='code-editor-mock'>
    <ReqoreInput
      fluid
      size={props.size}
      icon='CodeLine'
      placeholder='Source code (stand-in code-editor)'
      value={typeof props.value === 'string' ? props.value : ''}
      onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange?.(event.target.value)}
    />
  </div>
);

export const OptionInheritsRenderPropFromSibling: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders FormEngine with a code-editor field that declares inherit_props: { language: 'lang' } — the sibling language picker feeds the editor's language prop at render time, and flipping the picker live-updates the syntax without any refetch.",
      },
    },
  },
  args: {
    componentOverrides: { 'code-editor': CodeEditorStandin },
    value: {
      lang: { type: 'string', value: 'qore' },
      source: { type: 'string', value: 'sub run() { print("hello"); }' },
    },
    options: {
      lang: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Language',
        allowed_values: [
          { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
          { display_name: 'Python', value: { type: 'string', value: 'python' } },
          { display_name: 'Java', value: { type: 'string', value: 'java' } },
        ],
      },
      source: {
        type: 'string',
        ui_type: 'code-editor',
        display_name: 'Source Code',
        // The feature under test: the `language` prop of the code-editor
        // renderer is sourced from sibling `lang`'s current value at
        // render time. No `on_change` refetch — instant prop forwarding.
        inherit_props: { language: 'lang' },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Initial state: lang = "qore" → editor renderer receives language="qore"
    await waitFor(
      () => expect(canvas.getByTestId('code-editor-language')).toHaveTextContent('syntax: qore'),
      { timeout: 5000 }
    );

    // Change lang → python via the select; the code-editor's `language`
    // prop should re-resolve and the visible "syntax:" tag should update
    // without any extra clicks or refetches.
    const langField = (
      canvasElement.querySelectorAll('.system-option') as NodeListOf<HTMLElement>
    )[0];
    const langSelectTrigger = within(langField).getByText('Qore');
    await userEvent.click(langSelectTrigger);
    const pythonItem = await within(document.body).findByText('Python');
    await userEvent.click(pythonItem);

    await waitFor(
      () => expect(canvas.getByTestId('code-editor-language')).toHaveTextContent('syntax: python'),
      { timeout: 5000 }
    );
  },
};

// qorus#347-followup, compact variant of the FLAT case: same schema and
// componentOverride as `OptionInheritsRenderPropFromSibling`, but the form
// is rendered with `compact: true`. Compact and classic share the same
// `renderOption` callback (FormEngine.tsx:1590) where `inherit_props` is
// resolved onto `TemplateField`, so the forwarding mechanism is identical
// in both modes. This story locks that in so a future refactor of the
// compact path can't silently break inherit_props for read-first surfaces.
export const OptionInheritsRenderPropFromSiblingCompact: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the OptionInheritsRenderPropFromSibling schema with compact=true — the same inherit_props forwarding runs through the compact renderer.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    componentOverrides: { 'code-editor': CodeEditorStandin },
    value: {
      lang: { type: 'string', value: 'qore' },
      source: { type: 'string', value: 'sub run() { print("hello"); }' },
    },
    options: {
      lang: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Language',
        allowed_values: [
          { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
          { display_name: 'Python', value: { type: 'string', value: 'python' } },
          { display_name: 'Java', value: { type: 'string', value: 'java' } },
        ],
      },
      source: {
        type: 'string',
        ui_type: 'code-editor',
        display_name: 'Source Code',
        inherit_props: { language: 'lang' },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Compact renders rows collapsed by default. Structural check: the
    // schema arrives intact + the source-code row is present. The full
    // interaction (lang flip -> language prop updates) is covered by the
    // classic `OptionInheritsRenderPropFromSibling` story.
    await waitFor(() => expect(canvas.getAllByText('Source Code').length).toBeGreaterThan(0), {
      timeout: 5000,
    });
  },
};

// Compact-row code-editor preview: a `code-editor` field with a multi-line
// string value renders (a) a "N lines · N chars" tag in the value cell instead
// of the truncated raw string, and (b) a monospace `<pre>` block under the row
// capped by a `ReqoreCollapsibleContent` — the "Show more" affordance the value
// cell couldn't provide on its own. Locks the compact preview so a future
// CompactRow refactor can't silently reduce a Qorus source-code field to an
// ellipsised one-liner again.
// An open field used to have exactly one way out — the green Done check — so
// every exit committed, Escape included. This locks the Cancel affordance in
// place: it appears only once there is something to discard, and it puts the
// value back to what the field was opened with.
export const CompactRowCancelEdit: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact row opened for editing with a changed value — the Cancel action appears beside Done, and clicking it puts the field back to the value it was opened with and closes it.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '360px',
    value: { cookie_name: { type: 'string', value: 'my-cookie' } },
    options: {
      cookie_name: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Cookie Name',
        short_desc: 'Cookie name for cookie authentication',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // Open the field.
    const row = canvasElement.querySelector<HTMLElement>('[data-field="cookie_name"]');
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    await waitFor(() =>
      expect(canvasElement.querySelector('.readfirst-row-editing')).toBeTruthy()
    );

    // An untouched field offers no Cancel — it would do exactly what Done does.
    expect(canvasElement.querySelector('.options-readfirst-cancel')).toBeNull();

    const input = canvasElement.querySelector<HTMLInputElement>(
      '[data-field="cookie_name"] input, [data-field="cookie_name"] textarea'
    );
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { value: 'changed-cookie' } });

    // Cancel appears the moment the value differs from what was opened.
    await waitFor(
      () => expect(canvasElement.querySelector('.options-readfirst-cancel')).toBeTruthy(),
      { timeout: 5000 }
    );

    fireEvent.click(canvasElement.querySelector<HTMLElement>('.options-readfirst-cancel')!);

    // The row closes and the opened-with value is back.
    await waitFor(() => expect(canvasElement.querySelector('.readfirst-row-editing')).toBeNull(), {
      timeout: 5000,
    });
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[data-field="cookie_name"]')?.textContent ?? ''
        ).toContain('my-cookie'),
      { timeout: 5000 }
    );
  },
};

// Language and Source code are one decision — "what is this code, and in what
// language" — and the form used to ask it as two unrelated rows one above the
// other. `absorb_fields` lets the editor take the language into its own
// container so the pair reads as the single element it is.
export const CompactRowAbsorbsLanguage: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a code-editor row that absorbs its Language sibling — the language control sits inside the Source Code container above the editor instead of on a row of its own, and the collapsed row summarises it as a chip beside the code size.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '360px',
    componentOverrides: { 'code-editor': CodeEditorStandinNoSyntax },
    value: {
      language: { type: 'string', value: 'qore' },
      source: { type: 'string', value: '%new-style\nclass Example {\n}\n' },
    },
    options: {
      language: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Language',
        allowed_values: [
          { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
          { display_name: 'Python', value: { type: 'string', value: 'python' } },
        ],
      },
      source: {
        type: 'string',
        ui_type: 'code-editor',
        display_name: 'Source Code',
        inherit_props: { language: 'language' },
        absorb_fields: ['language'],
      },
    },
  },
  play: async ({ canvasElement }) => {
    // The absorbed field has no row of its own.
    await waitFor(() => expect(canvasElement.querySelector('[data-field="source"]')).toBeTruthy());
    expect(canvasElement.querySelector('[data-field="language"]')).toBeNull();

    // Collapsed, the host still reports the absorbed value — otherwise the
    // language would vanish from the form whenever the editor is closed.
    const sourceRow = canvasElement.querySelector('[data-field="source"]');
    expect(sourceRow?.textContent ?? '').toContain('qore');

    // Opening the host renders the language control inside its container.
    fireEvent.click(sourceRow as HTMLElement);
    await waitFor(() =>
      expect(canvasElement.querySelector('.readfirst-row-editing')).toBeTruthy()
    );
    await waitFor(() =>
      expect(canvasElement.querySelector('.options-readfirst-absorbed')).toBeTruthy()
    );
    // It is still identifiable as its own field, not a property of the editor.
    expect(canvasElement.querySelector('.options-readfirst-absorbed')?.textContent ?? '').toContain(
      'Language'
    );
  },
};

export const CompactRowCancelEditAffordance: Story = {
  ...CompactRowCancelEdit,
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact row open for editing with a changed value, stopping while it is open — Cancel edit sits beside the green Done check, which is what an open field used to offer on its own.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>('[data-field="cookie_name"]');
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    await waitFor(() =>
      expect(canvasElement.querySelector('.readfirst-row-editing')).toBeTruthy()
    );

    const input = canvasElement.querySelector<HTMLInputElement>(
      '[data-field="cookie_name"] input, [data-field="cookie_name"] textarea'
    );
    fireEvent.change(input!, { target: { value: 'changed-cookie' } });

    await waitFor(
      () => expect(canvasElement.querySelector('.options-readfirst-cancel')).toBeTruthy(),
      { timeout: 5000 }
    );
    // Both ways out are on screen together, which is the point of the story.
    expect(canvasElement.querySelector('.options-readfirst-done')).toBeTruthy();
  },
};

export const CompactRowCodeEditorPreview: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact-mode code-editor row over a multi-line Qore source value — the value cell replaces the truncated string with a lines/chars summary tag and a collapsible monospace preview mounts under the row.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '360px',
    componentOverrides: { 'code-editor': CodeEditorStandin },
    value: {
      language: { type: 'string', value: 'qore' },
      source: {
        type: 'string',
        value:
          '%new-style\n%require-types\n%strict-args\n' +
          '%enable-all-warnings\n\n' +
          'class ExampleJob inherits QorusJob {\n' +
          '    run() {\n' +
          '        logInfo("running");\n' +
          '    }\n' +
          '}\n',
      },
    },
    options: {
      language: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Language',
        allowed_values: [
          { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
          { display_name: 'Python', value: { type: 'string', value: 'python' } },
          { display_name: 'Java', value: { type: 'string', value: 'java' } },
        ],
      },
      source: {
        type: 'string',
        ui_type: 'code-editor',
        display_name: 'Source Code',
        inherit_props: { language: 'language' },
      },
    },
  },
  play: async ({ canvasElement }) => {
    // (a) The monospace preview mounted under the row — contains a substring
    //     only the source has, proving `showCodePreview` kicked in and the
    //     `StyledCodePreview` block is in the DOM.
    await waitFor(
      () => {
        const preview = canvasElement.querySelector('.options-readfirst-code');
        expect(preview).toBeTruthy();
        expect(preview?.textContent).toContain('class ExampleJob inherits QorusJob');
      },
      { timeout: 5000 }
    );
    // (b) The value cell replaced its truncated raw string with a summary tag —
    //     query the tag directly (its label + labelKey render on separate spans,
    //     so text-matching across them is fragile). Look for the CodeLine icon
    //     that only this tag mounts alongside the source-code row.
    const sourceRow = canvasElement.querySelector('[data-field="source"]');
    expect(sourceRow).toBeTruthy();
    expect(sourceRow?.textContent ?? '').toMatch(/\d+\s*lines?/);
  },
};

export const CompactRowCodeEditorMessage: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A schema `messages` entry on a code-editor field. Every other field surfaces its messages on the collapsed row; a code field draws a preview in the same cell, and the message has to survive beside it — a diagnostic the reader only finds by opening the field is not reported. Qorus puts source-validation results here, so an invalid service is called out on the row rather than at save time.",
      },
    },
  },
  args: {
    ...CompactRowCodeEditorPreview.args,
    options: {
      ...(CompactRowCodeEditorPreview.args as any).options,
      source: {
        ...(CompactRowCodeEditorPreview.args as any).options.source,
        // The field ABSORBS its language sibling, which is how Qorus ships it:
        // the language control renders inside the Source Code container. That
        // is the shape the message has to survive.
        absorb_fields: ['language'],
        // Qorus groups its fields (INFO / SCALING), so the row renders inside a
        // group rather than in a flat list.
        group: 'info',
        messages: [
          {
            intent: 'danger',
            title: 'Line 4',
            content: "syntax error, unexpected '}'",
          },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    // The message renders on the collapsed row, beside the code preview rather
    // than instead of it.
    await waitFor(
      () => {
        const row = canvasElement.querySelector('[data-field="source"]');
        expect(row?.textContent ?? '').toContain('Line 4');
        expect(row?.textContent ?? '').toContain("syntax error, unexpected '}'");
      },
      { timeout: 5000 }
    );

    const row = canvasElement.querySelector('[data-field="source"]');
    // ... and the preview it sits beside is still there.
    expect(row?.textContent ?? '').toContain('class ExampleJob inherits QorusJob');
  },
};

/**
 * Adds a schema message to a field a moment AFTER the form has mounted, the way
 * a host that validates asynchronously does.
 */
const LateMessageHarness = (args: any) => {
  const [options, setOptions] = useState(args.options);

  useEffect(() => {
    const timer = setTimeout(
      () =>
        setOptions((current: any) => ({
          ...current,
          source: {
            ...current.source,
            messages: [
              { intent: 'danger', title: 'Line 4', content: "syntax error, unexpected '}'" },
            ],
          },
        })),
      100
    );
    return () => clearTimeout(timer);
  }, []);

  return <FormEngine {...args} options={options} />;
};

export const CompactRowCodeEditorLateMessage: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The same message, but added to the schema after the form has mounted — which is how a host that validates asynchronously delivers one. A message that only renders when it was present at mount is no use to a validator: the answer always arrives later than the field did.',
      },
    },
  },
  args: { ...CompactRowCodeEditorPreview.args },
  render: (args) => <LateMessageHarness {...args} />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const row = canvasElement.querySelector('[data-field="source"]');
        expect(row?.textContent ?? '').toContain('Line 4');
      },
      { timeout: 10000 }
    );
  },
};

export const CompactRowMessageWhileEditing: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The same message, with the row OPEN. A schema message is guidance about the value, so the moment it matters most is while the value is being edited — and a validation diagnostic is useless anywhere else: it names a line the author can only fix with the editor in front of them. Qorus opens the Source Code row on arrival, so a message that only survives on the collapsed row was never seen at all.",
      },
    },
  },
  args: { ...CompactRowCodeEditorMessage.args },
  play: async ({ canvasElement }) => {
    // Open the row, the way an author does before fixing what the message says.
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-field="source"]')).toBeTruthy();
    });
    await fireEvent.click(canvasElement.querySelector('[data-field="source"]') as HTMLElement);

    await waitFor(() => {
      expect(canvasElement.querySelector('.readfirst-row-editing')).toBeTruthy();
    });

    const editingRow = canvasElement.querySelector('.readfirst-row-editing') as HTMLElement;
    expect(editingRow?.textContent ?? '').toContain('Line 4');
    expect(editingRow?.textContent ?? '').toContain("syntax error, unexpected '}'");
  },
};

export const CompactRowMarkdownPreview: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders compact-mode markdown rows over a service description, with a host markdown renderer supplied — the multi-line row prints NO value line and mounts the rendered document under the row instead, since a stripped-prose copy above it would be the same text rendered twice. Its line count moves under the field name in the label column, in a small monospaced note, because the count describes the field rather than the value. The one-line row keeps its single rendered line, gets no preview and no count.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '360px',
    // The row inset draws through the HOST's renderer and has no built-in
    // fallback: a form that picks its own markdown dialect renders the same
    // description differently from the page it belongs to, which is the whole
    // problem this seam exists to avoid. `defaultMarkdownRenderer` is reqraft's
    // own view, supplied here the way a host supplies its own.
    markdownRenderer: defaultMarkdownRenderer,
    value: {
      desc: {
        type: 'string',
        value:
          '## Order intake\n\n' +
          'Receives orders from the **partner** portal and hands each one to the\n' +
          '`order-processing` workflow.\n\n' +
          '- Rejects an order with no `customer_id`\n' +
          '- Retries a transient portal failure three times\n\n' +
          'See [the runbook](https://example.com/runbook) for the escalation path.\n',
      },
      summary: { type: 'string', value: 'Handles **partner** order intake.' },
    },
    // Cast for the same reason `cron` / `dpql` / `schema-definition` need one:
    // a renderer-only `ui_type` names an EDITOR, and ts-toolkit's `TQorusType`
    // enumerates STORAGE types, so it has no member for one. The stored type
    // stays `string`, which is what the union does describe.
    options: {
      desc: { type: 'string', ui_type: 'markdown', display_name: 'Description' },
      summary: { type: 'string', ui_type: 'markdown', display_name: 'Summary' },
    } as never,
  },
  play: async ({ canvasElement }) => {
    // (a) The rendered document mounted under the multi-line row — a heading
    //     ELEMENT, not a printed "## ", is what proves it rendered.
    await waitFor(
      () => {
        const preview = canvasElement.querySelector('.options-readfirst-markdown');
        expect(preview).toBeTruthy();
        expect(preview?.querySelector('h2')?.textContent).toBe('Order intake');
        expect(preview?.querySelector('strong')?.textContent).toBe('partner');
      },
      { timeout: 5000 }
    );

    // (b) The value column holds the VALUE and nothing else. With a renderer
    //     present the document is drawn in full below, so the stripped-prose copy
    //     that used to sit above it is gone — two renderings of one value, stacked,
    //     was the confusion this removes (Qlip review, build #97).
    const descRow = canvasElement.querySelector('[data-field="desc"]');
    expect(descRow?.querySelector('.options-readfirst-valuetext')).toBeNull();

    // (c) The line count describes the FIELD, so it sits under the field's name
    //     in the label column — not in front of its content.
    const lineNote = descRow?.querySelector('.options-readfirst-label-lines');
    expect(lineNote?.textContent ?? '').toMatch(/^\d+ lines$/);
    expect(getComputedStyle(lineNote as Element).fontFamily).toContain('monospace');

    // (d) A one-liner is already fully rendered as the row's own text, so it
    //     gets no second copy below it — and no line count, because there is
    //     nothing more to count.
    const summaryRow = canvasElement.querySelector('[data-field="summary"]');
    expect(summaryRow?.querySelector('.options-readfirst-markdown')).toBeNull();
    expect(summaryRow?.querySelector('.options-readfirst-label-lines')).toBeNull();
    expect(summaryRow?.querySelector('.options-readfirst-valuetext')?.textContent).toBe(
      'Handles partner order intake.'
    );
  },
};

// qorus#347-followup, scope forwarding: this story exercises the nested
// case of the OptionInheritsRenderPropFromSibling contract. The parent
// form declares `methods: { ui_type: 'list', element_type: 'hash',
// arg_schema: {...}, inherit_props: { language: 'language' } }`. FormEngine
// resolves the parent's inherit_props against the top-level `language`
// field, threads the resolved bag through the ArrayAuto row wrapper into
// each row's arg_schema sub-form as `inheritedFromParent`. The row's
// `body` sub-field ALSO declares `inherit_props: { language: 'language' }`;
// its `availableOptions` has no `language` (rows only carry name /
// description / body), so the resolver falls back to
// `inheritedFromParent.language` and threads it as the CodeEditor's
// `language` prop. Flipping the top-level lang picker live-updates every
// row's editor without any custom per-field wiring.
export const NestedOptionInheritsRenderPropFromAncestor: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders FormEngine with a list-of-hash methods option whose row sub-schema declares inherit_props: { language: 'language' } — the parent-level forwarding threads the top-level language down to every row's code-editor body sub-field.",
      },
    },
  },
  args: {
    componentOverrides: { 'code-editor': CodeEditorStandin },
    value: {
      language: { type: 'string', value: 'qore' },
      methods: {
        type: 'list',
        value: [
          { type: 'hash', value: { name: 'init', body: 'sub init() { }' } },
          { type: 'hash', value: { name: 'run', body: 'sub run() { print("hi"); }' } },
        ],
      },
    },
    options: {
      language: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Language',
        allowed_values: [
          { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
          { display_name: 'Python', value: { type: 'string', value: 'python' } },
          { display_name: 'Java', value: { type: 'string', value: 'java' } },
        ],
      },
      methods: {
        type: 'list',
        ui_type: 'list',
        element_type: 'hash',
        display_name: 'Methods',
        // Parent-level declaration: forward top-level `language` down into
        // each row's arg_schema sub-form so per-method `body` sub-fields
        // can pick it up as `language` prop without knowing about the
        // ancestor scope.
        inherit_props: { language: 'language' },
        arg_schema: {
          name: {
            type: 'string',
            ui_type: 'string',
            display_name: 'Method Name',
          },
          body: {
            type: 'string',
            ui_type: 'code-editor',
            display_name: 'Method Body',
            // Row-level declaration: the resolver walks
            //   1. local availableOptions (row only has name + body — no
            //      language here),
            //   2. `inheritedFromParent` (populated by the parent-level
            //      `methods.inherit_props` above — has language).
            inherit_props: { language: 'language' },
          },
        },
      },
    } as unknown as IOptionsSchema,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Two rows -> two code-editor stand-ins -> each shows "syntax: qore"
    // at initial render, sourced from the top-level `language` field via
    // parent -> row scope forwarding.
    await waitFor(
      () => {
        const tags = canvas.getAllByTestId('code-editor-language');
        expect(tags).toHaveLength(2);
        tags.forEach((tag) => expect(tag).toHaveTextContent('syntax: qore'));
      },
      { timeout: 5000 }
    );
  },
};

// qorus#347-followup, scope forwarding + compact variant: same schema as
// `NestedOptionInheritsRenderPropFromAncestor` but with `compact: true`.
// Compact and classic share the `renderOption` callback (FormEngine.tsx:1590)
// which is where the `inheritedFromParent` bag is threaded onto TemplateField,
// so the forwarding mechanism is identical in both modes. This story locks
// that in — a compact rendering of a parent form with a nested arg_schema
// list-of-hash whose sub-fields still resolve `language` from the top-level
// picker through the same two-hop chain.
export const NestedOptionInheritsRenderPropFromAncestorCompact: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the NestedOptionInheritsRenderPropFromAncestor schema with compact=true — the compact renderer previews the list-of-hash rows through their arg_schema, naming each method, rather than printing [object Object].",
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    componentOverrides: { 'code-editor': CodeEditorStandin },
    value: {
      language: { type: 'string', value: 'qore' },
      methods: {
        type: 'list',
        value: [
          { type: 'hash', value: { name: 'init', body: 'sub init() { }' } },
          { type: 'hash', value: { name: 'run', body: 'sub run() { print("hi"); }' } },
        ],
      },
    },
    options: {
      language: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Language',
        allowed_values: [
          { display_name: 'Qore', value: { type: 'string', value: 'qore' } },
          { display_name: 'Python', value: { type: 'string', value: 'python' } },
          { display_name: 'Java', value: { type: 'string', value: 'java' } },
        ],
      },
      methods: {
        type: 'list',
        ui_type: 'list',
        element_type: 'hash',
        display_name: 'Methods',
        inherit_props: { language: 'language' },
        arg_schema: {
          name: {
            type: 'string',
            ui_type: 'string',
            display_name: 'Method Name',
          },
          body: {
            type: 'string',
            ui_type: 'code-editor',
            display_name: 'Method Body',
            inherit_props: { language: 'language' },
          },
        },
      },
    } as unknown as IOptionsSchema,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Compact renders each option collapsed into a read-first row. The
    // methods row needs a click to expand, then the nested list rows each
    // need a click to expand and reveal the body sub-field's editor with
    // the inherited language. Rather than driving that whole editing
    // flow (which is what the CompactBasic / CompactExpressions stories
    // already exercise), assert on the STRUCTURAL element: the schema
    // arrived intact through `inheritedFromParent` and the row-level
    // options include the body field wired to the code-editor override.
    await waitFor(() => expect(canvas.getAllByText('Methods').length).toBeGreaterThan(0), {
      timeout: 5000,
    });
    // The list-of-hashes value names its items — never a raw "[object Object]"
    // (regression: it used to stringify each hash envelope). The names now come
    // from the schema preview rather than a joined summary line above it, so the
    // assertion moved with them; what must never come back is the stringified
    // envelope.
    await expect(await canvas.findByText('init', undefined, { timeout: 5000 })).toBeInTheDocument();
    await expect(await canvas.findByText('run')).toBeInTheDocument();
    await expect(canvasElement.textContent ?? '').not.toContain('[object Object]');
  },
};

// The companion above deliberately stops at the collapsed summary, which is
// exactly where this bug hid: nothing expanded a list-of-hash row inside a
// compact form. `compact` is destructured out of AutoFormField's `...rest`, so
// while the `hash` case forwarded it explicitly to the nested FormEngine, the
// `list` case handed `<ArrayAuto {...rest}>` no `compact` at all — every row's
// arg_schema sub-form fell back to the CLASSIC engine (stacked labels + an
// option filter) while every sibling field beside it rendered as a compact
// read-first row. This story expands the row and asserts the sub-form is
// compact, which is only observable once the rows are open.
export const CompactNestedListRowsStayCompact: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Expands a list-of-hash option inside a compact form — each row's arg_schema sub-form renders as compact read-first rows, matching the parent, instead of falling back to the classic stacked-label form.",
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    value: {
      methods: {
        type: 'list',
        value: [
          { type: 'hash', value: { name: 'init', desc: 'initialises the service' } },
          { type: 'hash', value: { name: 'run', desc: 'does the work' } },
        ],
      },
    },
    options: {
      methods: {
        type: 'list',
        ui_type: 'list',
        element_type: 'hash',
        display_name: 'Methods',
        arg_schema: {
          name: {
            type: 'string',
            ui_type: 'string',
            display_name: 'Method Name',
          },
          desc: {
            type: 'string',
            ui_type: 'string',
            display_name: 'Description',
          },
        },
      },
    } as unknown as IOptionsSchema,
  },
  play: async ({ canvasElement }) => {
    // Collapsed, the row previews its items through their schema — one numbered
    // entry per method, each naming itself.
    // The method name heads its item now, so that is what identifies the row.
    await _testsWaitForText('init');
    await _testsWaitForText('run');

    // Open the Methods row — this mounts ArrayAuto and, with it, one
    // arg_schema sub-form per row. Clicked by the field's NAME: the joined
    // summary that used to sit on this row is gone, replaced by the preview.
    await _testsClickText('Methods');

    await waitFor(
      () => expect(canvasElement.querySelectorAll('.array-auto-item')).toHaveLength(2),
      { timeout: 5000 }
    );

    // `data-field` and `readfirst-row` are mounted by CompactRow and by nothing
    // else, so their presence INSIDE a row is the structural proof that the
    // sub-form inherited compact. Without the fix both counts are 0 and the
    // rows render the classic form instead.
    await waitFor(
      () => {
        const rows = canvasElement.querySelectorAll('.array-auto-item');

        rows.forEach((row) => {
          expect(row.querySelector('[data-field="name"]')).toBeTruthy();
          expect(row.querySelector('[data-field="desc"]')).toBeTruthy();
          expect(row.querySelectorAll('.readfirst-row').length).toBeGreaterThan(0);
        });
      },
      { timeout: 5000 }
    );

    // Each row shows its own values through the compact read-first summary.
    await _testsWaitForText('initialises the service');
    await _testsWaitForText('does the work');
  },
};

// Phone width: the nested rows inherit the parent's responsive behaviour, so a
// row's label/value pair stacks instead of overflowing the 360px container.
// Worth its own story because the classic fallback this fix replaces sized its
// inputs from the container and clipped them here.
export const CompactNestedListRowsStayCompactMobile: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the expanded list-of-hash rows at a ~360px mobile viewport — each row's compact sub-form stacks into a single column rather than overflowing.",
      },
    },
  },
  args: CompactNestedListRowsStayCompact.args,
  decorators: [
    (StoryComponent: React.ComponentType) => (
      <div style={{ maxWidth: 360, margin: '0 auto', border: '1px dashed #ffffff22' }}>
        <StoryComponent />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await _testsWaitForText('init');
    await _testsClickText('Methods');

    await waitFor(
      () => expect(canvasElement.querySelectorAll('.array-auto-item')).toHaveLength(2),
      { timeout: 5000 }
    );
    await waitFor(
      () => {
        canvasElement.querySelectorAll('.array-auto-item').forEach((row) => {
          expect(row.querySelector('[data-field="name"]')).toBeTruthy();
        });
      },
      { timeout: 5000 }
    );

    // Nothing spills out of the 360px container.
    const container = canvasElement.querySelector('.array-auto-item') as HTMLElement;
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth + 1);
  },
};

export const DependantsResetWhenParentChanges: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders FormEngine with two dependent options plus two has-dependents parents. Changing the parent's value clears every dependent's value while leaving the unrelated sibling untouched.",
      },
    },
  },
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

export const CompactWithholdsFieldsWithUnmetDependencies: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A field whose `depends_on` is not fulfilled is not offered as an addable one. The scheme here is Permissive, so the two cookie-only fields are absent from the Optional box entirely — only the field that depends on nothing is offered. Setting the scheme to Cookie brings them back (and flashes them). Before this, they were listed, and clicking one opened a row that said it was disabled: an affordance leading nowhere.",
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      type: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Scheme Type',
        short_desc: 'Authentication scheme type',
        required: true,
      },
      cookie_name: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Session Cookie Name',
        short_desc: 'Applies to the Cookie scheme alone',
        depends_on: ['type=cookie'],
      },
      redirect_url: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Redirect URL',
        short_desc: 'Applies to the Cookie scheme alone',
        depends_on: ['type=cookie'],
      },
      note: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Note',
        short_desc: 'Depends on nothing, so it is always offered',
      },
    } as IOptionsSchema,
    value: {
      type: { type: 'string', value: 'permissive' },
    },
  },
  play: async () => {
    await _testsWaitForText('Scheme Type');
    await _expandOptionalBox();

    // The independent field IS offered — without this the two absences below
    // would also be explained by an Optional box that never opened.
    await _testsWaitForText('Note');
    await waitFor(
      () => expect(document.querySelector('[data-field="note"]')).toBeTruthy(),
      { timeout: 10000 }
    );

    await waitFor(
      () => {
        expect(document.querySelector('[data-field="cookie_name"]')).toBeNull();
        expect(document.querySelector('[data-field="redirect_url"]')).toBeNull();
      },
      { timeout: 10000 }
    );
  },
};

export const CompactConditionalMessage: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A schema `messages` entry carrying `when` / `unless` appears only while the condition holds against the form's current values, using the same grammar as `depends_on`. Here the warning on `permissions` is declared `when: ['allow_anonymous=true']`, so it is absent until the exemption is switched on. A warning about a COMBINATION cannot be static: an always-on warning sitting over a valid configuration is one people learn to scroll past, so it is not there when it finally means something. The filter is applied everywhere the messages are read — including the read-first status — so a hidden message cannot colour a row or inflate the attention count.",
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      permissions: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Require All Of These Permissions',
        short_desc: 'Every listed permission must be held',
        messages: [
          {
            intent: 'warning',
            title: 'Anonymous callers skip these',
            content:
              'The exemption below lets a caller with no credentials through without checking any of these requirements. Callers that DO present credentials are still checked.',
            when: ['allow_anonymous=true'],
          },
        ],
      },
      allow_anonymous: {
        type: 'bool',
        ui_type: 'bool',
        display_name: 'Exempt Anonymous Callers',
        short_desc: 'Anonymous callers bypass the requirements above',
      },
    } as IOptionsSchema,
    value: {
      permissions: { type: 'string', value: 'READ-ORDER' },
      allow_anonymous: { type: 'bool', value: true },
    },
  },
  play: async ({ canvasElement }) => {
    await _testsWaitForText('Require All Of These Permissions');
    // The condition holds in this story's args, so the warning is present.
    await waitFor(
      () => expect(canvasElement.textContent).toContain('Anonymous callers skip these'),
      { timeout: 10000 }
    );
  },
};

export const ValueIsFixedWhenDefaultValueDoesNotMatchAndReadOnlyIsTrue: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with a read-only option whose stored value differs from its default_value — the value is auto-corrected to the default at mount and the wrong value never renders.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with a refetch-triggering parent and a list-of-hash dependent — the schema mounts cleanly and adding a new list item does not cause the form to re-render infinitely.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine with an allowed_values option that holds a template value ($local:test) instead of one of the allowed values — the option shows a warning that the template value is outside the allowed set.',
      },
    },
  },
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
    docs: {
      description: {
        story:
          'Renders FormEngine wired to an onValidityChange callback — the callback fires with per-field validity data as the overall form validity changes.',
      },
    },
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
// visible (a "— Required" row and an invalid-field message).
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

// The Optional status box now holds every not-yet-added field AND any added-but-
// empty optional field, so it starts COLLAPSED (and ReqorePanel unmounts collapsed
// content). Tests that assert on / interact with optional fields call this to open
// it. The whole panel title bar toggles the collapse.
const _expandOptionalBox = async () => {
  const findBox = () =>
    Array.from(document.querySelectorAll('.options-readfirst-group')).find((panel) =>
      panel.querySelector('.reqore-panel-title')?.textContent?.includes('Optional')
    );
  let box: Element | undefined;
  await waitFor(
    () => {
      box = findBox();
      expect(box).toBeTruthy();
    },
    { timeout: 10000 }
  );
  // No `.reqore-panel-content` ⇒ the box is collapsed (content unmounted) — open it.
  if (box && !box.querySelector('.reqore-panel-content')) {
    await fireEvent.click(box.querySelector('.reqore-panel-title') as HTMLElement);
    await waitFor(() => expect(box!.querySelector('.reqore-panel-content')).toBeTruthy(), {
      timeout: 10000,
    });
  }
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormEngine in compact mode over the CompactSchema fixture with groups — options collapse to read-first rows grouped under labelled group headers, with formatted value summaries per row.',
      },
    },
  },
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
    // Regression: `general` is a REAL consumer-defined group here (it's in
    // CompactGroups, and `description`/`tags` set `group: 'general'`), so its
    // sub-label MUST render. It must NOT be suppressed as the synthetic "no
    // group" catch-all — doing so visually merged its rows (e.g. Tags) into the
    // group above them.
    await _testsWaitForText('General');
    await _testsWaitForText('order-fulfilment');
    await _testsWaitForText('orders, batch');
    await _testsWaitForText('Yes');
    await _testsWaitForText('—');
  },
};

// `name` gains a long-form `desc` so the `?` help affordance has something to
// open — the rest of the compact fixture is unchanged.
const CompactHelpSchema: Record<string, TCompactField> = {
  ...CompactSchema,
  name: {
    ...CompactSchema.name,
    desc: 'The unique identifier for this interface. It is used in URLs, logs and cross-references, so it cannot be changed once the interface is deployed.',
  },
};

export const CompactFocusedEditingInline: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the compact form, opens the Name row for inline editing and picks "Edit fullscreen" from its More menu — the Focused Editing modal opens over that single scalar field with its long description above the editor.',
      },
    },
    chromatic: { disable: true },
  },
  args: {
    ...Compact.args,
    options: CompactHelpSchema,
  },
  play: async () => {
    // Name is a scalar, so it edits INLINE in the row (no expanded card) — the
    // branch whose More menu used to set the focused state with nothing mounted
    // to render the modal. (CompactFocusedEditing covers the card branch.)
    await _testsClickText('order-fulfilment');
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-inline .reqore-textarea');
    await _testsClickButton({ selector: '.options-readfirst-more' });
    let fsItem: Element | undefined;
    await waitFor(
      () => {
        fsItem = Array.from(document.querySelectorAll('.reqore-menu-item')).find((element) =>
          element.textContent?.includes('Edit fullscreen')
        );
        expect(fsItem).toBeTruthy();
      },
      { timeout: 10000 }
    );
    await fireEvent.click(fsItem as Element);
    // The modal mounts, carrying the field's long description with it.
    await waitFor(() => expect(document.querySelector('.reqore-modal')).toBeTruthy(), {
      timeout: 10000,
    });
    await _testsWaitForText(/unique identifier for this interface/i);
  },
};

export const CompactEditingShowsDescription: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the compact form with the descriptions toggle off — a collapsed row hides its short description, and opening the row for editing reveals it under the field name along with the `?` help affordance.',
      },
    },
  },
  args: {
    ...Compact.args,
    options: CompactHelpSchema,
  },
  play: async () => {
    // Collapsed: the global descriptions toggle is off, so no short_desc on the
    // read row (the label carries it as a title attribute only).
    await _testsWaitForText('order-fulfilment');
    await _testsWaitForTextToNotExist('Unique identifier for this interface');
    // Open it: the short description appears without the user clicking anything…
    await _testsClickText('order-fulfilment');
    await _testsWaitForInputValue('order-fulfilment', '.options-readfirst-inline .reqore-textarea');
    await _testsWaitForText('Unique identifier for this interface');
    // …and the `?` (long-form help) stays reachable while editing.
    await waitFor(() =>
      expect(
        document.querySelector('.options-readfirst-inline .options-readfirst-help')
      ).toBeTruthy()
    );
  },
};

export const CompactWithPanelProps: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the Compact fixture with `compactPanelProps` — the read-first form's outer ReqorePanel is dressed from the outside with a label, icon, intent and an extra header action. The engine's own toolbar survives: `actions` append after it and `contentStyle` merges over the engine's flex-column layout instead of replacing either.",
      },
    },
  },
  args: {
    ...Compact.args,
    compactPanelProps: {
      label: 'Connection settings',
      icon: 'Settings3Line',
      intent: 'info',
      actions: [{ label: 'Docs', icon: 'BookLine', responsive: false }],
    },
  },
  play: async () => {
    // The outside-supplied panel chrome renders…
    await _testsWaitForText('Connection settings');
    await _testsWaitForText('Docs');
    // …and the engine's own toolbar + rows are untouched by it.
    await _testsWaitForText('order-fulfilment');
  },
};

export const CompactReadOnly: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Compact fixture with readOnly enabled — the Draft/Ready progress badge is hidden and rows open in view (non-editable) mode.',
      },
    },
    chromatic: { disable: true },
  },
  args: {
    ...Compact.args,
    readOnly: true,
  },
  play: async () => {
    await _testsWaitForText('order-fulfilment');
    // Read-only hides the Draft/Ready badge (the meter itself stays)…
    await _testsWaitForTextToNotExist('Draft');
    // …and rows open in view mode: the card's done (✓/close) button collapses
    // back. The button is icon-only now, so assert it by class, not text.
    await _testsClickText('order-fulfilment');
    await waitFor(() => expect(document.querySelector('.options-readfirst-done')).toBeTruthy());
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await waitFor(() => expect(document.querySelector('.options-readfirst-done')).toBeNull());
  },
};

export const CompactEmpty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Compact fixture with no value — all six empty fields render a dash placeholder and the four optional fields sit in the collapsed Optional box.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: {},
    groups: CompactGroups,
  },
  play: async () => {
    // The four empty OPTIONAL fields live in the (collapsed) Optional box — open
    // it so all six empty fields are on screen.
    await _expandOptionalBox();
    // Both required fields read as unset; the four optional ones as "Not set".
    // All six empty fields read as a calm dash (the red asterisk marks required).
    await _testsWaitForTextsCount('—', undefined, 6);
  },
};

// Compact mode on the EXACT shared fixture behind `Basic` — every option and
// state the classic layout exercises.
export const CompactBasic: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders FormEngine in compact mode over the full Basic fixture — every value renders in its read-first form (templates by name, colours as hex, hashes as field-count summaries), disabled and dependency-locked rows stay non-interactive, and the dependency lock's popover navigates to blockers.",
      },
    },
    chromatic: { disable: true },
  },
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
    // Several asserted/clicked fields (Disabled option, …) are empty optionals in
    // the collapsed Optional box — open it so they're on screen.
    await _expandOptionalBox();
    // Values resolve in read-first rows: a template shows its display name (from
    // the supplied templates list), colour as hex, hash as a field-count summary.
    await _testsWaitForText('Test (local)');
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
    // userEvent (real pointer sequence) keeps the dropdown popover open —
    // fireEvent's synthetic click opened it then immediately closed it via the
    // outside-click handler in the Vitest browser. Wait for the menu ITEM, not
    // just the "Unlocked by:" divider, before clicking it.
    await userEvent.click(depLock);
    await _testsWaitForText('Unlocked by:');
    let depEntry: HTMLElement | undefined;
    await waitFor(() => {
      depEntry = Array.from(document.querySelectorAll('.reqore-menu-item')).find((element) =>
        element.textContent?.includes('basicOption')
      ) as HTMLElement;
      expect(depEntry).toBeTruthy();
    });
    await userEvent.click(depEntry as HTMLElement);
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

// Read-only richtext + template picker. Opening a field in a read-only form
// must not yield an editable surface: a richtext value renders as a NON-editable
// rich-text view (formatted content, contenteditable=false, no toolbar), and a
// field whose value is a template ($local:…) as a read-only template-picker chip
// ($-token + resolved name). Regression cover for the review note "this should
// show as a readonly richtext or a readonly template picker".
export const CompactReadOnlyRichText: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the CompactBasic fixture with readOnly enabled — opening the Rich Text row shows a non-editable Slate surface, and the Template row renders as a read-only template-picker chip showing the resolved template name (never the raw $local reference).',
      },
    },
    chromatic: { disable: true },
  },
  args: {
    ...CompactBasic.args,
    readOnly: true,
    expandMode: 'multi' as const,
  },
  play: async () => {
    await _testsWaitForText('Rich Text option');

    // Read-only rows open in view mode (not edit mode). The richtext field's
    // Slate surface must be non-editable — the bug was it stayed
    // contenteditable="true", so a read-only form was fully editable.
    await _testsClickText('Rich Text option');
    await waitFor(
      () => {
        const editable = document.querySelector(
          '.options-readfirst-card[data-field="richTextOption"] [contenteditable]'
        );
        expect(editable).toBeTruthy();
        expect(editable?.getAttribute('contenteditable')).toBe('false');
      },
      { timeout: 10000 }
    );

    // A template-valued field renders the read-only template-picker chip — a
    // $-token tag with the resolved name — never an editable input.
    await _testsClickText('Template option');
    await waitFor(
      () => {
        const card = document.querySelector('.options-readfirst-card[data-field="templateOption"]');
        expect(card).toBeTruthy();
        const tag = card?.querySelector('.reqore-tag');
        expect(tag).toBeTruthy();
        // The chip resolves the catalogue display name ('$local:test' →
        // 'Test (local)') — the whole point of the read-only picker. The raw
        // value is tooltip-only (portalled, not in the tag), so the visible
        // label must be the resolved name, never the raw reference.
        expect(tag?.textContent).toContain('Test (local)');
        expect(tag?.textContent).not.toContain('$local:test');
        expect(card?.querySelector('input, textarea, [contenteditable="true"]')).toBeFalsy();
      },
      { timeout: 10000 }
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders CompactBasic with an extra orderState hash option holding a raw payload — the hash row uses the StructuredDataView tree renderer with type-aware value cells; clicking a value chip opens the hash editor.',
      },
    },
  },
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
        expect(
          document.querySelector('.options-readfirst-card[data-field="orderState"]')
        ).toBeTruthy(),
      { timeout: 10000 }
    );

    // Close the editor (Done); the hash row re-mounts read-first with its
    // "Show more" fade reset to collapsed. Press it so the play ends on the
    // FULLY-REVEALED structured tree — Chromatic snapshots that terminal state,
    // so the story's hero shot shows the structured view, not the editor it
    // briefly opened, nor the clipped/faded preview.
    await fireEvent.click(
      document.querySelector(
        '.options-readfirst-card[data-field="orderState"] .options-readfirst-done'
      ) as HTMLElement
    );
    // The reveal button is measure-gated (appears once the tree overflows 96px),
    // so wait for it before clicking.
    await waitFor(
      () =>
        expect(
          document.querySelector('[data-field="orderState"] .options-readfirst-viewmore')
        ).toBeInTheDocument(),
      { timeout: 10000 }
    );
    await fireEvent.click(
      document.querySelector('[data-field="orderState"] .options-readfirst-viewmore') as HTMLElement
    );
    await _testsWaitForText('Show less'); // fade expanded → full tree on screen

    // The hash sits low in the (tall) Basic form, so frame it: scroll the open
    // structured value into view so Chromatic's snapshot lands on the expanded
    // tree, not the top of the form.
    document.querySelector('[data-field="orderState"]')?.scrollIntoView({ block: 'center' });
  },
};

// batched commit mode (Nick's save-model decision, 2026-06-10)
// Edits stage as a draft: changed rows get a Draft chip, the sticky header
// grows a Save/Discard bar, Save emits `onCommit` (gated on validity), and
// every staged edit still emits `onChange` flagged `meta.draft`.
export const CompactBatchedCommit: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders a valid form in commitMode='batched'. Staging an edit adds the Draft chip and 'unsaved changes' bar without committing; Save fires onCommit and clears the chips; Discard reverts the staged edit.",
      },
    },
    chromatic: { disable: true },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders an invalid form in commitMode='batched' — staging an edit shows the unsaved-changes bar but Save is disabled and onCommit never fires.",
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with a sensitive: true API-token field — the read row masks the value (and its hover title) and the edit input renders as type=password.',
      },
    },
  },
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
    await waitFor(() => expect(document.querySelector('.options-readfirst-inline')).toBeTruthy(), {
      timeout: 10000,
    });
    await _testsWaitForTextToNotExist('super-secret-token', ':not(textarea)');

    // Close the editor so the story's hero shot is the MASKED read row — not the
    // open editor, whose textarea necessarily shows the secret in the clear (the
    // one state where a "sensitive" story would leak it into a Chromatic snap).
    await fireEvent.click(document.querySelector('.options-readfirst-done') as HTMLElement);
    await _testsWaitForText('••••••'); // back to the masked read row
    await _testsWaitForTextToNotExist('super-secret-token'); // …and nothing holds the secret now
  },
};

// `rules: ['valid_identifier']` flows from the schema into validation: a bad
// identifier marks the form invalid (banner + Draft badge).
export const CompactValidIdentifierRule: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with an option that carries a valid-identifier validation rule — invalid input surfaces the identifier-format error inline.',
      },
    },
  },
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
    // The rules-driven validation marks the form as needing attention — the
    // dedicated "Needs attention" box (and the header link) signal it.
    await _testsWaitForText('Draft');
    await _testsWaitForText('Needs attention');
  },
};

// Operators (filter/mapper-style forms): the `operators` prop renders the
// operator selector + the WHERE/IS summary in the card editor.
export const CompactOperators: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with per-option operator support — each row shows the operator select alongside the value and the WHERE/IS summary tags.',
      },
    },
  },
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

    // Single clear: a single-value card hides the editor's own input ✕ (it has
    // no Reqore prop, so the card marks itself `-single` and CSS hides it) and
    // shows the card-action Clear between Fullscreen and Done instead.
    const card = document.querySelector(
      '.options-readfirst-card[data-field="status"]'
    ) as HTMLElement;
    await expect(card.className).toContain('options-readfirst-card-single');
    await expect(card.querySelector('.options-readfirst-clear')).toBeInTheDocument();
    const builtInClear = card.querySelector('.reqore-clear-input-button') as HTMLElement | null;
    if (builtInClear) {
      await expect(getComputedStyle(builtInClear).display).toBe('none');
    }
  },
};

// focusedEditing in compact: the card's fullscreen affordance opens the same
// focused-editing modal the classic layout has, with the field's descriptions.
export const CompactFocusedEditing: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the compact form, opens a row and switches to focused-editing mode — the row expands into a modal-style editing surface.',
      },
    },
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
    await _testsWaitForText('Tags');
    // `tags` is a list → card editor with the fullscreen button.
    await _testsClickText('Tags');
    await waitFor(() => expect(document.querySelector('.options-readfirst-card')).toBeTruthy(), {
      timeout: 10000,
    });
    // Fullscreen now lives in the card's "More" (⋮) menu, before the Done ✓.
    await _testsClickButton({ selector: '.options-readfirst-more' });
    let fsItem: Element | undefined;
    await waitFor(
      () => {
        fsItem = Array.from(document.querySelectorAll('.reqore-menu-item')).find((element) =>
          element.textContent?.includes('Edit fullscreen')
        );
        expect(fsItem).toBeTruthy();
      },
      { timeout: 10000 }
    );
    await fireEvent.click(fsItem as Element);
    await waitFor(() => expect(document.querySelector('.reqore-modal')).toBeTruthy(), {
      timeout: 10000,
    });
  },
};

// Multi-select editing: a list with element_allowed_values opens the real
// multi-select editor in the card.
export const CompactMultiSelectEditing: Story = {
  // chromatic off: ends with an open multi-select editor card (live editor state).
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with a multi-select option — editing the row exposes the chip picker and multiple values can be added and removed.',
      },
    },
    chromatic: { disable: true },
  },
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
    // Read row joins the selected items, labelled the way the picker labels
    // them (`Orders`) rather than the way they are stored (`orders`).
    await _testsWaitForText('Orders');
    await _testsClickText('Orders');
    await waitFor(() => expect(document.querySelector('.options-readfirst-card')).toBeTruthy(), {
      timeout: 10000,
    });
    // The real multi-select editor mounts with the selection.
    await _testsWaitForText('Orders');
  },
};

// Field-level `sort` orders compact rows (schema declared out of order).
export const CompactSortOrder: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form whose options carry sort ordinals — the rows render in sort order rather than schema-declaration order.',
      },
    },
    chromatic: { disable: true },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      third: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Third',
        sort: 3,
        preselected: true,
      },
      first: {
        type: 'string',
        ui_type: 'string',
        display_name: 'First',
        sort: 1,
        preselected: true,
      },
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
    // All three fields are empty + optional, so they sit in the (collapsed)
    // Optional box — open it to read their order.
    await _expandOptionalBox();
    await _testsWaitForText('First');
    const order = Array.from(document.querySelectorAll('.readfirst-row[data-field]')).map(
      (element) => element.getAttribute('data-field')
    );
    await expect(order).toEqual(['first', 'second', 'third']);
  },
};

export const CompactReadFirstEditing: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the compact form and opens a row for editing — the row transitions from the read-first summary to the inline or card editor.',
      },
    },
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
    await _testsWaitForText('—');
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

// Following a field across panels: filling an empty optional field moves it from
// the Optional box to Set, and the engine scrolls to + flashes its new row so it's
// easy to keep track of. The flash is the observable signal that the panel-change
// locate fired (the scroll itself, scrollIntoView, isn't assertable in the runner).
export const CompactPanelChangeScroll: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders a compact form inside a scrollable panel — opening a row keeps the panel's scroll position pinned rather than jumping to the top.",
      },
    },
    chromatic: { disable: true },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      req: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Req',
        required: true,
        preselected: true,
      },
      opt: { type: 'string', ui_type: 'string', display_name: 'Opt', preselected: true },
    } as IOptionsSchema,
    value: {} as IOptions,
  },
  play: async () => {
    await _testsWaitForText('Req');
    // 'opt' is an empty optional → the (collapsed) Optional box. Open it, fill the
    // field, collapse — it jumps to Set.
    await _expandOptionalBox();
    await _testsClickText('Opt');
    await _testsChangeStringField({
      selector: '.options-readfirst-inline .reqore-textarea',
      value: 'hello',
    });
    await sleep(300);
    await _testsClickButton({ selector: '.options-readfirst-done' });
    // It now lives in the Set box…
    await waitFor(
      () =>
        expect(
          document
            .querySelector('.readfirst-row[data-field="opt"]')
            ?.closest('.options-readfirst-group')
            ?.querySelector('.reqore-panel-title')?.textContent
        ).toContain('Set'),
      { timeout: 5000 }
    );
    // …and flashed, signalling the engine located/scrolled to its new panel.
    await waitFor(
      () =>
        expect(document.querySelector('.readfirst-row[data-field="opt"]')?.className).toContain(
          'readfirst-row-flash'
        ),
      { timeout: 4000 }
    );
  },
};

export const CompactRequiredOnlyAndSearch: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with the required-only filter and the search input enabled — filtering by requirement and typing a query narrows the visible rows.',
      },
    },
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
    docs: {
      description: {
        story:
          'Renders a compact form and opens the Fields menu — the menu exposes show-types, show-descriptions and required-only toggles.',
      },
    },
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
    // 'Notes' is optional + unset → it lives (collapsed) in the Optional box, so
    // it isn't in the DOM yet.
    await _testsWaitForTextToNotExist('Notes');

    // "Select all" adds every optional field. Reveal the (collapsed) Optional box
    // — Notes is now an ADDED row (the normal variant, not the hidden/addable one).
    await clickFieldsMenuItem('Select all');
    await _expandOptionalBox();
    await _testsWaitForText('Notes');
    await waitFor(() =>
      expect(
        document.querySelector('.readfirst-row[data-field="notes"]:not(.readfirst-row-hidden)')
      ).toBeTruthy()
    );

    // "Default fields" drops the user-added optional fields — Notes reverts to a
    // HIDDEN (addable) row in the still-open Optional box (it's always browsable
    // now, just not added).
    await clickFieldsMenuItem('Default fields');
    await waitFor(() =>
      expect(document.querySelector('.readfirst-row-hidden[data-field="notes"]')).toBeTruthy()
    );

    // The delete affordance now lives in the expanded editor's "More" (⋮) menu:
    // re-add Notes, open it, then Remove field via More → the confirm modal →
    // Confirm.
    await clickFieldsMenuItem('Select all');
    await _testsWaitForText('Notes');
    await _testsClickText('Notes');
    // Only Notes is expanded, so the single More (⋮) menu in the DOM is its own.
    // (ReqoreDropdown's trigger isn't a DOM descendant of the row, so don't scope
    // the selector to [data-field].)
    await waitFor(() => expect(document.querySelector('.options-readfirst-more')).toBeTruthy(), {
      timeout: 10000,
    });
    await _testsClickButton({ selector: '.options-readfirst-more' });
    let removeItem: Element | undefined;
    await waitFor(
      () => {
        removeItem = Array.from(document.querySelectorAll('.reqore-menu-item')).find((element) =>
          element.textContent?.includes('Remove field')
        );
        expect(removeItem).toBeTruthy();
      },
      { timeout: 10000 }
    );
    await fireEvent.click(removeItem as Element);
    await _testsClickButton({ label: 'Confirm' });
    // Removing the field reverts it to a HIDDEN (addable) row in the still-open
    // Optional box (it's always browsable now, just no longer added) — and its
    // editor closes.
    await waitFor(() =>
      expect(document.querySelector('.readfirst-row-hidden[data-field="notes"]')).toBeTruthy()
    );
  },
};

// Toolbar ⓘ: a global toggle that reveals every field's short_desc at once,
// without opening each row's info panel by hand.
export const CompactDescriptionsToggle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form and toggles show-descriptions from the Fields menu — every row picks up its short_desc / desc text under the label.',
      },
    },
    chromatic: { disable: true },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: {
      host: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Host',
        short_desc: 'The server hostname or IP address',
        preselected: true,
      },
      port: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Port',
        short_desc: 'TCP port to connect on',
        preselected: true,
      },
    } as IOptionsSchema,
    value: {
      host: { type: 'string', value: 'db.local' },
      port: { type: 'string', value: '5432' },
    } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('Host');
    // Descriptions are hidden until the toolbar ⓘ is toggled on.
    await _testsWaitForTextToNotExist('The server hostname or IP address');
    await _testsClickButton({ selector: '.options-readfirst-descriptions' });
    // One toggle reveals the short_desc on every field that has one.
    await _testsWaitForText('The server hostname or IP address');
    await _testsWaitForText('TCP port to connect on');

    // Regression: opening a field for INLINE editing must keep its description
    // visible while the global toggle is on — it used to vanish because the
    // inline editor's label dropped the short_desc.
    await _testsClickText('Host');
    await waitFor(
      () =>
        expect(
          document.querySelector(
            '.readfirst-row-editing[data-field="host"] .options-readfirst-label-desc'
          )
        ).toBeTruthy(),
      { timeout: 10000 }
    );
    await _testsWaitForText('The server hostname or IP address');
    // Collapse back to the read row (Done) before toggling descriptions off.
    await _testsClickButton({ selector: '[data-field="host"] .options-readfirst-done' });
    await waitFor(
      () => expect(document.querySelector('.readfirst-row-editing[data-field="host"]')).toBeFalsy(),
      { timeout: 10000 }
    );

    // Toggling off hides them again.
    await _testsClickButton({ selector: '.options-readfirst-descriptions' });
    await _testsWaitForTextToNotExist('The server hostname or IP address');
  },
};

export const CompactSearchHidden: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with searchHidden set — the search input and header search action are hidden from the toolbar.',
      },
    },
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
    await waitFor(() =>
      expect(document.querySelector('.readfirst-row-hidden[data-field="notes"]')).toBeTruthy()
    );

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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with a list-of-YAML option — the row summary shows the item count and opening the row exposes the YAML editor.',
      },
    },
    chromatic: { disable: true },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form tall enough to scroll — the group headers stick to the top of the panel as the form scrolls under them.',
      },
    },
    chromatic: { disable: true },
  },
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
    // The engine owns its scroll body (`.options-readfirst-scroll`, an unpadded
    // box), so it — not the bounding host div — is what scrolls; the sticky
    // toolbar pins flush to its top.
    const scroller = document.querySelector('.options-readfirst-scroll') as HTMLElement;
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => {
      expect(scroller.scrollTop).toBeGreaterThan(0);
      const search = document.querySelector('input[placeholder="Filter fields..."]') as HTMLElement;
      const scrollerTop = scroller.getBoundingClientRect().top;
      expect(search.getBoundingClientRect().top).toBeGreaterThanOrEqual(scrollerTop - 1);
      expect(search.getBoundingClientRect().top).toBeLessThan(scrollerTop + 150);
    });
  },
};

// on_change/refetch + has_dependents flow through the same handleValueChange
// as classic — the read-first editor must fire and reset the same way.
export const CompactOnChangeAndDependents: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with dependency chains — editing a parent option resets its dependents and the dependent rows re-render in their fresh state.',
      },
    },
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
    docs: {
      description: {
        story:
          'Renders a compact form and exercises the per-row revert action alongside the show-types Fields menu toggle.',
      },
    },
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
  special: { label: 'Any & special', sort: 5 },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with an expression-supporting option — the row opens the ExpressionField shell with the Visual builder and the Visual/Text mode toggle.',
      },
    },
    chromatic: { disable: true },
  },
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
      // Read-first: the offline DPQL summary of the AST — the literals read as
      // the text they are, and the template reference reads as a chip rather
      // than as its raw `$local:name` token inside the string.
      await waitFor(() => {
        const chip = Array.from(document.querySelectorAll('.reqore-tag')).find((tag) =>
          tag.textContent?.includes('$local:name')
        );
        expect(chip, 'the reference in the summary renders as a chip').toBeTruthy();
      });
      await _testsWaitForText('" == "John"');

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

      // The "Parsed" line is the single live rendering of the AST (over the
      // mock dpql/renderExpression) — it reflects the seeded expression. The
      // separate Text-mode "Explain" button was dropped; Parsed is canonical.
      await waitFor(
        () =>
          expect(
            document.querySelector(
              '.options-readfirst-card[data-field="condition"] [data-testid="expression-preview"]'
            )?.textContent
          ).toContain('John'),
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

const assertFixedChoiceCanCloseWithoutClearing = async (field: string, expectedLabel: string) => {
  const cardSelector = `.options-readfirst-card[data-field="${field}"]`;
  const rowSelector = `.readfirst-row[data-field="${field}"]`;

  let card: HTMLElement | null = null;
  await waitFor(
    () => {
      card = document.querySelector(cardSelector);
      expect(card).toBeTruthy();
    },
    { timeout: 10000 }
  );

  const clearButton = card!.querySelector(
    '.options-readfirst-clear[aria-label="Clear value"]'
  ) as HTMLElement;
  const closeButton = card!.querySelector(
    '.options-readfirst-done[aria-label="Close field"]'
  ) as HTMLElement;
  await expect(clearButton).toBeInTheDocument();
  await expect(closeButton).toBeInTheDocument();
  // Clear is destructive and visually distinct from the adjacent passive
  // actions. It must not mutate the value until the Reqore confirmation is
  // accepted; cancelling keeps both the value and expanded editor intact.
  await expect(getComputedStyle(clearButton).color).not.toBe(getComputedStyle(closeButton).color);
  await fireEvent.click(clearButton);
  await waitFor(() => expect(document.querySelector('.reqore-confirmation-modal')).toBeTruthy(), {
    timeout: 10000,
  });
  await expect(document.querySelector('.reqore-confirmation-modal')?.textContent).toContain(
    'Clear value'
  );
  await _testsClickButton({ label: 'Cancel' });
  await waitFor(() => expect(document.querySelector('.reqore-confirmation-modal')).toBeNull());
  await expect(document.querySelector(cardSelector)).toBeTruthy();

  await fireEvent.click(closeButton);
  await waitFor(() => expect(document.querySelector(cardSelector)).toBeNull(), {
    timeout: 10000,
  });

  const row = document.querySelector(rowSelector) as HTMLElement;
  expect(row?.textContent).toContain(expectedLabel);

  // Re-open so the story's visual snapshot still covers the expanded fixed-choice card.
  await fireEvent.click(row);
  await waitFor(() => expect(document.querySelector(cardSelector)).toBeTruthy(), {
    timeout: 10000,
  });
};

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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with an enum option whose allowed values carry images — the read row shows the image alongside the label and the picker mounts the images in the collection.',
      },
    },
    chromatic: { disable: true },
  },
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
    await fireEvent.click(
      document.querySelector('.readfirst-row[data-field="lang"]') as HTMLElement
    );
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
    await assertFixedChoiceCanCloseWithoutClearing('lang', 'Qore');
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with an enum option whose value is a richtext template — the read row shows the resolved template chip rather than the raw reference.',
      },
    },
    chromatic: { disable: true },
  },
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
          {
            display_name: 'Qore',
            value: { type: 'richtext', value: 'qore' },
            image: langImg('#c0007a', 'Q'),
          },
          {
            display_name: 'Python',
            value: { type: 'richtext', value: 'python' },
            image: langImg('#3776ab', 'P'),
          },
          {
            display_name: 'Java',
            value: { type: 'richtext', value: 'java' },
            image: langImg('#e76f00', 'J'),
          },
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
    await fireEvent.click(
      document.querySelector('.readfirst-row[data-field="lang"]') as HTMLElement
    );
    await waitFor(
      () => {
        const card = document.querySelector('.options-readfirst-card[data-field="lang"]');
        expect(card?.textContent).toContain('Python');
        expect(card?.textContent).toContain('Java');
        expect(card?.querySelectorAll('.reqore-checkbox').length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );
    await assertFixedChoiceCanCloseWithoutClearing('lang', 'Qore');
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders a compact form with expandMode='single' — opening one row automatically collapses whichever row was open before.",
      },
    },
    chromatic: { disable: true },
  },
  args: { name: 'expandSingle', compact: true, ...expandModeFixture },
  play: async () => {
    await waitFor(
      () => expect(document.querySelector('.readfirst-row[data-field="beta"]')).toBeTruthy(),
      { timeout: 10000 }
    );
    await fireEvent.click(
      document.querySelector('.readfirst-row[data-field="alpha"]') as HTMLElement
    );
    await waitFor(() => expect(_isRowOpen('alpha')).toBe(true), { timeout: 10000 });
    await fireEvent.click(
      document.querySelector('.readfirst-row[data-field="beta"]') as HTMLElement
    );
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders a compact form with expandMode='multi' — every opened row stays open until it is explicitly done, so several editors can be on screen at once.",
      },
    },
    chromatic: { disable: true },
  },
  args: { name: 'expandMulti', compact: true, expandMode: 'multi', ...expandModeFixture },
  play: async () => {
    await waitFor(
      () => expect(document.querySelector('.readfirst-row[data-field="beta"]')).toBeTruthy(),
      { timeout: 10000 }
    );
    await fireEvent.click(
      document.querySelector('.readfirst-row[data-field="alpha"]') as HTMLElement
    );
    await waitFor(() => expect(_isRowOpen('alpha')).toBe(true), { timeout: 10000 });
    await fireEvent.click(
      document.querySelector('.readfirst-row[data-field="beta"]') as HTMLElement
    );
    await waitFor(
      () => {
        expect(_isRowOpen('beta')).toBe(true);
        expect(_isRowOpen('alpha')).toBe(true); // stays open
      },
      { timeout: 10000 }
    );
  },
};

// A stand-in for a host-injected editor. Qorus-domain types (interface
// selectors, the data-provider browser, …) have no toolkit editor — the IDE
// maps them to its own components via `componentOverrides`. The toolkit
// Storybook has no Qorus backend, so this plain input stands in to demonstrate
// the seam end-to-end rather than faking each domain editor.
const HostProvidedEditor = ({
  value,
  onChange,
  size,
}: {
  value?: unknown;
  onChange?: (value: string) => void;
  size?: TSizes;
}) => (
  <ReqoreInput
    fluid
    size={size}
    icon='PlugLine'
    placeholder='Host-provided editor (injected via componentOverrides)'
    value={typeof value === 'string' ? value : ''}
    onChange={(event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value)}
  />
);

export const CompactFieldTypes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form that exercises the full catalogue of ui_type renderers — every type (string, richtext, hash, list, file, colour, byte-size, cron, connection, enum, etc.) is present with a representative value.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    groups: FieldTypeCatalogGroups,
    // The host supplies editors for Qorus-domain types it doesn't ship; the
    // toolkit renders the rest natively. (Demonstrated here for `mapper` and
    // `data-provider` — see HostProvidedEditor.)
    componentOverrides: { mapper: HostProvidedEditor, 'data-provider': HostProvidedEditor },
    options: {
      // Text & string
      text: { type: 'string', ui_type: 'string', display_name: 'String', group: 'text' },
      longText: {
        type: 'string',
        ui_type: 'long-string',
        display_name: 'Long string',
        group: 'text',
      },
      markdownText: {
        type: 'string',
        ui_type: 'markdown',
        display_name: 'Markdown',
        group: 'text',
      },
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
      payload: { type: 'binary', ui_type: 'binary', display_name: 'Binary', group: 'text' },
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
      // The list counterpart of `connectionInfo`: a list of hashes whose fields
      // are declared. This is the shape the schema preview was built for, and the
      // catalogue was missing it — it covered the described HASH but not the
      // described LIST, which is the case that was actually reported.
      routes: {
        type: 'list',
        ui_type: 'list',
        element_type: 'hash',
        display_name: 'List of hashes (arg_schema)',
        group: 'structured',
        arg_schema: {
          method: {
            type: 'string',
            display_name: 'Method',
            allowed_values: [
              { value: 'get', display_name: 'GET' },
              { value: 'post', display_name: 'POST' },
            ],
          },
          path: { type: 'string', display_name: 'Path' },
          handler: { type: 'string', ui_type: 'code-editor', display_name: 'Handler' },
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
      // Any & special
      dynamic: { type: 'any', ui_type: 'any', display_name: 'Any', group: 'special' },
      detected: { type: 'auto', ui_type: 'auto', display_name: 'Auto', group: 'special' },
      // Qorus-domain type with no toolkit editor — rendered by the host via
      // componentOverrides (see this story's args), one representative.
      provider: {
        type: 'data-provider',
        ui_type: 'data-provider',
        display_name: 'Data provider',
        group: 'special',
      },
      // Interface references: host-injected selectors via componentOverrides.
      // One representative — the other 17 (workflow/service/job/…) render
      // identically, so the showcase no longer repeats them.
      mapperRef: { type: 'mapper', ui_type: 'mapper', display_name: 'Mapper', group: 'interface' },
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
        display_name: 'short_desc (ⓘ under name + hover title)',
        short_desc: 'A one-line summary shown under the field name and in the hover title.',
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
        short_desc: 'Summary line shown under the name.',
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
      richText: {
        type: 'richtext',
        value: [{ type: 'paragraph', children: [{ text: 'rich note' }] }],
      },
      template: { type: 'string', value: '$config:billing_url' },
      schedule: { type: 'string', value: '0 0 * * *' },
      when: { type: 'date', value: '2026-06-09' },
      endpoint: { type: 'string', value: 'https://example.com/webhook' },
      payload: { type: 'binary', value: 'DEADBEEF' },
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
      config: { type: 'hash', value: { region: 'eu', tier: 'gold' } },
      connectionInfo: {
        type: 'hash',
        value: {
          host: { type: 'string', value: 'db.local' },
          port: { type: 'int', value: 5432 },
          secure: { type: 'bool', value: true },
        },
      },
      routes: {
        type: 'list',
        value: [
          // One item complete, one with the optional field unset — the empty
          // state stays exercised rather than being filled in everywhere.
          {
            type: 'hash',
            value: {
              method: 'get',
              path: '/orders',
              handler: 'sub get_orders() {\n    return orders.all();\n}',
            },
          },
          { type: 'hash', value: { method: 'post', path: '/orders' } },
        ],
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
      // Any & special
      dynamic: { type: 'any', value: 'auto-detected' },
      detected: { type: 'auto', value: 7 },
      provider: { type: 'data-provider', value: 'factory/db-connection' },
      // Interface references (one representative; host-injected via overrides)
      mapperRef: { type: 'mapper', value: 'order-to-invoice' },
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
    } as unknown as IOptions,
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
    // multi-select joined, labelled the way the picker labels them
    await _testsWaitForText('Orders, Batch');
    await _testsWaitForText('a, b'); // list joined
    await _testsWaitForText('x, y, z'); // YAML-serialized list summarised
    await _testsWaitForText('#0000FF'); // colour → uppercase hex
    await _testsWaitForText('rgba(255, 0, 0, 0.5)'); // colour with alpha → rgba()
    await _testsWaitForText('config.txt'); // file → filename
    // A hash the schema DESCRIBES needs no count: its preview names every field,
    // so "3 fields" above "Host / Port / Secure" would be the same fact twice.
    // A hash it does not describe keeps the count — the untyped tree beneath it
    // says nothing about what the value means, so the count is the only line
    // that does. Both halves asserted here: the distinction IS the behaviour.
    await _testsWaitForText('2 fields'); // undescribed hash → field count summary
    await _testsWaitForText('Host'); // described hash → its fields, by name
    await _testsWaitForTextToNotExist('3 fields');

    // Described LIST of hashes: numbered items, labels by display_name, and the
    // allowed value read back as its label rather than the stored `get`.
    await _testsWaitForText('Path');
    await _testsWaitForText('/orders');
    await _testsWaitForText('GET');
    // A code sub-field renders AS code, not as a flattened mono line.
    await _testsWaitForText('Handler');
    await _testsWaitForText(/sub get_orders/);
    await _testsWaitForText('order-to-invoice'); // interface reference → raw value

    // Field stack (merged from dpql): byte-size shows its value string; the
    // schema-definition summarises as the schema name (+ table count) rather
    // than a raw hash key-count.
    await _testsWaitForText('512MiB');
    await _testsWaitForText(/example_customer_addresses/);
    // Expression field → read-first shows the offline DPQL summary of the AST,
    // with the template reference inside it chipped rather than printed raw.
    await waitFor(() => {
      const chip = Array.from(document.querySelectorAll('.reqore-tag')).find((tag) =>
        tag.textContent?.includes('$local:name')
      );
      expect(chip, 'the reference in the summary renders as a chip').toBeTruthy();
    });
    await _testsWaitForText('" == "John"');
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
      // Intent stripe = the value surface's left border, fed by --readfirst-stripe.
      expect(intentRow?.style?.getPropertyValue('--readfirst-stripe')).toBeTruthy();
    });
    await _testsWaitForText('••••••');
    await _testsWaitForTextToNotExist('hunter2-token');

    // Descriptions & messages: Tier-1 messages auto-open the row's info panel
    // (visible without interaction); Tier-2 messages wait behind the ⓘ toggle,
    // and a field's short_desc renders UNDER the name when toggled. NB: opening a
    // message panel rebuilds the row's DOM (the info-row wrapper appears) — query
    // fresh nodes per click.
    await _testsWaitForText('This value fails validation upstream.');
    await _testsWaitForText('Deprecated — migrate before 2026-09.');
    // Dedicated schema messages render as panels, visible WITHOUT interaction
    // (the per-row ⓘ is gone — descriptions are revealed by the global toggle or
    // by expanding the field).
    await _testsWaitForText('Requests are signed automatically.');
    await _testsWaitForText('Connection verified.');
    // The global descriptions toggle reveals each field's short_desc under its name.
    await fireEvent.click(document.querySelector('.options-readfirst-descriptions') as HTMLElement);
    await _testsWaitForText(
      'A one-line summary shown under the field name and in the hover title.'
    );
    // A field with a long desc still exposes the ? help affordance.
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
      // An arg_schema field opens a NESTED compact sub-form (recursive compact);
      // its rows live inside the parent's edit card — don't count those as
      // top-level read rows to expand.
    ).filter((r) => !r.closest('.options-readfirst-card'));
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
  // rows + cards) covers the trimmed catalog (~49 fields).
  await expect(readRows()).toHaveLength(0);
  const editors =
    document.querySelectorAll('.options-readfirst-inline').length +
    document.querySelectorAll('.options-readfirst-card').length;
  await expect(editors).toBeGreaterThan(40);
};

export const CompactFieldTypesEditing: Story = {
  // chromatic off: every catalog editor mounts live (async) — flaky and snapshot-heavy.
  parameters: {
    docs: {
      description: {
        story:
          'Renders CompactFieldTypes and opens every row — the edit surface for each ui_type mounts and the row-level Clear / built-in clear affordances are wired per input.',
      },
    },
    chromatic: { disable: true },
  },
  // multi: this story expands every row at once (single-open would collapse them).
  args: { ...CompactFieldTypes.args, expandMode: 'multi' as const },
  play: async () => {
    await _testsWaitForText('hello');
    await _compactExpandAllRows();

    // Clear-value affordance. Editors WITHOUT a built-in clear (toggles,
    // fixed-choice pickers) get the row-level Clear button; text/number inputs
    // keep ReqoreInput's own clear instead — so a row never shows two. Clearing
    // empties the value, which trips `changed`, so Clear gives way to Revert in
    // the same slot.
    const editRow = (field: string) =>
      document.querySelector(`[data-field="${field}"].readfirst-row-editing`)!;

    // A text input relies on its own built-in clear, and must NOT also show ours.
    await expect(editRow('text').querySelectorAll('.reqore-clear-input-button')).toHaveLength(1);
    await expect(editRow('text').querySelectorAll('.options-readfirst-clear')).toHaveLength(0);

    // The boolean (value: true) has no built-in clear, so the row-level Clear is
    // the only one — and there is no Revert yet (value matches the original).
    await expect(editRow('enabled').querySelectorAll('.reqore-clear-input-button')).toHaveLength(0);
    await expect(editRow('enabled').querySelector('.options-readfirst-clear')).toBeInTheDocument();
    await expect(
      editRow('enabled').querySelector('.options-readfirst-revert')
    ).not.toBeInTheDocument();

    // Clear is destructive: cancelling its Reqore confirmation leaves the
    // value untouched, while confirming empties it and swaps Clear for Revert.
    await fireEvent.click(editRow('enabled').querySelector('.options-readfirst-clear')!);
    await waitFor(() => expect(document.querySelector('.reqore-confirmation-modal')).toBeTruthy(), {
      timeout: 10000,
    });
    await _testsClickButton({ label: 'Cancel' });
    await waitFor(() => expect(document.querySelector('.reqore-confirmation-modal')).toBeNull());
    await expect(editRow('enabled').querySelector('.options-readfirst-clear')).toBeInTheDocument();

    await fireEvent.click(editRow('enabled').querySelector('.options-readfirst-clear')!);
    let confirmationModal: HTMLElement | null = null;
    await waitFor(
      () => {
        confirmationModal = document.querySelector('.reqore-confirmation-modal');
        expect(confirmationModal).toBeTruthy();
      },
      { timeout: 10000 }
    );
    await userEvent.click(within(confirmationModal!).getByRole('button', { name: 'Clear value' }));
    await waitFor(() => {
      expect(editRow('enabled').querySelector('.options-readfirst-clear')).not.toBeInTheDocument();
      // Clear swaps for the undo affordance. In an OPEN field that is
      // "Cancel edit" — the field was opened holding its form-load value, so
      // undoing this edit and reverting the field are the same thing and only
      // one button is offered. The form-load revert reappears here only when
      // the field was already modified before it was opened.
      expect(editRow('enabled').querySelector('.options-readfirst-cancel')).toBeInTheDocument();
    });
  },
};

// required_groups linkage: every member shows a PERSISTENT chip — amber "One of"
// while unmet (tap-popover → scroll + flash siblings, hover highlights), flipping
// to a muted-green "Covers" / "Covered by <X>" once satisfied. Members live in
// DIFFERENT panels to prove cross-panel linkage.
export const CompactRequiredGroups: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders a compact form whose options belong to required_groups — the group's one-of-required indicator appears in the row rail and clears once any member is filled.",
      },
    },
  },
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
    // All three members show the required placeholder + the Draft badge. The two
    // contiguous members (byHost/byFile in Connection) cluster into a rail, which
    // carries the grouping in place of a chip; only the lone member (byUrl in
    // General) keeps a "One of" chip — so exactly one chip, not three.
    await _testsWaitForTextsCount('—', undefined, 3);
    await _testsWaitForText('Draft');
    await _testsWaitForTextsCount('One of', undefined, 1);

    // The chip is a ReqoreDropdown listing the siblings; selecting one flashes
    // its row (cross-panel: byUrl sits in General, byHost in Connection).
    const groupSelector = document.querySelector(
      '.readfirst-row[data-field="byUrl"] .options-readfirst-required-group'
    ) as HTMLElement;
    // userEvent keeps the dropdown popover open (fireEvent's synthetic click
    // closes it via the outside-click handler in the Vitest browser).
    await userEvent.click(groupSelector);
    const memberEntry = await waitFor(
      () => {
        const item = Array.from(document.querySelectorAll('.reqore-menu-item')).find((element) =>
          element.textContent?.includes('By host')
        ) as HTMLElement;
        expect(item).toBeTruthy();
        return item;
      },
      { timeout: 10000 }
    );
    await userEvent.click(memberEntry);
    await waitFor(
      () =>
        expect(
          document
            .querySelector('.readfirst-row[data-field="byHost"]')
            ?.className.includes('readfirst-row-flash')
        ).toBe(true),
      { timeout: 10000 }
    );

    // Setting one member: expand it, type a value, collapse — its value shows.
    await _testsClickText('By URL');
    await waitFor(
      () =>
        expect(document.querySelector('.options-readfirst-inline .reqore-textarea')).toBeTruthy(),
      { timeout: 10000 }
    );
    // Capture the editor node BEFORE the value lands. Satisfying the group clears
    // byUrl's required message → infoBlock flips to null; the editing row's wrapper
    // must stay stable so this SAME node survives the transition. A remount here is
    // what used to steal focus mid-type (regression guard).
    const editorBeforeSatisfy = document.querySelector(
      '.options-readfirst-inline .reqore-textarea'
    );
    await _testsChangeStringField({
      selector: '.options-readfirst-inline .reqore-textarea',
      value: 'https://example.com',
    });
    await sleep(300);
    expect(document.contains(editorBeforeSatisfy)).toBe(true);
    await _testsClickButton({ selector: '.options-readfirst-done' });
    await _testsWaitForText('https://example.com');

    // One fulfilled member satisfies the group → the badge flips to Ready and the
    // Once satisfied: the filled member keeps a "Covers" chip; the empty siblings
    // show their "Covered by 'By URL'" note INLINE (not a chip), and no "One of"
    // remains. So exactly one required-group chip stays (the coverer's).
    await _testsWaitForText('Ready');
    await _testsWaitForTextsCount('Covered by “By URL”', undefined, 2);
    await _testsWaitForText('Covers');
    await _testsWaitForTextToNotExist('One of');
    await expect(document.querySelectorAll('.options-readfirst-required-group')).toHaveLength(1);
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with an option that depends on A OR B — the row is locked with a dependency popover listing both alternatives; fulfilling either unlocks the row.',
      },
    },
    chromatic: { disable: true },
  },
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
    // userEvent keeps the dropdown popover open (see note above).
    await userEvent.click(depLock);
    await _testsWaitForText('Unlocked by:');
    await _testsWaitForText('any of:');

    // Locate the second blocker from the popover (scroll + flash).
    let depEntry: HTMLElement | undefined;
    await waitFor(() => {
      depEntry = Array.from(document.querySelectorAll('.reqore-menu-item')).find((element) =>
        element.textContent?.includes('Required Option 5')
      ) as HTMLElement;
      expect(depEntry).toBeTruthy();
    });
    await userEvent.click(depEntry as HTMLElement);
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with an option that depends on a required-group member — the row locks until the required-group option is filled.',
      },
    },
    chromatic: { disable: true },
  },
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
    await _testsWaitForText('One of');
    const depLock = document.querySelector(
      '.readfirst-row[data-field="RequiredOption6"] .options-readfirst-lock-deps'
    ) as HTMLElement;
    await expect(depLock).toBeTruthy();
    // userEvent keeps the dropdown popover open (see note above).
    await userEvent.click(depLock);
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

    // …and the required group is satisfied: empty siblings' chips explain why.
    await _testsWaitForText('Covered by “Required Option 2”');

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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with any-typed options — the read rows summarise the current value and the editor lets the operator pick the concrete type through the More menu.',
      },
    },
    chromatic: { disable: true },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with a read-only option whose value differs from default_value — the value auto-corrects to the default at mount without the wrong value ever rendering.',
      },
    },
    chromatic: { disable: true },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders a compact form with a value carrying an extra field that isn't in the schema — the extra field is filtered out and no row is rendered for it.",
      },
    },
    chromatic: { disable: true },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders a compact form and clicks a row's Help action — the help dialog opens with the option's long-form description.",
      },
    },
    chromatic: { disable: true },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with a refetch-triggering parent and a list-of-hash dependent — mounting and interacting with the form does not trigger runaway re-renders.',
      },
    },
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
// Snapshot disabled: once resolved this looks like any other compact form, so
// the story earns its keep through the play test (the resolve path), not a
// snapshot — the loading state has its own story below.
export const CompactOptionsLoader: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form whose options are fetched via a url — the loader skeleton is shown until the schema resolves, then the compact rows mount.',
      },
    },
    chromatic: { disable: true },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form whose options fetch fails — the loader resolves into an error message rather than crashing.',
      },
    },
  },
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

// The loading state of `optionsLoader`. The loader never resolves, so the engine
// stays in its skeleton gate — this is what the story name promises (a loader),
// and the snapshot Chromatic captures. The resolve path (load → form →
// `onOptionsLoaded`) is exercised by `CompactOptionsLoader` above.
export const OptionsLoader: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the classic FormEngine whose options are fetched via a url — the loader is shown until the schema resolves.',
      },
    },
  },
  args: {
    minColumnWidth: '300px',
    value: CompactValue,
    optionsLoader: () => new Promise<IQorusFormSchema>(() => undefined),
  },
  play: async ({ canvasElement }) => {
    // The skeleton is shown and the form rows never render.
    await waitFor(() =>
      expect(canvasElement.querySelector('.options-loading-skeleton')).toBeInTheDocument()
    );
    await expect(canvasElement.querySelector('.readfirst-row')).not.toBeInTheDocument();
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the flagship compact-mode showcase — the Basic fixture plus every stress field type across a real-form layout, used as the compact-mode reference screenshot.',
      },
    },
  },
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
    await expect(
      document.querySelector('[data-field="chromeImage"] .reqore-icon img')
    ).toBeTruthy();
    await waitFor(() => {
      // The intent stripe rides the value surface's left border, fed by
      // --readfirst-stripe on the field's BLOCK root. Schema messages now render
      // inside the value cell, so the block root is the row itself.
      const intentRow = document.querySelector(
        '.readfirst-row[data-field="chromeIntent"]'
      ) as HTMLElement;
      expect(intentRow?.style?.getPropertyValue('--readfirst-stripe')).toBeTruthy();
    });
    await _testsWaitForText('••••••');
    await _testsWaitForText('This field also carries a warning message.');
    // The unmet auth one-of group (authToken/authCertFile) renders the
    // "One of the below is required" cluster box.
    await waitFor(() =>
      expect(document.querySelector('.options-readfirst-required-cluster')).toBeTruthy()
    );

    // Schema message panels render inside the value cell of the row itself,
    // directly beneath the value.
    const infoPanel = (field: string) =>
      document.querySelector(`.readfirst-row[data-field="${field}"] .options-readfirst-info-panel`);

    // Default-value notes and validation/dependency hints now render as a compact
    // INLINE reason (no ⓘ, no panel) — visible without any interaction.
    await _testsWaitForText('Default: thirty — Falls back to 30 seconds when unset.');
    // Dedicated schema messages stay prominent PANELS, also always visible.
    await expect(infoPanel('apiEndpoint')).toBeTruthy();
    await _testsWaitForText('v1 endpoints are deprecated — migrate to /v2 before 2026-09.');

    // short_desc renders UNDER the field name when the global descriptions toggle
    // is engaged (the per-row ⓘ is gone).
    const labelDesc = (field: string) =>
      document.querySelector(`.readfirst-row[data-field="${field}"] .options-readfirst-label-desc`);
    await expect(labelDesc('chromeIcon')).toBeNull();
    await fireEvent.click(document.querySelector('.options-readfirst-descriptions') as HTMLElement);
    await waitFor(() => expect(labelDesc('chromeIcon')).toBeTruthy());
  },
};

// The same stress form in a 360 px container — stacked rows, panels full-width.
export const CompactShowcaseMobile: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the compact showcase at a ~390px mobile viewport — the compact rows collapse into a single-column stack.',
      },
    },
  },
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

// Required-group "connection rails": members of a one-of group are pulled into a
// contiguous cluster joined by a rail, each with a status node. A 2-member
// credential pair (one provided → green node + Provided badge) and a 4-member
// notification group (none set → violet, pending).
export const CompactRequiredGroupRails: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders a compact form with several required_groups — each group's rail sits alongside its rows so the operator can see which one-of-required set the row belongs to.",
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '320px',
    groups: {
      connection: { label: 'Connection', sort: 0 },
      notify: { label: 'Notification target', sort: 1 },
    },
    options: {
      apiKey: {
        type: 'string',
        ui_type: 'string',
        display_name: 'API key',
        required_groups: ['credential'],
        group: 'connection',
        short_desc: 'Server-to-server key used to authenticate requests.',
      },
      oauthToken: {
        type: 'string',
        ui_type: 'string',
        display_name: 'OAuth token',
        required_groups: ['credential'],
        group: 'connection',
        short_desc: 'Bearer token for delegated access.',
      },
      email: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Email address',
        required_groups: ['target'],
        group: 'notify',
      },
      slack: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Slack channel',
        required_groups: ['target'],
        group: 'notify',
      },
      webhook: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Webhook URL',
        required_groups: ['target'],
        group: 'notify',
      },
      sms: {
        type: 'string',
        ui_type: 'string',
        display_name: 'SMS number',
        required_groups: ['target'],
        group: 'notify',
      },
    } as IOptionsSchema,
    value: {
      apiKey: { type: 'string', value: 'sk_live_••••4f2a' },
    } as IOptions,
  },
  play: async () => {
    await _testsWaitForText('API key');
    // The unmet `target` group (email/slack/webhook/sms, none set) renders the
    // "One of the below is required" cluster box.
    await waitFor(() =>
      expect(document.querySelector('.options-readfirst-required-cluster')).toBeTruthy()
    );
    // The met `credential` group needs no box: apiKey satisfies it, so its empty
    // alternative oauthToken reads as covered by its sibling.
    await _testsWaitForText('Covered by “API key”');
  },
};

// Field sorting (Fields menu → "Sort by") reorders fields WITHIN each group and
// keeps required-group clusters contiguous (rails intact) — never interleaving
// across groups. Regression cover for the compact sort.
export const CompactFieldSortWithinGroups: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with grouped options that carry sort ordinals — rows within each group render in sort order, not schema-declaration order.',
      },
    },
    chromatic: { disable: true },
  },
  args: CompactRequiredGroupRails.args,
  play: async () => {
    await _testsWaitForText('API key');
    const order = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '.readfirst-row[data-field]:not(.readfirst-row-editing)'
        )
      ).map((row) => row.getAttribute('data-field'));

    // Rows are bucketed into status boxes (Needs attention → Set → Optional);
    // within a box, schema order holds. The `target` group is unmet (attention),
    // the `credential` group is met by apiKey (set), so the attention members
    // come first, then the set members.
    await waitFor(() =>
      expect(order()).toEqual(['email', 'slack', 'webhook', 'sms', 'apiKey', 'oauthToken'])
    );

    // Open the Fields menu, drill into the (collapsed) "Sort by" submenu, then
    // pick "Name A→Z". Match the exact LEAF — the menu wraps items, so a
    // substring search can land on a container.
    await fireEvent.click(document.querySelector('.options-readfirst-fields') as HTMLElement);
    const menuItem = (label: string): HTMLElement | null => {
      const leaf = Array.from(document.querySelectorAll<HTMLElement>('*')).find(
        (el) => el.children.length === 0 && el.textContent?.trim() === label
      );
      return (leaf?.closest('button, .reqore-menu-item') as HTMLElement) || leaf || null;
    };
    await waitFor(() => expect(menuItem('Sort by')).toBeTruthy());
    await fireEvent.click(menuItem('Sort by') as HTMLElement);
    await waitFor(() => expect(menuItem('Name A→Z')).toBeTruthy());
    await fireEvent.click(menuItem('Name A→Z') as HTMLElement);

    // Sorted by display name inside each group; the status boxes stay separate
    // (attention: email/slack/sms/webhook | set: apiKey/oauthToken).
    await waitFor(() =>
      expect(order()).toEqual(['email', 'slack', 'sms', 'webhook', 'apiKey', 'oauthToken'])
    );
    // The required-group clusters survive the re-sort (both groups keep their
    // first-member marker, used to anchor the cluster box).
    await expect(document.querySelectorAll('.readfirst-cluster-first')).toHaveLength(2);
  },
};

// `autoFocusFirstRequired` drops the user straight into the first field they
// must fill. Here `name` is required-but-filled and `description` is
// required-but-empty, so the engine expands the `description` row on mount and
// its editor takes focus — no click, no DOM scraping.
export const CompactAutoFocusFirstRequired: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with autoFocus enabled — the first unfilled required row opens for editing automatically on mount.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue,
    groups: CompactGroups,
    autoFocusFirstRequired: true,
  },
  play: async () => {
    await _testsWaitForText('order-fulfilment');

    // The first empty required field (`description`) auto-expands into its
    // inline editor without any interaction.
    await waitFor(
      () =>
        expect(
          document.querySelector(
            '[data-field="description"] input, [data-field="description"] textarea'
          )
        ).toBeTruthy(),
      { timeout: 10000 }
    );

    // …and that editor receives focus (CompactRow focuses the expanded row's
    // control). `name` is required but already filled, so it is skipped.
    await waitFor(
      () => {
        const active = document.activeElement as HTMLElement | null;
        const field = document.querySelector('[data-field="description"]');
        expect(!!active && !!field && field.contains(active)).toBe(true);
      },
      { timeout: 10000 }
    );

    // The already-satisfied required field is NOT expanded/focused.
    const nameField = document.querySelector('[data-field="name"]');
    expect(nameField?.contains(document.activeElement)).toBeFalsy();
  },
};

// `initialExpandedOptions` opens rows the CALLER names, for the case where the
// expanded row is part of an address rather than a click: a field that renders
// its own routable surface can restore the pane from the URL, but not the row
// that has to be open for the pane to exist. Here `description` starts expanded
// with no interaction, while a row the caller did not name stays collapsed.
export const CompactInitialExpandedOptions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with initialExpandedOptions — the caller-named row is already open on mount, and rows it did not name stay collapsed.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue,
    groups: CompactGroups,
    initialExpandedOptions: ['description'],
  },
  play: async () => {
    await _testsWaitForText('order-fulfilment');

    // The caller-named row is open on mount, with no click.
    await waitFor(
      () =>
        expect(
          document.querySelector(
            '[data-field="description"] input, [data-field="description"] textarea'
          )
        ).toBeTruthy(),
      { timeout: 10000 }
    );

    // A row the caller did not name is NOT expanded.
    expect(
      document.querySelector('[data-field="name"] input, [data-field="name"] textarea')
    ).toBeFalsy();
  },
};

// An unknown name must not throw or expand anything — a stale link naming a
// field this schema no longer has just lands on the collapsed form.
export const CompactInitialExpandedOptionsUnknownName: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form whose initialExpandedOptions names a field that does not exist — the form renders normally with every row collapsed.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactSchema,
    value: CompactValue,
    groups: CompactGroups,
    initialExpandedOptions: ['no-such-field'],
  },
  play: async () => {
    await _testsWaitForText('order-fulfilment');
    await sleep(300);
    expect(
      document.querySelector(
        '[data-field="description"] input, [data-field="description"] textarea'
      )
    ).toBeFalsy();
  },
};

// A required field can be FILLED yet INVALID — here `endpoint` has a value that
// fails its own `validation_regex` (it must be an http(s) URL). It still "needs
// attention", so autofocus must land on IT and not skip ahead to the empty
// `description` (which the old empty-only selector would have chosen). This is
// the regression guard for the "filled-but-invalid" drift.
const CompactInvalidFilledSchema: Record<string, TCompactField> = {
  endpoint: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Endpoint URL',
    required: true,
    group: 'info',
    // Real format constraint: the value must be an http(s) URL. `validation_regex`
    // is read by the engine's own validation (helpers/validations.ts); it's not on
    // the base schema type, so cast.
    validation_regex: '^https?://',
  } as TCompactField,
  description: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Description',
    required: true,
    group: 'general',
  },
};

const CompactInvalidFilledValue: IOptions = {
  endpoint: { type: 'string', value: 'bad-endpoint' }, // filled, but not an http(s) URL → fails validation_regex
  // description left empty
};

export const CompactAutoFocusTargetsInvalidFilledField: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with autoFocus enabled and a required field holding an invalid value — the autofocus targets the invalid filled field rather than the next empty required.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactInvalidFilledSchema,
    value: CompactInvalidFilledValue,
    groups: CompactGroups,
    autoFocusFirstRequired: true,
  },
  play: async () => {
    await _testsWaitForText('Endpoint URL');

    // Sanity: the value genuinely fails the field's own validation (it isn't an
    // http(s) URL), using the very same validator the engine runs — so this is a
    // real filled-but-INVALID field, not a synthetically-flagged one.
    expect(validateField('string', 'bad-endpoint', { validation_regex: '^https?://' })).toBe(false);

    // `endpoint` has a value but is invalid, so it needs attention and must be
    // the target — even though `description` is the empty required field the old
    // empty-only logic would have picked.
    await waitFor(
      () =>
        expect(
          document.querySelector('[data-field="endpoint"] input, [data-field="endpoint"] textarea')
        ).toBeTruthy(),
      { timeout: 10000 }
    );

    await waitFor(
      () => {
        const active = document.activeElement as HTMLElement | null;
        const field = document.querySelector('[data-field="endpoint"]');
        expect(!!active && !!field && field.contains(active)).toBe(true);
      },
      { timeout: 10000 }
    );

    // The empty `description` is NOT the one expanded/focused.
    const descField = document.querySelector('[data-field="description"]');
    expect(descField?.contains(document.activeElement)).toBeFalsy();
  },
};

// DEMO / manual-test story: the first "needs attention" field is a BOOLEAN,
// whose compact editor is a `<div tabindex=0>` (ReqoreCheckbox) — NOT an
// input/textarea/contenteditable that CompactRow's focus selector matches. Both
// `enabled` and `name` are required and unset, so both need attention; `enabled`
// is first. Open this in Storybook to see the UX: autofocus TARGETS the boolean
// (its row expands) and does NOT skip ahead to the focusable `name` field — but
// no element inside actually receives keyboard focus, so the caret is left
// nowhere. (This is the non-text-editor focus gap; kept as a playground rather
// than a hard assertion until we decide how CompactRow should focus such rows.)
const CompactNonFocusableFirstSchema: Record<string, TCompactField> = {
  enabled: {
    type: 'bool',
    ui_type: 'bool',
    display_name: 'Enabled',
    short_desc: 'A boolean — the first field that needs attention',
    required: true,
    preselected: true,
    group: 'info',
  },
  name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Name',
    short_desc: 'A focusable text field — comes second',
    required: true,
    preselected: true,
    group: 'general',
  },
};

const CompactNonFocusableFirstValue: IOptions = {}; // both unset → both need attention

export const CompactAutoFocusNonFocusableFirstField: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact form with autoFocus enabled where the first needs-attention field is a boolean (not focusable) — the autofocus skips it and opens the next focusable field instead.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: CompactNonFocusableFirstSchema,
    value: CompactNonFocusableFirstValue,
    groups: CompactGroups,
    autoFocusFirstRequired: true,
  },
  play: async () => {
    // Smoke: both required-but-unset fields render (both land in "needs
    // attention"), with the boolean first. Focus behaviour is intentionally left
    // for manual observation — see the note above.
    await _testsWaitForText('Enabled');
    await _testsWaitForText('Name');
  },
};

// A richtext value whose prose is interleaved with template chips — the shape an
// alert rule's message body has. The read-first summary renders the chips inline
// with the surrounding words, so the two have to sit on the same baseline.
const RichtextTemplateSchema: IOptionsSchema = {
  body: {
    type: 'richtext',
    ui_type: 'richtext',
    display_name: 'Message Body',
    required: true,
  },
};

const RichtextTemplateValue: IOptions = {
  body: {
    type: 'richtext',
    value: [
      {
        type: 'paragraph',
        children: [
          { text: 'Alert: ' },
          { type: 'tag', value: '$alert:code', label: 'alert_code', children: [{ text: '' }] },
          { text: ' Severity: ' },
          { type: 'tag', value: '$alert:severity', label: 'severity', children: [{ text: '' }] },
          { text: ' Rule: ' },
          { type: 'tag', value: '$alert:rule', label: 'rule_name', children: [{ text: '' }] },
        ],
      },
    ],
  },
} as unknown as IOptions;

export const CompactReadFirstRichtextTemplateBaseline: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Read-first summary of a richtext value that mixes prose with template chips. The chips must sit on the same baseline as the words around them.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: RichtextTemplateSchema,
    value: RichtextTemplateValue,
  },
  play: async ({ canvasElement }) => {
    await _testsWaitForText('alert_code');

    const textRect = (predicate: (text: string) => boolean): DOMRect | undefined => {
      const walker = document.createTreeWalker(canvasElement, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (predicate((node.textContent || '').trim())) {
          const range = document.createRange();
          range.selectNodeContents(node);
          return range.getBoundingClientRect();
        }
        node = walker.nextNode();
      }
      return undefined;
    };

    const chipRect = textRect((text) => text === 'alert_code');
    const proseRect = textRect((text) => text.startsWith('Alert:'));
    await expect(chipRect).toBeTruthy();
    await expect(proseRect).toBeTruthy();

    const chipEl = Array.from(canvasElement.querySelectorAll('span')).find(
      (element) => element.children.length === 0 && element.textContent?.trim() === 'alert_code'
    ) as HTMLElement;
    const proseEl = Array.from(canvasElement.querySelectorAll('span')).find(
      (element) => element.children.length === 0 && element.textContent?.startsWith('Alert:')
    ) as HTMLElement;

    // The wrapper centres its items, so the chip's label and the prose share a
    // baseline only while they are the same size — half-leading is symmetric, so
    // equal type centred against itself lines up. A smaller chip label centred in
    // a taller box rides above the words, which is what this guards against;
    // asserting the boxes alone would pass either way, because the BOXES were
    // always centred.
    await expect(getComputedStyle(chipEl).fontSize).toBe(getComputedStyle(proseEl).fontSize);

    const centreOffset = Math.abs(
      chipRect!.top + chipRect!.height / 2 - (proseRect!.top + proseRect!.height / 2)
    );
    await expect(centreOffset).toBeLessThanOrEqual(1);
  },
};

/**
 * The same summary, built from the value the server actually sends.
 *
 * `CompactReadFirstRichtextTemplateBaseline` above separates its chips with
 * SPACES, and that is why it kept passing while the row stayed broken: an alert
 * rule's Gmail message body is five `\n`-separated lines, and the newline is the
 * whole difference. The richtext branch is the only read-first value that opts
 * into `white-space: pre` — it has to, or the space between a word and the chip
 * beside it is dropped — and `pre` honours the newlines too. Every prose segment
 * after the first then rendered a blank first line, measured 30px against the
 * chips' 14px, and the wrapper's `align-items: center` put each word 12px below
 * the chip next to it. The row read as a staircase (supah, 2026-08-28).
 *
 * The row is a single line by construction; every other value type reaches that
 * through `nowrap`, which eats newlines for free. So the fix is to collapse them
 * here as well, and this story holds the two things that prove it: the prose
 * boxes are one line tall, not two, and they still share a centre with the chips.
 */
const RichtextMultilineTemplateValue: IOptions = {
  body: {
    type: 'richtext',
    value: [
      {
        type: 'paragraph',
        children: [
          { text: 'Alert: ' },
          { type: 'tag', value: '$fsminput:alert_code', label: 'alert_code', children: [{ text: '' }] },
          { text: '\nSeverity: ' },
          { type: 'tag', value: '$fsminput:severity', label: 'severity', children: [{ text: '' }] },
          { text: '\nRule: ' },
          { type: 'tag', value: '$fsminput:rule_name', label: 'rule_name', children: [{ text: '' }] },
        ],
      },
    ],
  },
} as unknown as IOptions;

export const CompactReadFirstRichtextMultilineTemplate: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A multi-line richtext value in the read-first row. The row is one line, so the value's newlines must collapse rather than break — and the row must not also hover the raw template source, which is what the chips are there to replace.",
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: RichtextTemplateSchema,
    value: RichtextMultilineTemplateValue,
  },
  play: async ({ canvasElement }) => {
    await _testsWaitForText('alert_code');

    const proseSpans = Array.from(canvasElement.querySelectorAll('span')).filter(
      // the collapsed newline leaves the segment with a leading space
      (element) =>
        element.children.length === 0 && /^\s*(Alert|Severity|Rule):/.test(element.textContent || '')
    ) as HTMLElement[];
    await expect(proseSpans.length).toBe(3);

    // No hard break survives into the summary: a segment that still carried its
    // newline would render a blank first line and measure two lines tall.
    for (const span of proseSpans) {
      await expect(span.textContent).not.toContain('\n');
    }

    const chipEl = Array.from(canvasElement.querySelectorAll('span')).find(
      (element) => element.children.length === 0 && element.textContent?.trim() === 'alert_code'
    ) as HTMLElement;
    const chipHeight = chipEl.getBoundingClientRect().height;

    // One line tall, like the chip beside it -- this is the assertion that fails
    // on the unfixed code, where the blank line doubled it.
    for (const span of proseSpans) {
      await expect(span.getBoundingClientRect().height).toBeLessThan(chipHeight * 1.6);
    }

    // ...and they still sit on the chips' centre line, which is what the earlier
    // baseline fix bought and this must not give back.
    const chipRect = chipEl.getBoundingClientRect();
    for (const span of proseSpans) {
      const rect = span.getBoundingClientRect();
      const offset = Math.abs(rect.top + rect.height / 2 - (chipRect.top + chipRect.height / 2));
      await expect(offset).toBeLessThanOrEqual(1.5);
    }

    // The row draws the value in full as chips, so it must not ALSO carry a
    // native tooltip of the raw source: hovering a chip fired that and the chip's
    // own popover together, and only the popover is visible in a screenshot.
    const valueCell = chipEl.closest('[title]');
    await expect(valueCell).toBeNull();
  },
};

/**
 * A list of template-capable STRINGS, which is what an email `To` field is.
 *
 * Gmail's `to` is `type: "list"`, `element_type: "string"`,
 * `supports_templates: true`, so each element is edited with a rich-text editor
 * and its value arrives wrapped: `{type: "richtext", value: [{type:
 * "paragraph", …}]}`. The hash-list test unwrapped `item.value`, found the Slate
 * document — an object — and classed a list of addresses as a list of hashes, so
 * the row drew an expandable `type / children / text` tree instead of the
 * address (supah, 2026-08-29).
 *
 * A rich-text envelope is a string in a coat. The row reads it as one.
 */
const RichtextListSchema: IOptionsSchema = {
  to: {
    type: 'list',
    element_type: 'string',
    supports_templates: true,
    display_name: 'To',
    required: true,
  } as never,
};

const RichtextListValue: IOptions = {
  to: {
    type: 'list',
    value: [
      { type: 'richtext', value: [{ type: 'paragraph', children: [{ text: 'ops@example.com' }] }] },
      { type: 'richtext', value: [{ type: 'paragraph', children: [{ text: 'sre@example.com' }] }] },
    ],
  },
} as unknown as IOptions;

export const CompactReadFirstRichtextStringList: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A list of template-capable string elements reads as its strings, not as a structured-data tree: the rich-text envelope each element arrives in is a string in a coat.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: RichtextListSchema,
    value: RichtextListValue,
  },
  play: async ({ canvasElement }) => {
    // The row itself, not a global text search: the addresses have to be IN the
    // `to` row, which is the whole point.
    await waitFor(
      () => {
        const row = canvasElement.querySelector('[data-field="to"]');
        expect(row).toBeTruthy();
        // The addresses themselves, not a bare "2 items" count.
        expect(row?.textContent ?? '').toContain('ops@example.com');
      },
      { timeout: 10000 }
    );

    const text = canvasElement.querySelector('[data-field="to"]')?.textContent ?? '';
    await expect(text).toContain('sre@example.com');

    // ...and none of the document's internals leak into the row. These are the
    // labels the structured-data tree prints, and they are what the operator saw.
    await expect(text).not.toContain('paragraph');
    await expect(text).not.toContain('children');
  },
};

/**
 * The other half of the markdown contract: with NO host renderer there is no
 * inset at all. The row is not left empty though — its one line still carries
 * the document's prose, summarised. Losing the RENDERING without a renderer is
 * the design; losing the CONTENT would be a bug.
 */
export const CompactRowMarkdownWithoutRenderer: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the same compact markdown rows with no host renderer supplied — no rendered document mounts under the row, so the prose IS the value and the row keeps showing it (markers stripped, not raw markdown source). The line count still sits under the field name.',
      },
    },
  },
  args: {
    ...CompactRowMarkdownPreview.args,
    markdownRenderer: undefined,
  },
  play: async ({ canvasElement }) => {
    const descRow = await waitFor(() => {
      const row = canvasElement.querySelector('[data-field="desc"]');
      expect(row).toBeTruthy();
      return row!;
    });

    // No renderer, no inset — reqraft does not fall back to a dialect the host
    // never chose.
    expect(descRow.querySelector('.options-readfirst-markdown')).toBeNull();

    // ...but the prose survives: the markers are stripped, not the content.
    const descText = descRow.querySelector('.options-readfirst-valuetext')?.textContent ?? '';
    expect(descText).toContain('Order intake');
    expect(descText).not.toContain('##');
    expect(descText).not.toContain('**');
  },
};

/**
 * The auth-profile scheme sub-schema, which is where all three of the list-row
 * affordances below were reported. One required choice with named allowed
 * values, one field that belongs to a single choice.
 */
const AuthSchemeArgSchema = {
  type: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Scheme Type',
    short_desc: 'Authentication scheme type',
    required: true,
    allowed_values: [
      { value: 'default', display_name: 'Default RBAC' },
      { value: 'cookie', display_name: 'Cookie' },
      { value: 'oauth2', display_name: 'OAuth2' },
    ],
  },
  cookie_name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Session Cookie Name',
    short_desc: 'Applies to the Cookie scheme alone',
    depends_on: ['type=cookie'],
  },
} as unknown as IOptionsSchema;

const AuthSchemeOptions = {
  schemes: {
    type: 'list',
    ui_type: 'list',
    element_type: 'hash',
    display_name: 'Authentication Schemes',
    short_desc: 'Schemes tried in order, first match wins',
    required: true,
    arg_schema: AuthSchemeArgSchema,
  },
} as unknown as IOptionsSchema;

/**
 * A list-of-hash row reads back in the words the form asked for the value.
 *
 * Reported on an auth profile: the row summarised as "2 items" and its preview
 * printed a data tree — "Object · 1 field" over `type: default`. Both are
 * exactly what is stored, and neither is a string the author has ever seen: the
 * form calls that key "Scheme Type" and that value "Default RBAC". A row meant
 * to confirm a choice showed a value nobody had chosen, in a shape nobody had
 * asked about.
 *
 * A generic data view has to announce what it found, because inference is all it
 * has. A field with an `arg_schema` needs none of that — the shape, the names and
 * the choices are known before the value arrives — so the preview renders
 * THROUGH the schema (`SchemaDataView`) and the summary resolves through the
 * same one. The row, the preview and the editor cannot describe a value three
 * ways.
 */
export const CompactListOfHashReadsInSchemaWords: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A list-of-hash option whose sub-schema names its fields and values. The collapsed row summarises by those names ("Default RBAC, Cookie") and the preview renders as labelled schema rows — "Scheme Type · Default RBAC" per numbered item — instead of an untyped data tree over the stored `type: default`.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: AuthSchemeOptions,
    value: {
      schemes: {
        type: 'list',
        value: [
          { type: 'hash', value: { type: 'default' } },
          { type: 'hash', value: { type: 'cookie', cookie_name: 'qorus-session' } },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    // The preview IS the value here — the row prints no summary line above it.
    // A joined "Default RBAC, Cookie" directly over a preview that names both
    // items is the same facts twice, the lossy version first.
    const preview = await waitFor(() => {
      const element = canvasElement.querySelector('.schema-data-view');
      expect(element).toBeTruthy();
      return element!;
    });
    const text = preview.textContent ?? '';
    // Each item is headed by its first value, so the list reads by name; the
    // remaining fields keep their labels.
    const titles = [...preview.querySelectorAll('.schema-view-item-title')].map((element) =>
      (element.textContent ?? '').trim()
    );
    expect(titles).toEqual(['Default RBAC', 'Cookie']);
    expect(text).toContain('Session Cookie Name');

    // Nothing announces the container's shape — that is the tell of a renderer
    // guessing at data it has not been told about.
    expect(text).not.toMatch(/Object\b/);
    expect(text).not.toMatch(/\d+ fields?\b/);

    // The joined summary is gone from the row, and it is the ROW that has to be
    // checked: the same words still exist inside the preview, so asserting on
    // the whole canvas would pass whether or not the line was removed.
    const valueLine = canvasElement.querySelector(
      '[data-field="schemes"] .options-readfirst-valuetext'
    );
    expect(valueLine?.textContent ?? '').not.toBe('Default RBAC, Cookie');

    // A literal the author typed is set in mono; a chosen label is not.
    const mono = [...preview.querySelectorAll('.schema-view-data')].map((el) =>
      (el.textContent ?? '').trim()
    );
    expect(mono).toContain('qorus-session');
    expect(mono).not.toContain('Default RBAC');

    // The stored spellings are what the author never chose, so they must not be
    // in the preview at all. Substring checks cannot say this — "Scheme Type"
    // contains "type" and "Default RBAC" contains "default" — so the assertion
    // is on whole leaf elements: no chip or cell reads exactly `type`,
    // `cookie_name` or `default`. A substring assertion here passed against a
    // preview that was still rendering the raw pair.
    const leafTexts = [...preview.querySelectorAll('*')]
      .filter((element) => element.children.length === 0)
      .map((element) => (element.textContent ?? '').trim());
    expect(leafTexts).toContain('Default RBAC');
    for (const stored of ['type', 'cookie_name', 'default']) {
      expect(leafTexts).not.toContain(stored);
    }
    expect(canvasElement.textContent ?? '').not.toContain('[object Object]');
  },
};

/**
 * Adding a list item opens the field the item cannot be saved without.
 *
 * `+ Add new item for "Authentication Scheme"` added a row whose one required
 * field sat collapsed, so the author had to find it and click it before the
 * form could be completed — a second click to reach the only thing the first
 * click could have meant.
 *
 * The engine already had `autoFocusFirstRequired`, and it could not fire here:
 * it waits for focus to be free so it never steals a caret, and a form mounted
 * BY a click never sees free focus — the button that mounted it still holds it.
 * Opening a row and moving the caret are separate decisions, so they are now
 * separate flags; this one only opens.
 */
export const CompactAddedListRowOpensItsRequiredField: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Clicks "Add new item" on a list-of-hash option and shows the new row with its required "Scheme Type" field already open. Rows that were already in the value stay collapsed — only the row just added is opened.',
      },
    },
  },
  args: {
    compact: true,
    minColumnWidth: '300px',
    options: AuthSchemeOptions,
    value: {
      schemes: {
        type: 'list',
        value: [{ type: 'hash', value: { type: 'default' } }],
      },
    },
  },
  play: async ({ canvasElement }) => {
    // Open the list itself, which mounts the rows and the Add button. Clicked by
    // FIELD, not by its text: the row no longer prints a summary line, and the
    // words that remain live inside the preview.
    await _testsClickText('Authentication Schemes');
    await waitFor(() => expect(canvasElement.querySelectorAll('.array-auto-item')).toHaveLength(1));

    // The row that was already there is collapsed — this is the state the new
    // row must NOT be confused with.
    const isOpen = (element: Element | null | undefined) =>
      !!element &&
      (element.classList.contains('readfirst-row-editing') ||
        element.classList.contains('options-readfirst-card'));
    const typeRows = () => canvasElement.querySelectorAll('[data-field="type"]');
    expect([...typeRows()].some(isOpen)).toBe(false);

    await _testsClickButton({ label: 'Add new item for "Authentication Schemes"' });

    await waitFor(() => expect(canvasElement.querySelectorAll('.array-auto-item')).toHaveLength(2));
    // Exactly one open required field: the one belonging to the row just added.
    await waitFor(() => expect([...typeRows()].filter(isOpen)).toHaveLength(1));
  },
};

/**
 * The same schema-worded row at a phone-class width.
 *
 * The narrow branch is what makes this worth its own story: below 480px the row
 * stacks the value under the label, so a summary and a preview that were both
 * rewritten to be READ (rather than decoded) have to survive the stacking
 * without wrapping into an unreadable column. `compactNarrow` comes from
 * `useMeasure` on the form's own wrapper, not from a media query, so a narrow
 * container is the honest way to reach the branch here — the viewport-parameter
 * rule applies to media-query components, which this is not.
 */
export const CompactListOfHashReadsInSchemaWordsMobile: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The schema-worded list-of-hash row at a ~360px width: the summary and the renamed preview stack under the field name and stay legible in one column.',
      },
    },
  },
  args: CompactListOfHashReadsInSchemaWords.args,
  decorators: [
    (StoryComponent: React.ComponentType) => (
      <div style={{ maxWidth: 360, margin: '0 auto', border: '1px dashed #ffffff22' }}>
        <StoryComponent />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await _testsWaitForText('Default RBAC');

    // The narrow branch is actually engaged — otherwise this is the desktop
    // story with a border round it, and it would pass while proving nothing.
    await waitFor(() =>
      expect(canvasElement.querySelector('.readfirst-narrow')).toBeTruthy()
    );

    const preview = await waitFor(() => {
      const element = canvasElement.querySelector('.schema-data-view');
      expect(element).toBeTruthy();
      return element!;
    });
    const leafTexts = [...preview.querySelectorAll('*')]
      .filter((element) => element.children.length === 0)
      .map((element) => (element.textContent ?? '').trim());
    expect(leafTexts).toContain('Session Cookie Name');
    for (const stored of ['type', 'cookie_name', 'default']) {
      expect(leafTexts).not.toContain(stored);
    }
  },
};

/**
 * The read-first summary of an EXPRESSION: it renders to one line of text, and
 * a template reference inside it used to print as its own raw token — the same
 * reference the editor shows as a named chip. This is the Save Reply row of the
 * Discord assistant template, whose value is
 * `trim($data:{dc_ai_reply.choices[0].message.content})`.
 */
export const CompactExpressionTemplateChips: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact read-first row whose value is an expression wrapping a template reference — the reference renders as a named chip inside the summary text (trim("Choices[0].message.content")) rather than as its raw $data token.',
      },
    },
    chromatic: { disable: true },
  },
  render: () => (
    <FormEngine
      compact
      name='exprChips'
      stringTemplates={
        {
          items: [
            {
              label: 'Generate AI Reply',
              items: [
                {
                  label: 'Choices',
                  value: '$data:{3.choices}',
                  metadata: { aliasValues: ['$data:{dc_ai_reply.choices}'] },
                },
              ],
            },
          ],
        } as any
      }
      options={
        {
          reply: {
            type: 'string',
            display_name: 'Value',
            desc: 'The new value for the variable',
            supports_expressions: true,
            required: true,
          },
        } as unknown as IQorusFormSchema
      }
      value={
        {
          reply: {
            type: 'string',
            is_expression: true,
            value: {
              exp: 'trim',
              args: [{ type: 'string', value: '$data:{dc_ai_reply.choices[0].message.content}' }],
            },
          },
        } as any
      }
      onChange={fn()}
    />
  ),
  play: async () => {
    // The summary keeps its literal text…
    await _testsWaitForText('trim("', undefined, 1);
    // …and the reference inside it is a named chip, not the raw token.
    await waitFor(() => {
      const chip = Array.from(document.querySelectorAll('.reqore-tag')).find((tag) =>
        tag.textContent?.includes('Choices[0].message.content')
      );
      expect(chip, 'the reference renders as a named chip in the summary').toBeTruthy();
    });
    const raw = Array.from(document.querySelectorAll('.readfirst-row')).filter((row) =>
      row.textContent?.includes('$data:{')
    );
    expect(raw, 'the row prints no raw token').toHaveLength(0);
  },
};

/**
 * The same row on a surface with NO template catalogue — the Automation Hub
 * template preview, which never fetches one. There is no name to resolve the
 * reference to, so the chip carries the reference's own path: the wrapper still
 * reads as `trim("…")` text, and the reference stops reading as code.
 */
export const CompactExpressionWithoutCatalogue: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a compact read-first row whose value is an expression wrapping a template reference, with no templates supplied — the reference still renders as a chip carrying its own path (dc_ai_reply.choices[0].message.content) rather than the raw $data token.',
      },
    },
    chromatic: { disable: true },
  },
  render: () => (
    <FormEngine
      compact
      name='exprNoCatalogue'
      options={
        {
          reply: {
            type: 'string',
            display_name: 'Value',
            desc: 'The new value for the variable',
            supports_expressions: true,
            required: true,
          },
        } as unknown as IQorusFormSchema
      }
      value={
        {
          reply: {
            type: 'string',
            is_expression: true,
            value: {
              exp: 'trim',
              args: [{ type: 'string', value: '$data:{dc_ai_reply.choices[0].message.content}' }],
            },
          },
        } as any
      }
      onChange={fn()}
    />
  ),
  play: async () => {
    await _testsWaitForText('trim("', undefined, 1);
    await waitFor(() => {
      const chip = Array.from(document.querySelectorAll('.reqore-tag')).find((tag) =>
        tag.textContent?.includes('dc_ai_reply.choices[0].message.content')
      );
      expect(chip, 'the reference chips even with no catalogue').toBeTruthy();
    });
    const raw = Array.from(document.querySelectorAll('.readfirst-row')).filter((row) =>
      row.textContent?.includes('$data:{')
    );
    expect(raw, 'the row prints no raw token').toHaveLength(0);
  },
};
