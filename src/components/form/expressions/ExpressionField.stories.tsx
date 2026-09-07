import { ReqoreButton } from '@qoretechnologies/reqore';
import type { IReqoreEffect } from '@qoretechnologies/reqore/dist/components/Effect';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../types';
import { FormEngine } from '../engine/FormEngine';
import { startDpqlMockLsp } from './dpqlMockLsp';
import { ExpressionField } from './ExpressionField';
import { mockExpressions } from './mockExpressions';
import { IExpression } from './types';

/** The IDE's AI-assist button, as it renders on every expression card there
 *  (qorus-ide `src/components/AiButton` + `src/constants/effects.ts`
 *  `SynthColorEffect`, resolved): a `ReqoreButton` carrying the Qorus AI
 *  gradient. Only the click is stubbed — the real one opens a Qonsole session,
 *  which is the IDE's to own and the reason the seam exists. */
const IDE_AI_BUTTON_EFFECT: IReqoreEffect = {
  gradient: {
    colors: { 0: '#13163a', 100: '#5c1976' },
    animate: 'hover',
    animationSpeed: 5,
  },
};

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
  parameters: {
    mockData: [
      {
        url: 'https://hq.qoretechnologies.com:8092/api/latest/system?action=expressions&context=ui',
        method: 'GET',
        status: 200,
        response: mockExpressions,
      },
    ],
  },
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

/** The DPQL editor overlays "Connecting to language server…" / "Loading
 * schema…" while its LSP session starts — a snapshot must never catch that
 * transient, so every Text-mode play ends by waiting the overlay out. */
const waitForLspIdle = (canvasElement: HTMLElement) =>
  waitFor(
    () => {
      expect(canvasElement.querySelector('[contenteditable="true"]')).toBeInTheDocument();
      expect(canvasElement.textContent).not.toContain('Connecting to language server');
      expect(canvasElement.textContent).not.toContain('Loading schema');
    },
    { timeout: 10000 }
  );

/** The shell with a populated expression — the Visual/Text mode toggle. */
export const Default: Story = {
  args: {
    value: SAMPLE,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ExpressionField holding a "$local:name == John" expression — the Visual builder shows the Logical Equals operator with its two operands and the Visual/Text mode toggle.',
      },
    },
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
 * Empty expression — an empty AST renders no "Parsed" box at all (nothing to
 * parse), just the bare editor waiting for input.
 */
export const Empty: Story = {
  args: {
    value: { is_expression: true, value: { args: [] } },
    defaultMode: 'text',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ExpressionField in Text mode with an empty expression AST — only the DPQL editor shows; the "Parsed" preview box stays hidden until there is a query to parse.',
      },
    },
  },
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await waitForLspIdle(canvasElement);
    // An empty query has nothing to parse — no Parsed box.
    await expect(canvas.queryByTestId('expression-preview')).toBeNull();
    await expect(canvas.queryByText('Parsed')).toBeNull();
  },
};

/**
 * The round-trip: a `FormEngine` field with `supports_expressions` whose
 * stored value is an expression (`{ type, value:<AST>, is_expression:true }`)
 * renders the `ExpressionField` shell (FormEngine sets
 * `allowTextExpressions` on TemplateField) — Visual mode shows the ported
 * builder, and the Visual/Text toggle is present.
 */
/**
 * The seam a host actually reaches. The builder's own `WithInjectedExtraActions`
 * story proves the `extraActions` slot on `&&` / `||` group children, which the
 * group recursion forwards; this one proves the two hops that used to drop it —
 * the shell hosts mount, and an operand that is itself an expression (rendered
 * through an operand `TemplateField`, not the group recursion).
 */
