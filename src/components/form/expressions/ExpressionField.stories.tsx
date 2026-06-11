import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../types';
import { FormEngine } from '../engine/FormEngine';
import { startDpqlMockLsp } from './dpqlMockLsp';
import { ExpressionField } from './ExpressionField';
import { mockExpressions } from './mockExpressions';
import { IExpression } from './types';

const SAMPLE: IExpression = {
  is_expression: true,
  value: {
    exp: '==',
    args: [
      { type: 'string', value: '$local:name' },
      { type: 'string', value: 'John' },
    ],
  },
};

const meta = {
  component: ExpressionField,
  title: 'Components/Form/Expressions/ExpressionField',
  args: {
    onChange: fn(),
    expressions: mockExpressions,
  },
  render(args) {
    const [value, setValue] = useState<IExpression | undefined>(args.value);
    return (
      <ExpressionField
        {...args}
        value={value}
        onChange={(v) => {
          args.onChange?.(v);
          setValue(v);
        }}
      />
    );
  },
} as StoryMeta<typeof ExpressionField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The shell with a populated expression — Visual/Text toggle + Explain. */
export const Default: Story = {
  args: {
    value: SAMPLE,
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    // Visual mode renders the ported builder (with its own Explain); the shell
    // adds only the Visual/Text toggle.
    await waitFor(
      () => expect(canvasElement.querySelector('.expression')).toBeInTheDocument(),
      { timeout: 6000 }
    );
    await expect(await canvas.findByText('Logical Equals')).toBeInTheDocument();
  },
};

/**
 * Empty expression — the Text-mode "Parsed" preview shows `(empty)`. (The
 * preview element lives in Text mode; an empty AST renders to '' which the
 * shell displays as `(empty)`.)
 */
export const Empty: Story = {
  args: {
    value: { is_expression: true, value: { args: [] } },
    defaultMode: 'text',
  },
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // The preview element is present and reads `(empty)` for an empty AST.
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[data-testid="expression-preview"]')
        ).toBeInTheDocument(),
      { timeout: 6000 }
    );
    await waitFor(
      () => expect(canvas.getByTestId('expression-preview').textContent).toContain('(empty)'),
      { timeout: 6000 }
    );
  },
};

/**
 * The round-trip: a `FormEngine` field with `supports_expressions` whose
 * stored value is an expression (`{ type, value:<AST>, is_expression:true }`)
 * renders the `ExpressionField` shell (FormEngine sets
 * `allowTextExpressions` on TemplateField) — Visual mode shows the ported
 * builder, and the Visual/Text toggle is present.
 */
export const ViaFormEngine: Story = {
  render: () => {
    const [value, setValue] = useState<any>({
      condition: { type: 'bool', value: SAMPLE.value, is_expression: true },
    });
    return (
      <FormEngine
        name='exprForm'
        options={
          {
            condition: {
              type: 'bool',
              ui_type: 'bool',
              display_name: 'Condition',
              preselected: true,
              supports_expressions: true,
              expressions: mockExpressions,
            },
          } as any
        }
        value={value}
        onChange={(_n, v) => setValue(v)}
      />
    );
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // The ported builder rendered inside the engine-driven form.
    await waitFor(
      () => expect(canvasElement.querySelector('.expression')).toBeInTheDocument(),
      { timeout: 6000 }
    );
    await expect(await canvas.findByText('Logical Equals')).toBeInTheDocument();
    // The ExpressionField shell wraps it: the Visual/Text toggle is present.
    await expect(await canvas.findByText('Visual')).toBeInTheDocument();
    await expect(canvas.getByText('Text')).toBeInTheDocument();
    // A valid expression is validated as an expression, not as the base
    // `bool` type — no "must be True or False" error.
    await expect(canvas.queryByText(/True or False/)).not.toBeInTheDocument();
  },
};

/**
 * FormEngine → Text mode, the serialize direction: switching the
 * engine-driven expression field to Text seeds the DPQL editor from the
 * stored AST (`dpql/serialize` over the mock LSP) and the "Parsed" preview
 * renders the same AST.
 */
