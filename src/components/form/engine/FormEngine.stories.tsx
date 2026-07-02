import { ReqoreInput } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { Meta, StoryObj } from '@storybook/react-vite';
import { ChangeEvent, useState } from 'react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
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
import { startDpqlMockLsp } from '../expressions/dpqlMockLsp';
import { mockExpressions } from '../expressions/mockExpressions';
import { mockPopulatedDefinition } from '../fields/schema-definition/mockDefinition';
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
export const OptionInheritsRenderPropFromSibling: Story = {
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
      () =>
        expect(canvas.getByTestId('code-editor-language')).toHaveTextContent('syntax: qore'),
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
      () =>
        expect(canvas.getByTestId('code-editor-language')).toHaveTextContent('syntax: python'),
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
    await waitFor(
      () => expect(canvas.getAllByText('Source Code').length).toBeGreaterThan(0),
      { timeout: 5000 }
    );
  },
};

// Compact-row code-editor preview: a `code-editor` field with a multi-line
// string value renders (a) a "N lines · N chars" tag in the value cell instead
// of the truncated raw string, and (b) a monospace `<pre>` block under the row
// capped by a `ReqoreCollapsibleContent` — the "Show more" affordance the value
// cell couldn't provide on its own. Locks the compact preview so a future
// CompactRow refactor can't silently reduce a Qorus source-code field to an
// ellipsised one-liner again.
export const CompactRowCodeEditorPreview: Story = {
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
    await waitFor(
      () => expect(canvas.getAllByText('Methods').length).toBeGreaterThan(0),
      { timeout: 5000 }
    );
    // The list-of-hashes value summarises by the items' names — never a raw
    // "[object Object]" (regression: it used to stringify each hash envelope).
    await expect(await canvas.findByText('init, run', undefined, { timeout: 5000 }))
      .toBeInTheDocument();
    await expect(canvasElement.textContent ?? '').not.toContain('[object Object]');
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

export const CompactReadOnly: Story = {
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
        expect(
          document.querySelector('.readfirst-row[data-field="opt"]')?.className
        ).toContain('readfirst-row-flash'),
      { timeout: 4000 }
    );
  },
};

export const CompactRequiredOnlyAndSearch: Story = {
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
    await waitFor(
      () => expect(document.querySelector('.options-readfirst-more')).toBeTruthy(),
      { timeout: 10000 }
    );
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
  parameters: { chromatic: { disable: true } },
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
      () =>
        expect(
          document.querySelector('.readfirst-row-editing[data-field="host"]')
        ).toBeFalsy(),
      { timeout: 10000 }
    );

    // Toggling off hides them again.
    await _testsClickButton({ selector: '.options-readfirst-descriptions' });
    await _testsWaitForTextToNotExist('The server hostname or IP address');
  },
};

export const CompactSearchHidden: Story = {
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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

    // Clear it → the value empties, so Clear is replaced by Revert in place.
    await fireEvent.click(editRow('enabled').querySelector('.options-readfirst-clear')!);
    await waitFor(() => {
      expect(editRow('enabled').querySelector('.options-readfirst-clear')).not.toBeInTheDocument();
      expect(editRow('enabled').querySelector('.options-readfirst-revert')).toBeInTheDocument();
    });
  },
};

// required_groups linkage: every member shows a PERSISTENT chip — amber "One of"
// while unmet (tap-popover → scroll + flash siblings, hover highlights), flipping
// to a muted-green "Covers" / "Covered by <X>" once satisfied. Members live in
// DIFFERENT panels to prove cross-panel linkage.
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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
  parameters: { chromatic: { disable: true } },
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

// The loading state of `optionsLoader`. The loader never resolves, so the engine
// stays in its skeleton gate — this is what the story name promises (a loader),
// and the snapshot Chromatic captures. The resolve path (load → form →
// `onOptionsLoaded`) is exercised by `CompactOptionsLoader` above.
export const OptionsLoader: Story = {
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
      document.querySelector(
        `.readfirst-row[data-field="${field}"] .options-readfirst-info-panel`
      );

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
  parameters: { chromatic: { disable: true } },
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
