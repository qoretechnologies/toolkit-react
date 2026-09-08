import { ReqoreButton } from '@qoretechnologies/reqore';
import type { IReqoreEffect } from '@qoretechnologies/reqore/dist/components/Effect';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useEffect, useMemo, useState } from 'react';

import { StoryMeta } from '../../../types';
import { FormEngine } from '../engine/FormEngine';
import { dpqlMockParseCalls, startDpqlMockLsp } from './dpqlMockLsp';
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

/** A stable `onChange` for stories that own their value themselves. */
const noopChange = (): void => undefined;

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
 * Empty expression — an empty AST renders no "Preview" box at all (nothing to
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
          'Renders ExpressionField in Text mode with an empty expression AST — only the DPQL editor shows; the "Preview" box stays hidden until there is something to show.',
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
    /* An empty query has nothing to render — no Preview box.
       The testid is the assertion that matters: after the rename a
       `queryByText('Parsed')` would be null whatever the box did, and an
       assertion that cannot fail is worse than no assertion. */
    await expect(canvas.queryByTestId('expression-preview')).toBeNull();
    await expect(canvas.queryByText('Preview')).toBeNull();
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
 * stored AST (`dpql/serialize` over the mock LSP) and the "Preview" box
 * renders the same AST.
 */
export const ViaFormEngineTextMode: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the FormEngine expression field, then switches to Text mode — the DPQL editor seeds from the stored AST via the mock LSP\'s dpql/serialize call and the "Preview" box mirrors it.',
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
 * AST (`dpql/parse`); the "Preview" box reflects it. (Slate typing is
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
          'Renders ExpressionField in Text (DPQL) mode over a mock-socket LSP. Typing DPQL text triggers dpql/parse and the "Preview" box reflects the resulting AST.',
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

    // Type DPQL → debounced `dpql/parse` → AST → the "Preview" box
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
 * Wait for the DOM to stop changing.
 *
 * Both stories below assert a NEGATIVE — that the view the author was put in
 * is not swapped out from under them — and a swap lands a render or two after
 * the interaction that causes it. `waitFor` is therefore no help at all: it
 * passes on the transient state BEFORE the swap and proves nothing. Settling
 * on the DOM going quiet is what makes the assertion mean something.
 */
const settle = (root: HTMLElement, quietMs = 400): Promise<void> =>
  new Promise<void>((resolve) => {
    let quiet: ReturnType<typeof setTimeout>;
    const stop = (): void => {
      observer.disconnect();
      resolve();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(quiet);
      quiet = setTimeout(stop, quietMs);
    });
    observer.observe(root, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    quiet = setTimeout(stop, quietMs);
  });

/** Open a compact row — a read-first row shows its label, not its editor. */
const openCompactRow = async (canvasElement: HTMLElement): Promise<void> => {
  const label = (await waitFor(
    () => {
      const el = within(canvasElement).queryByText('Value');
      if (!el) throw new Error('row not rendered');
      return el as HTMLElement;
    },
    { timeout: 10000 }
  )) as HTMLElement;
  if (!canvasElement.querySelector('input[type="text"], textarea, [contenteditable="true"]')) {
    await userEvent.click(label);
  }
};

/**
 * Type an expression into a plain field, accept the offer, and assert the
 * shell opens on TEXT and stays there.
 *
 * Shared so that each story below differs only in the FORM around the field —
 * which is the variable under test, the plain engine being healthy and the
 * arrangements a real consumer builds being the ones that break it.
 */
const acceptTypedExpression = async (canvasElement: HTMLElement): Promise<void> => {
  const input = (await waitFor(
    () => {
      const el = canvasElement.querySelector(
        'input[type="text"], textarea, [contenteditable="true"]'
      );
      if (!el) throw new Error('field not ready');
      return el as HTMLElement;
    },
    { timeout: 10000 }
  )) as HTMLElement;

  await userEvent.click(input);
  await userEvent.type(input, '1 + 2');

  // The offer appears only after the server (here the mock) has said the text
  // really is an expression — a successful parse alone means nothing.
  const offer = (await waitFor(
    () => {
      const el = canvasElement.querySelector('.dpql-detected-offer');
      if (!el) throw new Error('offer not made');
      return el as HTMLElement;
    },
    { timeout: 10000 }
  )) as HTMLElement;

  await userEvent.click(offer);

  await waitFor(() => expect(canvasElement.querySelector('.expression-field')).toBeInTheDocument(), {
    timeout: 10000,
  });

  await settle(canvasElement);

  // Text, not Visual: the DPQL editor is mounted and the builder is not.
  const editable = canvasElement.querySelector(
    '.expression-field [contenteditable="true"]'
  ) as HTMLElement | null;
  expect(editable).toBeInTheDocument();
  expect(canvasElement.querySelector('.expression-field .expression')).not.toBeInTheDocument();

  /* And it holds the author's own sentence.
   *
   * Landing in Text mode with an EMPTY editor is barely better than landing in
   * the builder: what the author typed is not on screen either way, and a
   * Preview of it sitting beside an empty box reads as the text having been
   * thrown away. The AST reaches this shell one render after the mode does, so
   * this is exactly the assertion that fails when seeding only ever gets one
   * turn. */
  await waitFor(() => expect(editable?.textContent).toContain('1 + 2'), { timeout: 10000 });
};

/**
 * Accepting "Use as expression" lands in TEXT mode, and STAYS there.
 *
 * An author who typed `1 + 2` into a plain field and accepted the offer is
 * already writing in that language: `TemplateField` hands the shell
 * `defaultMode='text'` for exactly that reason. Landing them in the visual
 * builder instead makes them find their own sentence again — and the sentence
 * they typed is not shown anywhere, because the builder renders operands, not
 * text.
 *
 * The whole path is covered deliberately: the offer is the ONLY entry that
 * asks for Text mode, so a story that enters expression mode through the More
 * menu (`ToggleInFormEngine`) cannot guard it — that route never sets
 * `expressionFromText` and correctly lands on Visual.
 */
export const OfferAcceptedOpensTextMode: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Types DPQL into a plain string field, accepts the "Use as expression" offer, and asserts the expression shell opens on Text (the DPQL editor seeded with the typed text) rather than on the visual builder — and stays there once the DOM settles.',
      },
    },
  },
  render: () => {
    const [value, setValue] = useState<any>({});
    return (
      <FormEngine
        name='dpqlOfferForm'
        options={
          {
            expected: {
              type: 'string',
              ui_type: 'string',
              display_name: 'Value',
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
    await acceptTypedExpression(canvasElement);
  },
};

/**
 * The accepted offer survives a host that rebuilds the field's schema.
 *
 * A consumer form does not hand the engine one frozen schema. qorus-ide's test
 * step drawer derives the schema it passes FROM the current value — a path that
 * holds a reference is given the reference editor, a compared value is typed by
 * the path it is compared against — so the engine is handed a brand-new options
 * object on every change, including the one the accepted offer itself causes.
 *
 * The offer's whole promise is that the author keeps writing where they were
 * writing. If a re-derived schema takes that away, the promise is only kept on
 * forms simple enough not to have one, which is not the form this feature was
 * built for.
 */
export const OfferSurvivesARederivedSchema: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Repeats the accepted-offer flow against a host that rebuilds the options schema from the value on every change (as qorus-ide's step drawer does) — the Text view the offer opened must survive the churn.",
      },
    },
  },
  render: () => {
    const [value, setValue] = useState<any>({});
    // Rebuilt from the value, so its identity changes on every edit — the
    // host behaviour being modelled.
    const options = useMemo(
      () =>
        ({
          expected: {
            type: 'string',
            ui_type: 'string',
            display_name: 'Value',
            preselected: true,
            supports_expressions: true,
            expressions: mockExpressions,
          },
        }) as any,
      [value]
    );
    return (
      <FormEngine
        name='dpqlOfferChurnForm'
        options={options}
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
    await acceptTypedExpression(canvasElement);
  },
};

/**
 * The accepted offer survives the COMPACT read-first row.
 *
 * The forms this feature was built for are compact ones — qorus-ide's test step
 * drawer renders every option as a read-first row that shows a summary of what
 * the field holds and opens onto the editor. Accepting the offer is the moment
 * a field that held nothing starts holding something, so it is exactly the
 * moment that treatment changes, and the author is inside the control while it
 * does.
 */
export const OfferSurvivesACompactRow: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Repeats the accepted-offer flow in a compact (read-first) form whose schema is rebuilt from the value — the arrangement qorus-ide uses — and asserts the Text view survives it.',
      },
    },
  },
  render: () => {
    const [value, setValue] = useState<any>({});
    const options = useMemo(
      () =>
        ({
          expected: {
            type: 'string',
            ui_type: 'string',
            display_name: 'Value',
            preselected: true,
            supports_expressions: true,
            expressions: mockExpressions,
          },
        }) as any,
      [value]
    );
    return (
      <FormEngine
        name='dpqlOfferCompactForm'
        compact
        flat
        transparent
        padded={false}
        showTypeToggle={false}
        size='small'
        options={options}
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
    await openCompactRow(canvasElement);
    await acceptTypedExpression(canvasElement);
  },
};

