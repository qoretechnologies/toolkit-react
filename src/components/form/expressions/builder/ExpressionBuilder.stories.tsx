// Ported from qorus-ide `src/stories/Components/ExpressionBuilder.stories.tsx`.
// Adaptations: import the ported builder from `./index`; drive the catalogue
// offline via `mockExpressions` (passed as the `expressions` prop) instead of a
// live server; the IDE's `_testsClickButton` / `_testsSelectItemFromCollection`
// helpers are inlined here with `@storybook/test` primitives. The count-based
// assertions (`.expression`, `.expression-and`, `.expression-or`) are preserved.
import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { sleep } from '../../../../../__tests__/utils';
import { StoryMeta } from '../../../../types';
import { mockExpressions } from '../mockExpressions';
import { IExpression } from '../types';
import { ExpressionBuilder } from './index';

// --- inlined test helpers (equivalents of the IDE `../Tests/utils`) ---------

/** Count regular expression cards (`.expression`). */
const expressionCount = () => document.querySelectorAll('.expression').length;

/** Click a ReqoreButton by visible label (anywhere in the document). */
const clickButtonByLabel = async (label: string) => {
  const body = within(document.body);
  const el = await body.findByText(label, undefined, { timeout: 10000 });
  await fireEvent.click(el);
};

/** Click a button by CSS selector. */
const clickSelector = async (selector: string, nth = 0) => {
  const els = document.querySelectorAll(selector);
  await fireEvent.click(els[nth]);
};

/** Wait for some text to appear in the document. */
const waitForText = async (text: string | RegExp) => {
  const body = within(document.body);
  await waitFor(() => expect(body.queryAllByText(text)[0]).toBeTruthy(), { timeout: 10000 });
};

/**
 * Equivalent of the IDE's `_testsSelectItemFromCollection`: open the operator
 * picker (a `Select` rendered as a button labelled `currentLabel`), then click
 * the target item in the collection modal. The picker has descriptions, so the
 * toolkit `Select` opens a `SelectFieldCollection` modal (not an inline
 * dropdown) — the item is a collection button with the display name as text.
 */
const selectOperation = async (currentLabel: string, itemLabel: string) => {
  const body = within(document.body);
  // Open the picker (placeholder when empty, or the current operation name).
  const trigger = await body.findByText(currentLabel, undefined, { timeout: 10000 });
  await fireEvent.click(trigger);
  // Click the item inside the now-open collection modal.
  const item = await waitFor(
    () => {
      const el = within(document.body).queryAllByText(itemLabel)[0];
      if (!el) throw new Error(`collection item "${itemLabel}" not ready`);
      return el;
    },
    { timeout: 10000 }
  );
  await fireEvent.click(item);
};

/** Count varargs remove-argument buttons (`.expression-remove-arg`). */
const removeArgCount = () => document.querySelectorAll('.expression-remove-arg').length;

// --- fixtures ---------------------------------------------------------------

const localTemplates = {
  label: 'Testing',
  items: [
    {
      label: 'Testing bool',
      badge: 'Test',
      items: [{ label: 'Testing bool', badge: 'bool', value: '$local:some-bool' }],
    },
    {
      label: 'Testing Richtext',
      badge: 'richtext',
      items: [{ label: 'Richtext Template', badge: 'richtext', value: '$local:some-richtext' }],
    },
  ],
} as any;

const meta = {
  component: ExpressionBuilder,
  title: 'Components/Form/Expressions/ExpressionBuilder',
  args: {
    expressions: mockExpressions,
    localTemplates,
    onChange: fn(),
  },
  render: (args) => {
    const [exp, setExp] = useState<IExpression>(args.value);

    return (
      <ExpressionBuilder
        {...args}
        value={exp}
        onChange={(value) => {
          args.onChange?.(value);
          setExp(value);
        }}
      />
    );
  },
} as StoryMeta<typeof ExpressionBuilder>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    returnType: ['string', 'int'],
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
  },
};

export const DefaultBoolean: Story = {
  args: {
    returnType: ['boolean'],
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
  },
};

