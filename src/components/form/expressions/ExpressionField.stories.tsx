import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../types';
import { FormEngine } from '../engine/FormEngine';
import { dpqlMockParseCalls, startDpqlMockLsp } from './dpqlMockLsp';
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
    await waitFor(() => expect(canvasElement.querySelector('.expression')).toBeInTheDocument(), {
      timeout: 6000,
    });
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
    await waitFor(() => expect(canvasElement.querySelector('.expression')).toBeInTheDocument(), {
      timeout: 6000,
    });
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
    await waitFor(() => expect(canvasElement.querySelector('.expression')).toBeInTheDocument(), {
      timeout: 6000,
    });

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
          "Renders the FormEngine expression field with an empty AST in Text mode. Typing DPQL text triggers the mock LSP's dpql/parse and the parsed expression lands in the form value with is_expression set.",
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
    await waitFor(() => expect(canvas.getByTestId('expression-preview')).toBeInTheDocument(), {
      timeout: 10000,
    });
    await waitForLspIdle(canvasElement);
  },
};

/**
 * A field's declared type travels with every parse, and the answer is shown
 * only where there is something to decide.
 *
 * The mock returns type analysis ONLY when the request carried a
 * `target_type`, exactly as the server does - so these stories fail if the
 * field stops sending it, rather than passing on a fixture.
 */
/* `text` is per-story, and that is not cosmetic. `DpqlProbe` caches parse
   results in a session-wide singleton keyed by the TEXT ALONE, so two stories
   typing the same string share one answer: the second gets a cache HIT, sends
   no request at all, and is handed the answer computed for the OTHER field's
   type. That is order-dependent, so it passed locally and failed on CI, where
   the two ran the other way round — and the instrumentation proved it by
   reporting `parses=[]` for a field that was nonetheless showing a parsed
   value. Distinct text per story keeps them independent. */
const typedExpressionStory = (
  fieldType: string,
  text: string,
  expectation: (canvasElement: HTMLElement) => Promise<void>
): Story => ({
  render: () => {
    const [value, setValue] = useState<any>({
      amount: { type: fieldType, value: { args: [] }, is_expression: true },
    });
    return (
      <FormEngine
        name='typedExprForm'
        options={
          {
            amount: {
              type: fieldType,
              ui_type: fieldType,
              display_name: 'Amount',
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
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Text'));
    const editable = (await waitFor(
      () => {
        const el = canvasElement.querySelector('[contenteditable="true"]');
        if (!el) throw new Error('editor not ready');
        return el as HTMLElement;
      },
      { timeout: 10000 }
    )) as HTMLElement;
    /* The editor mounting is NOT the same as the language server being ready,
       and typing into it before the socket is up loses the parse: no request is
       sent, so no `target_type` answer ever comes back and the fit message is
       never rendered. That is a race, not a slow response — raising the
       expectation's timeout would not have helped.

       It cost a red CI run that was green locally, where the mock connects
       immediately. Worse, it is silent in the sibling story: one that asserts
       the ABSENCE of the message passes for the wrong reason under exactly the
       same race. */
    await waitForLspIdle(canvasElement);
    await userEvent.click(editable);
    await userEvent.type(editable, text);
    await expectation(canvasElement);
    await waitForLspIdle(canvasElement);
  },
});

/**
 * Text used as a number: the conversion is attempted, not guaranteed, so the
 * field says so and offers the conversion. The value itself is checked again
 * server-side when the expression actually runs.
 */
export const TextModeTypeMayNotFit: Story = typedExpressionStory(
  'int',
  'total_may_not_fit',
  async (canvasElement) => {
    /* Matched against the rendered TEXT, not with `getByText`. `ReqoreMessage`
     renders its title through nested nodes, so an exact single-element match
     reports "unable to find" for a message that is demonstrably on screen —
     the very failure testing-library's own error describes ("the text is
     broken up by multiple elements"). A unit test against this component
     reproduced that directly: the container held the title, the message and
     the fix chip, and `getByText` still could not find it.

     The assertion stays meaningful: the title has to be present AND the
     suggested conversion has to be the one for this field's type. */
    /* The assertion carries the diagnosis with it. A DOM dump is truncated by
     testing-library and a `console.log` does not reliably reach a CI log, but
     a custom matcher message always does — and the one thing worth knowing
     here is whether the front end SENT `target_type` at all, because the mock
     answers with analysis only when it did. Without this the failure looks
     identical whether the request lacked a target or the answer went
     unrendered. */
    const why = () =>
      `parses=${JSON.stringify(dpqlMockParseCalls)} text=${JSON.stringify(
        (canvasElement.textContent || '').slice(0, 400)
      )}`;
    await waitFor(
      () => {
        expect(canvasElement.textContent, why()).toContain('This may not fit');
        expect(
          canvasElement.querySelector('[data-testid="expression-type-fix"]')?.textContent,
          why()
        ).toContain('toInt(');
      },
      { timeout: 10000 }
    );
  }
);

/**
 * Text used as text needs no conversion at all, so nothing is said. A warning
 * here would be noise, and noise is what teaches people to ignore the
 * warnings that matter.
 */
export const TextModeTypeFits: Story = typedExpressionStory(
  'string',
  'total_type_fits',
  async (canvasElement) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId('expression-preview')).toBeInTheDocument(), {
      timeout: 10000,
    });
    /* Absence, checked against the rendered text for the same reason its sibling
     checks presence that way: `queryByText` returns null for a message that IS
     on screen but split across nodes, so it would report "no warning" whether
     or not one was drawn — passing for the wrong reason is worse here than
     failing, because absence is the whole claim. */
    expect(canvasElement.textContent).not.toContain('This may not fit');
    expect(canvasElement.textContent).not.toContain('This does not fit');
  }
);

/**
 * An `auto` field accepts anything, so there is nothing to check the
 * expression's return type against and no target is sent at all.
 *
 * This is not a hypothetical. An expression VALUE is
 * `{ is_expression: true, value: {...} }` — a hash whatever the expression
 * computes — and the auto field used to infer its type from that envelope, so
 * writing an expression made the field decide it held a `hash`. That inferred
 * type was then handed back as the return type to check against, and `1 + 2`
 * was rejected on a test assertion's Value with "The expression returns int,
 * and this field holds hash": the field disagreeing with itself about a value
 * the author had just written.
 */
export const TextModeAutoAsksNothing: Story = typedExpressionStory(
  'auto',
  'total_auto_field',
  async (canvasElement) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[contenteditable="true"]')).toBeTruthy();
      },
      { timeout: 10000 }
    );
    /* The contract, not just the symptom: the mock answers with analysis only
       when a target was sent, so asserting the MESSAGE is absent would also
       pass if the request simply never happened. Assert what was asked. */
    await waitFor(
      () => {
        expect(
          dpqlMockParseCalls.length,
          `parses=${JSON.stringify(dpqlMockParseCalls)}`
        ).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );
    expect(
      dpqlMockParseCalls.every((call) => !call.target),
      `an auto field must send no target_type: ${JSON.stringify(dpqlMockParseCalls)}`
    ).toBe(true);
    expect(canvasElement.textContent).not.toContain('This does not fit');
    expect(canvasElement.textContent).not.toContain('This may not fit');
  }
);

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
