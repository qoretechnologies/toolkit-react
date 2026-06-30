// Stories for the ported AutoFormField (FIELD_STACK_REPORT batch).
// Two groups:
// 1. The reqraft behavioral stories from the original field-migration batch
//    (Empty…ViaFormEngine) — kept, adapted to the IDE's 4-arg
//    `onChange(name, value, type, canBeNull)` API.
// 2. Ported from qorus-ide `src/stories/Fields/Auto.stories.tsx` — offline
//    (templates fixture instead of `useTemplates`, no `InterfacesProvider`).
//    The saved-values stories (`StringWithSuggestedValues`,
//    `StringWithSuggestedAndSavedValues`) and the bare `Connection` story
//    (InterfaceSelector) are not ported — IDE-only seams.
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import jsyaml from 'js-yaml';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { buildTemplates } from '../../../../helpers/templates';
import { FormEngine } from '../../engine/FormEngine';
import templates from '../template/__fixtures__/templates.json';
import { AutoFormField } from './AutoFormField';

const meta = {
  component: AutoFormField,
  title: 'Components/Form/Auto',
  args: {
    onChange: fn(),
    'aria-label': 'Auto field value',
  },
  render(args) {
    const [value, setValue] = useState<any>(args.value);
    return (
      <AutoFormField
        {...args}
        value={value}
        onChange={(name, value, type, canBeNull) => {
          args.onChange?.(name, value, type, canBeNull);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof AutoFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait for some text to appear in the document. */
const waitForText = async (text: string | RegExp) => {
  const body = within(document.body);
  await waitFor(() => expect(body.queryAllByText(text)[0]).toBeTruthy(), { timeout: 10000 });
};

// --- reqraft behavioral stories (kept from the field-migration batch) -------

/** Auto type, no value — the picker is shown and the field area prompts for a type. */
export const Empty: Story = {
  args: {},
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // The IDE auto resolves its type in a mount effect — assert asynchronously.
    await expect(await canvas.findByText('Please select data type')).toBeInTheDocument();
    // No concrete field is rendered yet.
    await expect(canvasElement.querySelector('input[type="number"]')).not.toBeInTheDocument();
  },
};

/** A pre-existing numeric value resolves the type without any user action. */
export const InferredInteger: Story = {
  args: {
    value: 42,
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // Resolved → a concrete field renders (post mount effect) and no prompt.
    await waitFor(() => expect(canvasElement.querySelector('input')).toBeInTheDocument(), {
      timeout: 5000,
    });
    await expect(canvas.queryByText('Please select data type')).not.toBeInTheDocument();
  },
};

/** A pre-existing string value resolves to the text field. */
export const InferredText: Story = {
  args: {
    value: 'hello world',
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(await canvas.findByDisplayValue('hello world')).toBeInTheDocument();
  },
};

/** A concrete `defaultType` renders that field directly — no picker. */
export const ConcreteString: Story = {
  args: {
    defaultType: 'string',
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    // string renders the IDE's LongString field — a textarea. The verbatim
    // dispatcher also spreads `rest` onto its wrapper control group, so the
    // aria-label lands twice — narrow to the textarea.
    const input = await waitFor(
      () => canvas.getByLabelText('Auto field value', { selector: 'textarea' }),
      { timeout: 5000 }
    );
    await userEvent.type(input, 'abc');
    await waitFor(
      () => expect(args.onChange).toHaveBeenLastCalledWith(undefined, 'abc', 'string', false),
      { timeout: 5000 }
    );
  },
};

/** `canBeNull` adds a toggle that sets / clears the null sentinel. */
export const Nullable: Story = {
  args: {
    defaultType: 'string',
    value: 'some text',
    canBeNull: true,
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    // Field visible, toggle reads "Set as null".
    await expect(await canvas.findByDisplayValue('some text')).toBeInTheDocument();
    const toggle = canvas.getByText('Set as null');

    await userEvent.click(toggle);

    // Value cleared to null, toggle flips, the field shows the null sentinel.
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(undefined, null, 'string', true)
    );
    await expect(canvas.getByText('Unset null')).toBeInTheDocument();
    await expect(canvas.queryByDisplayValue('some text')).not.toBeInTheDocument();
  },
};

/** The picker can be restricted to a subset of types via `allowedTypes`. */
export const AllowedTypesSubset: Story = {
  args: {
    allowedTypes: [
      { name: 'int', display_name: 'Integer' },
      { name: 'string', display_name: 'Text' },
    ],
  },
  async play() {
    // The picker badge reflects the restricted list — 2 instead of 14.
    await waitForText('Please select data type');
    await waitForText('2');
  },
};

/** `noSoft` hides the `soft*` variants from the picker (9 instead of 14). */
export const NoSoftTypes: Story = {
  args: {
    noSoft: true,
  },
  async play() {
    await waitForText('Please select data type');
    await waitForText('9');
  },
};

/**
 * The whole point of the migration: a `FormEngine` schema with a field typed
 * `auto` renders the picker for free, via FormEngine → TemplateField → auto.
 */
export const ViaFormEngine: Story = {
  render: () => {
    const [val, setVal] = useState<any>({});
    return (
      <FormEngine
        name='autoFieldDemo'
        options={{
          myAutoField: {
            type: 'auto',
            ui_type: 'auto',
            display_name: 'My Auto Field',
            preselected: true,
          },
        }}
        value={val}
        onChange={(_n, v) => setVal(v)}
      />
    );
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // Generous timeout: findByText defaults to 1s, which flakes under CI load
    // while the engine boots the auto field's type picker (the rest of the suite
    // waits ~10s).
    await expect(
      await canvas.findByText('My Auto Field', undefined, { timeout: 10000 })
    ).toBeInTheDocument();
    // The auto field renders its type picker inside the engine-driven form.
    await expect(
      await canvas.findByText('Please select data type', undefined, { timeout: 10000 })
    ).toBeInTheDocument();
  },
};

// --- ported IDE stories (qorus-ide stories/Fields/Auto.stories.tsx) ---------

export const StringWithAllowedValues: Story = {
  args: {
    allowSaving: true,
    defaultType: 'string',
    allowed_values: [
      {
        display_name: 'test',
        value: { type: 'string', value: 'test' },
        short_desc: 'This is a test',
      },
      {
        display_name: 'test 2',
        value: { type: 'string', value: 'test 2' },
        intent: 'info',
      },
    ],
  },
};

export const RichText: Story = {
  args: {
    defaultType: 'richtext',
    value: 'something',
    allowTemplates: true,
    templates: buildTemplates(templates as any),
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => canvasElement.querySelector('div[contenteditable]'), {
      timeout: 15000,
    });
    await sleep(4500);
    await userEvent.click(canvasElement.querySelector('div[contenteditable]'));
    await sleep(1000);
    await userEvent.click(canvasElement.querySelector('div[contenteditable]'));
    await userEvent.keyboard(' test');

    await expect(canvasElement.querySelector('div[contenteditable]').textContent).toBe(
      'something test'
    );
  },
};

export const ConnectionWithAllowedValues: Story = {
  args: {
    defaultType: 'connection',
    allowed_values: [
      {
        display_name: 'test',
        value: { type: 'connection', value: 'test' },
        short_desc: 'This is a test',
      },
      {
        display_name: 'test 2',
        value: { type: 'connection', value: 'test 2' },
        intent: 'info',
        desc: 'This is a test 2',
      },
    ],
  },
  play: async () => {
    // connection is a no-compact type → the allowed values render as the
    // select with the item collection (the IDE asserts the same modal title).
    const body = within(document.body);
    await userEvent.click(await body.findByText('Please select'));
    await waitForText('Select from items');
  },
};

export const Hash: Story = {
  args: {
    value: jsyaml.dump({ key: 'value' }),
  },
};

export const File: Story = {
  args: {
    defaultType: 'file',
    value: {
      name: 'test.txt',
      content: 'This is a test',
      size: 1234,
    },
  },
};

export const AutoDoesNotChangeTypeBackToAuto: Story = {
  args: {
    defaultType: 'auto',
    value: 'test',
  },
  play: async () => {
    await waitForText('string');
    await waitForText('14');
  },
};

export const ListWithAllowedValues: Story = {
  args: {
    defaultType: 'list',
    allowed_values: [
      {
        display_name: 'Test 1',
        value: { type: 'list', value: [{ type: 'string', value: 'test 1' }] },
        short_desc: 'This is a test',
      },
      {
        display_name: 'And test 2',
        value: { type: 'list', value: [{ type: 'string', value: 'test 2' }] },
        intent: 'info',
      },
    ],
  },
};

export const ListWithCreatableAllowedValues: Story = {
  args: {
    defaultType: 'list',
    value: [{ type: 'string', value: 'test 1' }],
    allowed_values_creatable: true,
    allowed_values: [
      {
        display_name: 'Test 1',
        value: { type: 'list', value: [{ type: 'string', value: 'test 1' }] },
        short_desc: 'This is a test',
      },
      {
        display_name: 'And test 2',
        value: { type: 'list', value: [{ type: 'string', value: 'test 2' }] },
        intent: 'info',
      },
    ],
  },
};

export const ListWithElementType: Story = {
  args: {
    defaultType: 'list',
    element_type: 'int',
  },
};