/**
 * The Text view survives the host answering LATE about the field.
 *
 * A consumer does not settle a row's schema the moment it is drawn. qorus-ide
 * re-derives these rows from catalogues it is still fetching — the type a
 * compared value gets is read off the reference it is compared against — so the
 * type a row was OPENED with is not always the type it ends up with, and the
 * change can land a second or two after the author has already acted.
 *
 * That is the reported symptom this covers, and it is the one that made the bug
 * look intermittent rather than reproducible: clicking Text appeared to work,
 * and then a moment later the control was back on Visual with nothing on screen
 * to say why.
 */
export const TextViewSurvivesALateHostChange: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Accepts the offer in a compact row, then has the host re-type the field a moment later (as qorus-ide does when its reference catalogue answers) — the Text view must not be swapped out from under the author.",
      },
    },
  },
  render: () => {
    const [value, setValue] = useState<any>({});
    const [retyped, setRetyped] = useState(false);
    // Fires once the field is holding an expression: the host's answer lands
    // after the author has already accepted the offer.
    const isExpression = !!value?.expected?.is_expression;
    useEffect(() => {
      if (!isExpression) return undefined;
      const timer = setTimeout(() => setRetyped(true), 500);
      return () => clearTimeout(timer);
    }, [isExpression]);
    const options = useMemo(
      () =>
        ({
          expected: {
            // `auto` is one of the types a compact row opens as a CARD rather
            // than in place, so this is a re-type that moves the editor — the
            // whole point of the exercise.
            type: retyped ? 'auto' : 'string',
            ui_type: retyped ? 'auto' : 'string',
            display_name: 'Value',
            preselected: true,
            supports_expressions: true,
            expressions: mockExpressions,
          },
        }) as any,
      [retyped]
    );
    return (
      <>
        <FormEngine
          name='dpqlOfferLateForm'
          compact
          flat
          transparent
          padded={false}
          showTypeToggle={false}
          size='small'
          options={options}
          value={value}
          onChange={(_n, v) => setValue(v)}
        />
        {/* The host's answer is not otherwise visible, and the assertion has to
            wait for it rather than for a duration. */}
        <span data-testid='host-retyped'>{String(retyped)}</span>
      </>
    );
  },
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement }) {
    await openCompactRow(canvasElement);
    await acceptTypedExpression(canvasElement);

    // Wait for the host's late answer to actually land — a timeout here would
    // make the assertion a race.
    await waitFor(
      () =>
        expect(canvasElement.querySelector('[data-testid="host-retyped"]')?.textContent).toBe(
          'true'
        ),
      { timeout: 10000 }
    );
    await settle(canvasElement);

    expect(
      canvasElement.querySelector('.expression-field [contenteditable="true"]')
    ).toBeInTheDocument();
    expect(canvasElement.querySelector('.expression-field .expression')).not.toBeInTheDocument();
  },
};