export const WithSimpleValue: Story = {
  args: {
    returnType: ['string'],
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
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
  },
};

export const WithComplexValue: Story = {
  args: {
    value: {
      is_expression: true,
      value: {
        exp: '&&',
        args: [
          {
            value: {
              exp: '||',
              args: [
                {
                  value: {
                    exp: 'contains',
                    args: [
                      { type: 'string', value: '$local:input' },
                      { type: 'string', value: 'es' },
                    ],
                  },
                  is_expression: true,
                },
                {
                  value: {
                    exp: '&&',
                    args: [
                      {
                        value: {
                          exp: 'starts-with',
                          args: [
                            { type: 'string', value: 'test' },
                            { type: 'string', value: 't' },
                          ],
                        },
                        is_expression: true,
                      },
                      {
                        value: {
                          exp: 'starts-with',
                          args: [
                            { type: 'string', value: 'test' },
                            { type: 'string', value: 't' },
                          ],
                        },
                        is_expression: true,
                      },
                    ],
                  },
                  is_expression: true,
                },
                {
                  value: {
                    exp: '>=',
                    args: [
                      { type: 'int', value: 23 },
                      { type: 'string', value: '$local:id' },
                    ],
                  },
                  is_expression: true,
                },
              ],
            },
            is_expression: true,
          },
          {
            value: {
              exp: 'ends-with',
              args: [
                { type: 'string', value: '$local:str' },
                { type: 'string', value: '$local:p' },
              ],
            },
            is_expression: true,
          },
          {
            value: {
              exp: '<',
              args: [
                { type: 'int', value: '$local:input' },
                { type: 'string', value: '$local:p' },
              ],
            },
            is_expression: true,
          },
        ],
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(6), { timeout: 10000 });
  },
};

export const ShowsExplanation: Story = {
  ...WithComplexValue,
  play: async (args) => {
    await WithComplexValue.play!(args);
    await clickButtonByLabel('Explain');
    await waitFor(
      () => {
        const body = within(document.body);
        expect(body.queryAllByText(/startsWith|&&|\|\|/i).length).toBeGreaterThan(0);
      },
      { timeout: 10000 }
    );
  },
};

export const Readonly: Story = {
  ...WithComplexValue,
  args: {
    ...WithComplexValue.args,
    readOnly: true,
  },
  play: async (args) => {
    await WithComplexValue.play!(args);
    expect(document.querySelector('.expression-and')).toBeNull();
  },
};

export const FocusedEditing: Story = {
  ...WithComplexValue,
  play: async (args) => {
    await WithComplexValue.play!(args);
    await userEvent.hover(document.querySelectorAll('.expression')[0]);
    await sleep(500);
    await clickSelector('.expression-item-fullscreen', 3);
    await waitForText('Focused Editing');
  },
};

/**
 * Ported from the IDE `WithArgWithAllowedValues`: a FRESH op-select of
 * `Matches Regular Expression`, whose third arg ("Regex Options") carries
 * `element_allowed_values`. The IDE play only selects and settles; here we
 * also assert the allowed-values operand actually paints — the regression
 * this family guards (a value-less fresh op-select must render its operands).
 */
export const WithArgWithAllowedValues: Story = {
  args: {
    returnType: ['bool'],
  },
  play: async (args) => {
    await Default.play!(args);

    await selectOperation('Select operation', 'Matches Regular Expression');

    await waitForText('Regex Options');
    await waitForText('Select one or more:');
  },
};

export const WithIntType: Story = {
  args: {
    type: 'int',
    value: {
      value: {
        exp: '>=',
        args: [
          { type: 'int', value: '$local:input' },
          { type: 'int', value: 20 },
        ],
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
  },
};

/**
 * Ported from the IDE `ArgsChangeWhenOperatorChanges`: a valued
 * `String Contains` switches to a regex op and the argument row re-shapes —
 * the string args carry over (exact richtext/string matches) and the new
 * "Regex Options" allowed-values arg appears. Adaptation: the IDE switches to
 * `Does Not Match Regular Expression`; the fixture ships only the positive
 * `Matches Regular Expression`, which exercises the same arg-reshape path.
 */
export const ArgsChangeWhenOperatorChanges: Story = {
  ...WithSimpleValue,
  play: async () => {
    // Both string operands of the seeded `contains` render as textareas.
    await waitFor(
      () => expect(document.querySelectorAll('.expression .reqore-textarea')).toHaveLength(2),
      { timeout: 10000 }
    );

    await selectOperation('String Contains', 'Matches Regular Expression');

    await waitForText('Regex Options');
  },
};

export const NewGroupsCanBeCreated: Story = {
  args: {
    ...WithSimpleValue.args,
    returnType: ['bool'],
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });

    await fireEvent.click(document.querySelector('.expression-and')!);
    await waitFor(() => expect(expressionCount()).toBe(2), { timeout: 10000 });

    await fireEvent.click(document.querySelector('.expression-or')!);
    await waitFor(() => expect(expressionCount()).toBe(3), { timeout: 10000 });
  },
};

export const GroupsCanBeDeleted: Story = {
  ...WithComplexValue,
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(6), { timeout: 10000 });

    await sleep(1000);

    await userEvent.hover(document.querySelectorAll('.expression')[1]);
    await sleep(300);
    await fireEvent.click(document.querySelectorAll('.expression-group-remove')[0]);

    await waitFor(() => expect(expressionCount()).toBe(5), { timeout: 10000 });
  },
};