export const ViaFormEngineTextMode: Story = {
  render: ViaFormEngine.render,
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    // Visual (the builder) renders first.
    await waitFor(
      () => expect(canvasElement.querySelector('.expression')).toBeInTheDocument(),
      { timeout: 6000 }
    );

    // Switch to Text — the DPQL editor mounts and seeds from the AST
    // (`dpql/serialize` over the mock LSP).
    await userEvent.click(await canvas.findByText('Text'));
    const editable = (await waitFor(
      () => {
        const el = canvasElement.querySelector('[contenteditable="true"]');
        if (!el) throw new Error('editor not ready');
        return el as HTMLElement;
      },
      { timeout: 10000 }
    )) as HTMLElement;
    // The template ref renders as a chip ("local: name" + zero-width marks)
    // and the literal gets quoted — assert the seeded content, not raw DPQL.
    await waitFor(
      () => {
        expect(editable.textContent).toMatch(/local:?\s*name/);
        expect(editable.textContent).toContain('John');
      },
      { timeout: 10000 }
    );
    await expect(canvas.getByTestId('expression-preview').textContent).toContain('John');
  },
};

/**
 * FormEngine → Text mode, the parse direction: typing DPQL into an (empty)
 * engine-driven expression field parses to the AST (`dpql/parse` over the
 * mock LSP) and lands in the form value with `is_expression` — the 4-arg
 * `isFunction` onChange flow end-to-end. (Typing starts from an empty
 * expression: synthetic keystrokes only land in an empty Slate document;
 * the seeded direction is covered by `ViaFormEngineTextMode` above.)
 */
export const ViaFormEngineTextTyping: Story = {
  render: (args) => {
    const [value, setValue] = useState<any>({
      condition: { type: 'bool', value: { args: [] }, is_expression: true },
    });
    return (
      <FormEngine
        name='exprForm'
        options={
          {
            condition: {
              type: 'bool',
              ui_type: 'bool',
              display_name: 'Condition',
              preselected: true,
              supports_expressions: true,
              expressions: mockExpressions,
            },
          } as any
        }
        value={value}
        onChange={(_n, v) => {
          args.onChange?.(v as any);
          setValue(v);
        }}
      />
    );
  },
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    // Switch the form field to Text — empty expression, so the editor
    // starts blank.
    await userEvent.click(await canvas.findByText('Text'));
    const editable = (await waitFor(
      () => {
        const el = canvasElement.querySelector('[contenteditable="true"]');
        if (!el) throw new Error('editor not ready');
        return el as HTMLElement;
      },
      { timeout: 10000 }
    )) as HTMLElement;

    // Type DPQL — the debounced `dpql/parse` (mock echoes the text into an
    // `==` AST) flows through TemplateField's `handleExpressionChange` into
    // FormEngine's 4-arg `handleValueChange`.
    await userEvent.click(editable);
    await userEvent.type(editable, 'name');

    // The stored option keeps `is_expression` and carries the typed text in
    // its AST…
    await waitFor(
      () => {
        const calls = (args.onChange as ReturnType<typeof fn>).mock.calls;
        const last = calls[calls.length - 1]?.[0] as any;
        expect(last?.condition?.is_expression).toBe(true);
        expect(JSON.stringify(last?.condition?.value)).toContain('name');
      },
      { timeout: 10000 }
    );
    // …and the "Parsed" preview renders it.
    await waitFor(
      () => expect(canvas.getByTestId('expression-preview').textContent).toContain('name'),
      { timeout: 10000 }
    );
  },
};

/**
 * Text (DPQL) mode, backed by a mock-socket LSP. Typing DPQL parses to the
 * AST (`dpql/parse`); the "Parsed" preview reflects it. (Slate typing is
 * driven live; the play test asserts the editor mounted + connected.)
 */
export const TextMode: Story = {
  args: {
    value: { is_expression: true, value: { args: [] } },
    defaultMode: 'text',
  },
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const editable = (await waitFor(
      () => {
        const el = canvasElement.querySelector('[contenteditable="true"]');
        if (!el) throw new Error('editor not ready');
        return el as HTMLElement;
      },
      { timeout: 6000 }
    )) as HTMLElement;

    // Type DPQL → debounced `dpql/parse` → AST → the "Parsed" preview
    // reflects it (the mock echoes the typed text into an `==` expression).
    await userEvent.click(editable);
    await userEvent.type(editable, 'name');
    await waitFor(
      () => expect(canvas.getByTestId('expression-preview').textContent).toContain('name'),
      { timeout: 6000 }
    );
  },
};