/**
 * The Text editor seeds from an AST that arrives AFTER the mode flips.
 *
 * `TemplateField` passes the shell its OWN `value` prop, and on the render
 * that flips the field into expression mode that prop is still the STRING the
 * author typed — the parsed AST only comes back through the host form one
 * render later. So the shell mounts in Text mode with nothing to serialize,
 * and an effect that runs on the mode alone has already had its only turn: the
 * author gets an empty editor with a Preview of an expression sitting beside
 * it, which reads as the text having been thrown away.
 *
 * Modelled here rather than live because it is a pure ordering problem — no
 * instance, no offer, no host form. The late arrival is the whole test.
 */
export const TextModeSeedsWhenAstArrivesLate: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Mounts the shell in Text mode with a value that is not yet an AST, then delivers the AST a moment later — the DPQL editor must seed from it rather than stay empty.",
      },
    },
  },
  render: () => {
    const [value, setValue] = useState<IExpression>({
      is_expression: true,
      // What `TemplateField` actually holds at that moment: the typed text.
      value: '1 + 2' as unknown as IExpression['value'],
    });
    useEffect(() => {
      const timer = setTimeout(() => setValue(SAMPLE), 100);
      return () => clearTimeout(timer);
    }, []);
    return (
      <ExpressionField
        value={value}
        onChange={noopChange}
        defaultMode='text'
        expressions={mockExpressions}
      />
    );
  },
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement }) {
    const editable = (await waitFor(
      () => {
        const el = canvasElement.querySelector('[contenteditable="true"]');
        if (!el) throw new Error('editor not ready');
        return el as HTMLElement;
      },
      { timeout: 10000 }
    )) as HTMLElement;

    // The AST arrives late; the editor must catch up with it.
    await waitFor(
      () => {
        expect(editable.textContent).toMatch(/local:?\s*name/);
        expect(editable.textContent).toContain('John');
      },
      { timeout: 10000 }
    );
    await waitForLspIdle(canvasElement);
  },
};