/**
 * The `extraActions` seam — how the IDE restores its AI-assist button when it
 * adopts this builder (Phase E). The factory runs per expression card and
 * receives that card's `selectedExpression`, exactly the context the IDE's
 * inline `AiAssistanceAction({ context: selectedExpression })` captured.
 */
export const WithInjectedExtraActions: Story = {
  args: {
    ...WithComplexValue.args,
    extraActions: ({ selectedExpression }) => [
      {
        icon: 'MagicLine',
        className: 'expression-ai-assist',
        tooltip: `AI assistance for ${selectedExpression?.display_name ?? 'this expression'}`,
        show: 'hover',
        size: 'tiny',
        fixed: true,
        onClick: fn(),
      },
    ],
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(6), { timeout: 10000 });

    // Hover actions mount on hover (same pattern as the IDE's own tests).
    await userEvent.hover(document.querySelectorAll('.expression')[0]);
    await waitFor(() =>
      expect(document.querySelector('.expression-ai-assist')).toBeInTheDocument()
    );
  },
};

// --- Variable-arguments family ----------------------------------------------
// Ported from the IDE `ExpressionWithIntReturnType` / `VariableArguments*`.
// Adaptation: the offline `+` (Addition) fixture entry stands in for the live
// catalogue's `+`. With 4 args (2 `$local:` templates + 2 int literals) the
// first arg renders inline and the 3 "rest" args each get a remove button, so
// `.expression-remove-arg` starts at 3 and the templates render two
// `.template-remove` chips.

/** Base: a `+` (Addition) varargs expression with four int operands. */
export const ExpressionWithIntReturnType: Story = {
  args: {
    type: 'int',
    returnType: 'int',
    value: {
      value: {
        exp: '+',
        args: [
          { type: 'int', value: '$local:id' },
          { type: 'int', value: 20 },
          { type: 'int', value: '$local:time' },
          { type: 'int', value: 10 },
        ],
      },
      is_expression: true,
    },
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    // Three "rest" args → three remove-argument buttons.
    await waitFor(() => expect(removeArgCount()).toBe(3), { timeout: 10000 });
  },
};

/** Remove one variable argument — the remove-arg count drops from 3 to 2. */
export const VariableArgumentsCanBeRemoved: Story = {
  ...ExpressionWithIntReturnType,
  play: async (args) => {
    await ExpressionWithIntReturnType.play!(args);

    await fireEvent.click(document.querySelector('.expression-remove-arg')!);

    await waitFor(() => expect(removeArgCount()).toBe(2), { timeout: 10000 });
  },
};