/**
 * A plain `bool` field with `supports_expressions` and no value — starts as
 * the normal field; the "Use Expression" toggle (More menu) switches it.
 * Driven live for the toggle interaction.
 */
export const ToggleInFormEngine: Story = {
  render: () => {
    const [value, setValue] = useState<any>({});
    return (
      <FormEngine
        name='exprToggle'
        options={
          {
            flag: {
              type: 'bool',
              ui_type: 'bool',
              display_name: 'Flag',
              preselected: true,
              supports_expressions: true,
              expressions: mockExpressions,
            },
          } as any
        }
        value={value}
        onChange={(_n, v) => setValue(v)}
      />
    );
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    // Starts as the normal bool field — its "More" menu (TemplateField's
    // `.template-more`) is the entry point to expression mode.
    const more = (await waitFor(
      () => {
        const el = canvasElement.querySelector('.template-more') as HTMLElement | null;
        if (!el) throw new Error('More menu not ready');
        return el;
      },
      { timeout: 6000 }
    )) as HTMLElement;
    await userEvent.click(more);

    // "Use Expression" (`.function-selector`) flips the field into expression
    // mode.
    await userEvent.click(await canvas.findByText('Use Expression'));

    // The ExpressionField shell mounts: its `.expression-field` wrapper, the
    // ported builder (`.expression`), and the Visual/Text toggle.
    await waitFor(
      () => {
        expect(canvasElement.querySelector('.expression-field')).toBeInTheDocument();
        expect(canvasElement.querySelector('.expression')).toBeInTheDocument();
      },
      { timeout: 6000 }
    );
    await expect(await canvas.findByText('Visual')).toBeInTheDocument();
  },
};

/**
 * LIVE — fetches the real expression catalogue from the configured Qorus
 * instance (no `expressions` override). This is the true apples-to-apples
 * with qorus-ide: the picker shows the full ~121-function catalogue and
 * schema-driven operands / operator words.
 *
 * Prereq (same as the DpqlEditor live stories): point the storybook at a
 * reachable instance + token, e.g.
 *   `REACT_APP_QORUS_INSTANCE=https://localhost:8012/ REACT_APP_QORUS_TOKEN=<token> yarn storybook`
 * Without a reachable instance the picker shows "No data available". Marked
 * `live` so it is skipped by the offline test-runner.
 */
export const Live: Story = {
  // Real catalogue fetch — excluded from the offline play-test runner
  // (network/auth), still snapshotted by Chromatic. Mirrors the DpqlEditor
  // live stories.
  tags: ['!test'],
  parameters: { live: true },
  args: {
    type: 'bool',
    value: {
      is_expression: true,
      value: {
        exp: 'contains',
        args: [
          { type: 'string', value: '$local:input' },
          { type: 'string', value: 'es' },
          { type: 'bool', value: true },
        ],
      },
    },
  },
  render(args) {
    const [value, setValue] = useState<IExpression | undefined>(args.value);
    // No `expressions` prop → ExpressionField fetches the real catalogue.
    return (
      <ExpressionField
        type={args.type}
        returnType={args.type}
        value={value}
        onChange={(v) => {
          args.onChange?.(v);
          setValue(v);
        }}
      />
    );
  },
};

/**
 * LIVE — server-side Explain over the LSP (`dpql/renderExpression`). Text
 * mode against the real instance: the "Parsed" preview and the Explain
 * button should show the server rendering — `"test".startsWith("t", true)`
 * — not the DPQL form (`"test" startsWith "t"`) or the client-side
 * approximation. Compare with qorus-ide's Explain (storybook :6007) for the
 * same AST. Prereq: same as `Live`; note the LSP WebSocket is NOT
 * CORS-blocked, unlike REST fetches from storybook to localhost:8012.
 */
export const LiveExplain: Story = {
  tags: ['!test'],
  parameters: { live: true },
  args: {
    value: {
      is_expression: true,
      value: {
        exp: 'starts-with',
        args: [
          { type: 'string', value: 'test' },
          { type: 'string', value: 't' },
        ],
      },
    },
    defaultMode: 'text',
  },
};