export const NestedOperandKeepsInjectedActions: Story = {
  args: {
    value: {
      is_expression: true,
      value: {
        exp: 'contains',
        args: [
          { type: 'string', value: '$local:input' },
          {
            is_expression: true,
            value: {
              exp: 'contains',
              args: [
                { type: 'string', value: '$local:other' },
                { type: 'string', value: 'es' },
              ],
            },
          },
        ],
      },
    },
    extraActions: () => [
      {
        as: ReqoreButton,
        props: {
          icon: 'ChatAiFill',
          fixed: true,
          compact: true,
          minimal: true,
          transparent: true,
          effect: IDE_AI_BUTTON_EFFECT,
          className: 'expression-ai-assist',
          onClick: fn(),
        },
        // Always visible here, unlike the IDE's hover-revealed original: the
        // point of this story is to count which cards received the seam, and
        // hovering a nested card bubbles to the outer one, which would make a
        // hover-gated count ambiguous (and put a hover popover in the snapshot).
        show: true,
        size: 'tiny',
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ExpressionField holding a String Contains expression whose second operand is itself a String Contains expression, with an extraActions factory that injects an AI-assist button per card. Both cards show the injected action, the nested operand\'s included.',
      },
    },
  },
  play: async () => {
    const cards = () => document.querySelectorAll('.expression');
    // Outer card plus the nested operand's card. The nested builder fetches
    // the (mocked) catalogue on its own, so it mounts a beat after the outer.
    await waitFor(() => expect(cards().length).toBe(2), { timeout: 10000 });

    // Scoped to the NESTED card, so the outer card's action cannot satisfy it.
    await waitFor(() =>
      expect(cards()[1].querySelector('.expression-ai-assist')).toBeInTheDocument()
    );
    // And the seam reached every card, not just one.
    expect(document.querySelectorAll('.expression-ai-assist').length).toBe(2);
  },
};

export const ViaFormEngine: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a FormEngine schema with a bool option that carries supports_expressions and a stored expression value — the engine routes through TemplateField and mounts the ExpressionField shell with the Visual builder and the Visual/Text toggle.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the FormEngine expression field, then switches to Text mode — the DPQL editor seeds from the stored AST via the mock LSP\'s dpql/serialize call and the "Parsed" preview mirrors it.',
      },
    },
  },
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
    await waitFor(
      () => expect(canvas.getByTestId('expression-preview').textContent).toContain('John'),
      { timeout: 10000 }
    );
    await waitForLspIdle(canvasElement);
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the FormEngine expression field with an empty AST in Text mode. Typing DPQL text triggers the mock LSP\'s dpql/parse and the parsed expression lands in the form value with is_expression set.',
      },
    },
  },
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

    await waitFor(
      () => {
        const calls = (args.onChange as ReturnType<typeof fn>).mock.calls;
        const last = calls[calls.length - 1]?.[0] as any;
        expect(last?.condition?.is_expression).toBe(true);
      },
      { timeout: 10000 }
    );
    await waitFor(
      () => expect(canvas.getByTestId('expression-preview')).toBeInTheDocument(),
      { timeout: 10000 }
    );
    await waitForLspIdle(canvasElement);
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ExpressionField in Text (DPQL) mode over a mock-socket LSP. Typing DPQL text triggers dpql/parse and the "Parsed" preview reflects the resulting AST.',
      },
    },
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
    await waitForLspIdle(canvasElement);
  },
};

/**
 * A plain `bool` field with `supports_expressions` and no value — starts as
 * the normal field; the "Use Expression" toggle (More menu) switches it.
 * Driven live for the toggle interaction.
 */
export const ToggleInFormEngine: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a FormEngine schema with a plain bool option (supports_expressions, no value). Clicking More then "Use Expression" flips the field to expression mode and the ExpressionField shell with the Visual builder mounts in place of the checkbox.',
      },
    },
  },
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
  parameters: {
    live: true,
    docs: {
      description: {
        story:
          'Renders ExpressionField against a live Qorus instance — the picker fetches the real ~121-function catalogue rather than the mock, and the seeded "contains" expression exercises the schema-driven operators and operands.',
      },
    },
  },
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
 * LIVE — server-side rendering over the LSP (`dpql/renderExpression`). Text
 * mode against the real instance: the live "Parsed" line should show the
 * server rendering — `"test".startsWith("t", true)` — not the DPQL form
 * (`"test" startsWith "t"`) or the client-side approximation. Compare with
 * qorus-ide's Explain (storybook :6007) for the same AST. Prereq: same as
 * `Live`; note the LSP WebSocket is NOT CORS-blocked, unlike REST fetches
 * from storybook to localhost:8012.
 */
export const LiveExplain: Story = {
  tags: ['!test'],
  parameters: {
    live: true,
    docs: {
      description: {
        story:
          'Renders ExpressionField in Text mode against a live Qorus instance — the "Parsed" preview uses the server-rendered form via dpql/renderExpression rather than the client-side approximation.',
      },
    },
  },
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