/** Remove one then add one back — the count returns to 3. */
export const VariableArgumentsCanBeAdded: Story = {
  ...ExpressionWithIntReturnType,
  play: async (args) => {
    await ExpressionWithIntReturnType.play!(args);

    await fireEvent.click(document.querySelector('.expression-remove-arg')!);
    await waitFor(() => expect(removeArgCount()).toBe(2), { timeout: 10000 });

    await fireEvent.click(document.querySelector('.expression-add-arg')!);
    await waitFor(() => expect(removeArgCount()).toBe(3), { timeout: 10000 });
  },
};

// --- Wrap / unwrap family ---------------------------------------------------
// Ported from the IDE `ExpressionCanBeWrapped` / `ExpressionCanBeUnwrapped`.
// Adaptations: (1) the offline `Convert to Boolean` (base op) and `Join List
// Elements` (wrap target) fixture entries stand in for the live catalogue.
// (2) The IDE starts from an empty `Default` and *selects* the base op fresh;
// here a valued `convert-to-boolean` is *seeded* so the story stays focused
// on its actual subject — the wrap (and unwrap) interaction. (The historical
// "fresh op-select paints an empty card" blocker was the Select collection
// modal collapsing the card panel — fixed in `SelectFormField`; fresh
// selection is covered by `WithArgWithAllowedValues` above.)

/** A seeded `Convert to Boolean` whose operand carries a template value. */
const seededConvert: IExpression = {
  is_expression: true,
  value: {
    exp: 'convert-to-boolean',
    args: [{ type: 'richtext', value: '$local:some-richtext' }],
  },
};

/** Wrap a seeded expression inside another op (Join List Elements). */
export const ExpressionCanBeWrapped: Story = {
  args: {
    returnType: ['string', 'int'],
    value: seededConvert,
  },
  play: async () => {
    // Seeded base op + its operand render.
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    await waitForText('Value To Convert');

    // Hover the card to reveal the floating "Wrap" picker, then wrap it in
    // `Join List Elements` — the wrapped op becomes its first operand and the
    // outer card shows "List To Join". The card count goes 1 → 2.
    await userEvent.hover(document.querySelectorAll('.expression')[0]);
    await sleep(500);
    await selectOperation('Wrap', 'Join List Elements');
    await waitForText('List To Join');
    await waitFor(() => expect(expressionCount()).toBe(2), { timeout: 10000 });
  },
};

/** Wrap, then unwrap — back to a single expression card. */
export const ExpressionCanBeUnwrapped: Story = {
  ...ExpressionCanBeWrapped,
  play: async (args) => {
    await ExpressionCanBeWrapped.play!(args);

    // Unwrap the outer op (keep the child) — the `.expression-unwrap` action.
    await userEvent.hover(document.querySelectorAll('.expression')[0]);
    await sleep(500);
    await clickSelector('.expression-unwrap');

    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
  },
};

// --- Mismatched-argument confirmation family (Tier B) -----------------------
// Ported from the IDE `FunctionArgs…NeedConfirmation` + its Accept-all /
// Discard-all / Confirm-selection variants. These exercise
// `ConfirmMismatchedTypesModal` and its three submit handlers
// (`updateMultipleArgs` → Discard / Accept all / Confirm selection).
//
// HOW THE MODAL FIRES: the builder flags an argument `types_mismatch: true`
// when its value's type is *accepted but not exact* for the operand schema
// (`updateExp`, builder/index.tsx ~313: `getAcceptedTypes` includes it / `any`
// but `getExactMatches` does not). The modal renders whenever any visible arg
// carries that flag (`hasArgumentsWithTypeMismatch`, index.tsx ~810).
//
// `FunctionArgsArePassedToNewFunctionAndNeedConfirmation` drives the REAL
// IDE trigger: a valued `Format Date` switches to a string op, carrying its
// `date` first arg into a `richtext` operand (accepted-but-not-exact → flag →
// modal). This op-switch used to paint an empty card offline — the Select
// collection modal's item click collapsed the card panel (fixed in
// `SelectFormField`) — which is why the three handler variants below SEED the
// `types_mismatch` flag instead: their subject is the modal's three submit
// handlers, and seeding keeps each handler test single-step deterministic.