/**
 * The Text view offers template completions.
 *
 * Templates are how an author names a value the surrounding interface already
 * has, and the Text view is a DPQL editor like any other: typing `$` asks the
 * language server, in position, and shows what it answers. Nothing about
 * mounting that editor inside the expression shell changes it — the shell
 * passes no template list of its own, because there is none to pass.
 *
 * Asserted here because it had never been asserted anywhere: the shell's Text
 * view had only ever been exercised for parse, serialize and type analysis, so
 * "does `$` still work in there?" was an open question with no cost to
 * answering. What this covers is the CLIENT half — that the shell surfaces
 * what the server offers. Which contexts the live Qorus server offers is its
 * own question, and this cannot answer it.
 */
export const TextModeOffersTemplateCompletions: Story = {
  args: {
    value: { is_expression: true, value: { args: [] } },
    defaultMode: 'text',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Types `$` into the shell\'s Text view — the DPQL editor asks the language server in position and the template namespaces ($data:, $config:, …) open in the completion dropdown.',
      },
    },
  },
  async beforeEach() {
    const stop = startDpqlMockLsp();
    return () => stop();
  },
  async play({ canvasElement }) {
    const editable = (await waitFor(
      () => {
        const el = canvasElement.querySelector('[contenteditable="true"]');
        if (!el) throw new Error('editor not ready');
        return el as HTMLElement;
      },
      { timeout: 10000 }
    )) as HTMLElement;

    // The editor mounting is not the language server being ready, and a `$`
    // typed before the socket is up asks nothing at all.
    await waitForLspIdle(canvasElement);
    await userEvent.click(editable);
    await userEvent.type(editable, '$');

    // The dropdown is portalled, so it is looked for in the document rather
    // than in the canvas.
    await waitFor(
      () => {
        const dropdown = document.querySelector('.reqore-menu');
        expect(dropdown).not.toBeNull();
        expect(dropdown!.textContent).toContain('$data:');
        expect(dropdown!.textContent).toContain('$config:');
      },
      { timeout: 20000 }
    );
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
 * mode against the real instance: the live "Preview" box should show the
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
          'Renders ExpressionField in Text mode against a live Qorus instance — the "Preview" box uses the server-rendered form via dpql/renderExpression rather than the client-side approximation.',
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