/**
 * A seeded `String Contains` whose first arg is flagged `types_mismatch` — the
 * accepted-but-not-exact state the builder produces when an op-switch passes an
 * incompatible arg into a new function. The deterministic precondition for the
 * three submit-handler variants; the real op-switch trigger is exercised by
 * `FunctionArgsArePassedToNewFunctionAndNeedConfirmation`.
 */
const seededMismatch: IExpression = {
  is_expression: true,
  value: {
    exp: 'contains',
    args: [
      { type: 'string', value: '$local:input', is_expression: false, required: true, types_mismatch: true },
      { type: 'string', value: 'es', is_expression: false, required: true },
      { type: 'bool', value: true, is_expression: false, required: true },
    ],
  },
};

/** Seeded-modal base for the three submit-handler variants (not exported). */
const SeededMismatchBase: Story = {
  args: {
    returnType: ['string', 'int'],
    value: seededMismatch,
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    // The modal mounts with its title and per-argument transform copy.
    await waitForText('Confirm type selection for mismatched arguments');
    await waitForText(/will be transformed|deselect the arguments/i);
  },
};

/**
 * The REAL trigger, IDE-parity (`ExpressionBuilder.stories` line 592 family):
 * a valued `Format Date` is switched to `Matches Regular Expression`, whose
 * first operand is `richtext` — the carried `date` arg is accepted-but-not-
 * exact, so the builder flags it and the confirmation modal mounts.
 */
export const FunctionArgsArePassedToNewFunctionAndNeedConfirmation: Story = {
  args: {
    returnType: 'string',
    value: {
      is_expression: true,
      type: 'string',
      value: {
        exp: 'format_date',
        args: [
          {
            type: 'date',
            value: '2025-11-05T23:00:00.000Z',
            is_expression: false,
            required: true,
          },
          {
            type: 'richtext',
            value: [{ type: 'paragraph', children: [{ text: 'YYYY-MM-DD' }] }],
            is_expression: false,
            required: true,
          },
        ],
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    await waitForText('Date To Format');

    await selectOperation('Format Date', 'Matches Regular Expression');

    await waitForText('Confirm type selection for mismatched arguments');
  },
};

/** "Confirm selection" keeps the (still-selected) mismatched arg, transformed. */
export const AcceptIncompatibleFunctionArgsSelection: Story = {
  ...SeededMismatchBase,
  play: async (args) => {
    await SeededMismatchBase.play!(args);

    await sleep(500);
    await clickButtonByLabel('Confirm selection');
    // Modal dismissed; one card remains.
    await waitFor(
      () =>
        expect(
          within(document.body).queryByText('Confirm type selection for mismatched arguments')
        ).toBeNull(),
      { timeout: 10000 }
    );
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
  },
};

/** "Accept all" — every mismatched arg is transformed and kept. */
export const AcceptAllIncompatibleFunctionArgs: Story = {
  ...SeededMismatchBase,
  play: async (args) => {
    await SeededMismatchBase.play!(args);

    await sleep(500);
    await clickButtonByLabel('Accept all');
    await waitFor(
      () =>
        expect(
          within(document.body).queryByText('Confirm type selection for mismatched arguments')
        ).toBeNull(),
      { timeout: 10000 }
    );
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
  },
};

/** "Discard all" — every mismatched arg is cleared. */
export const DiscardAllIncompatibleFunctionArgs: Story = {
  ...SeededMismatchBase,
  play: async (args) => {
    await SeededMismatchBase.play!(args);

    await sleep(500);
    await clickButtonByLabel('Discard all');
    await waitFor(
      () =>
        expect(
          within(document.body).queryByText('Confirm type selection for mismatched arguments')
        ).toBeNull(),
      { timeout: 10000 }
    );
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
  },
};
