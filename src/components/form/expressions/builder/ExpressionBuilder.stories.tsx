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
const expressionCount = (scope: ParentNode = document) =>
  scope.querySelectorAll('.expression').length;

/** Click a ReqoreButton by visible label (anywhere in the document). */
const clickButtonByLabel = async (label: string) => {
  const body = within(document.body);
  const el = await body.findByText(label, undefined, { timeout: 10000 });
  await fireEvent.click(el);
};

/** Click a button by CSS selector. */
const clickSelector = async (selector: string, nth = 0, scope: ParentNode = document) => {
  const els = scope.querySelectorAll(selector);
  await fireEvent.click(els[nth]);
};

/** Wait for some text to appear in the document. */
const waitForText = async (text: string | RegExp, scope: HTMLElement = document.body) => {
  const body = within(scope);
  await waitFor(() => expect(body.queryAllByText(text)[0]).toBeTruthy(), { timeout: 10000 });
};

/**
 * Equivalent of the IDE's `_testsSelectItemFromCollection`: open the operator
 * picker (a `Select` rendered as a button labelled `currentLabel`), then click
 * the target item in the collection modal. The picker has descriptions, so the
 * toolkit `Select` opens a `SelectFieldCollection` modal (not an inline
 * dropdown) — the item is a collection button with the display name as text.
 */
const selectOperation = async (
  currentLabel: string,
  itemLabel: string,
  ownerDocument: Document = document
) => {
  const body = within(ownerDocument.body);
  // Open the picker (placeholder when empty, or the current operation name).
  const trigger = await body.findByText(currentLabel, undefined, { timeout: 10000 });
  await fireEvent.click(trigger);
  // Click the item inside the now-open collection modal.
  const item = await waitFor(
    () => {
      const el = within(ownerDocument.body).queryAllByText(itemLabel)[0];
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ExpressionBuilder with no value and a string-or-int return type — a single empty expression card is shown so the operator can pick an operation.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(expressionCount(canvasElement)).toBe(1), { timeout: 10000 });
  },
};

export const DefaultBoolean: Story = {
  args: {
    returnType: ['boolean'],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ExpressionBuilder with no value and a boolean return type — a single empty expression card is shown so the operator can pick a boolean-returning operation.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ExpressionBuilder holding a single "contains" expression with three arguments — the card shows the operation and each operand slot.',
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ExpressionBuilder holding a nested &&/|| expression with six leaf expressions — the builder shows the full expression tree with the AND/OR group cards and their operand cards.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(6), { timeout: 10000 });
  },
};

export const ShowsExplanation: Story = {
  ...WithComplexValue,
  parameters: {
    ...WithComplexValue.parameters,
    docs: {
      description: {
        story:
          'Renders the nested expression tree and clicks Explain — the plain-language explanation of the whole expression is shown alongside the builder.',
      },
    },
  },
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
  parameters: {
    ...WithComplexValue.parameters,
    docs: {
      description: {
        story:
          'Renders the nested expression tree with readOnly enabled — the tree is visible but the AND/OR add-group controls are hidden so the operator cannot mutate it.',
      },
    },
  },
  play: async (args) => {
    await WithComplexValue.play!(args);
    expect(document.querySelector('.expression-and')).toBeNull();
  },
};

export const FocusedEditing: Story = {
  ...WithComplexValue,
  parameters: {
    ...WithComplexValue.parameters,
    docs: {
      description: {
        story:
          'Renders the nested expression tree, hovers a card and clicks its fullscreen action — the focused-editing modal opens over that subtree.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders an empty ExpressionBuilder and selects "Matches Regular Expression" — the third operand ("Regex Options") carries element_allowed_values and renders the "Select one or more" picker.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ExpressionBuilder with an int-typed >= expression comparing $local:input to 20 — the operands render as Number fields inside the expression card.',
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
  parameters: {
    ...WithSimpleValue.parameters,
    docs: {
      description: {
        story:
          'Renders the seeded "String Contains" expression, then switches the operation to "Matches Regular Expression" — the string operands carry over and the new "Regex Options" allowed-values operand appears.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the seeded "String Contains" expression, then clicks the AND and OR add-group actions — the tree grows from 1 to 3 expression cards as new grouping levels are added.',
      },
    },
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
  parameters: {
    ...WithComplexValue.parameters,
    docs: {
      description: {
        story:
          'Renders the nested expression tree (6 cards) and removes one group — the tree shrinks to 5 cards after the delete.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the nested expression tree with an extraActions factory that injects an AI-assist button per card. Hovering an expression reveals the injected action alongside the built-in ones.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ExpressionBuilder with a "+" (Addition) varargs expression holding four int operands — the three "rest" args each expose a remove-argument button.',
      },
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
  parameters: {
    ...ExpressionWithIntReturnType.parameters,
    docs: {
      description: {
        story:
          'Renders the "+" varargs expression and clicks one remove-argument button — one operand disappears and the remove-arg count drops from 3 to 2.',
      },
    },
  },
  play: async (args) => {
    await ExpressionWithIntReturnType.play!(args);

    await fireEvent.click(document.querySelector('.expression-remove-arg')!);

    await waitFor(() => expect(removeArgCount()).toBe(2), { timeout: 10000 });
  },
};

/** Remove one then add one back — the count returns to 3. */
export const VariableArgumentsCanBeAdded: Story = {
  ...ExpressionWithIntReturnType,
  parameters: {
    ...ExpressionWithIntReturnType.parameters,
    docs: {
      description: {
        story:
          'Renders the "+" varargs expression, removes one operand and then adds one back — the remove-arg count moves 3 → 2 → 3.',
      },
    },
  },
  play: async (args) => {
    await ExpressionWithIntReturnType.play!(args);

    await fireEvent.click(document.querySelector('.expression-remove-arg')!);
    await waitFor(() => expect(removeArgCount()).toBe(2), { timeout: 10000 });

    await fireEvent.click(document.querySelector('.expression-add-arg')!);
    await waitFor(() => expect(removeArgCount()).toBe(3), { timeout: 10000 });
  },
};

// --- Varargs reorder family -------------------------------------------------
// Toolkit-only (no IDE counterpart): a varargs expression lets the user move
// its operands. `reorder` picks the surface — the field's ⋮ menu by default,
// a drag grip and/or a position dropdown on request. Seeded on `concat` so
// the operand order is readable.

const CONCAT_OPERANDS = ['first', 'second', 'third'];
const OPERAND_LITERALS = [...CONCAT_OPERANDS, 'plain', '$local:some-richtext'];

/** Seeded operand values in DOM order — only the seeded ones, so stray fields don't count. */
const operandValues = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      '.expression textarea, .expression input'
    )
  )
    .map((field) => field.value)
    .filter((value) => OPERAND_LITERALS.includes(value));

const count = (selector: string) => document.querySelectorAll(selector).length;

/** Open the `⋮` menu of the nth operand field and expand its "Move Argument" section. */
const openMoveMenu = async (nth: number) => {
  await clickSelector('.template-more', nth);
  await waitForText('Move Argument');
  // The section's className lands on its toggle button.
  await clickSelector('.template-menu-actions');
};

/** Open the `⋮` menu of the nth operand field. */
const openFieldMenu = (nth: number) => clickSelector('.template-more', nth);

const waitForOrder = (order: string[]) =>
  waitFor(() => expect(operandValues()).toEqual(order), { timeout: 10000 });

const expectReportedOrder = (context: { args: { onChange?: unknown } }, order: string[]) =>
  expect(context.args.onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      value: expect.objectContaining({
        exp: 'concat',
        args: order.map((value) => ({ type: 'string', value })),
      }),
    })
  );

const concatArgs: Story['args'] = {
  type: 'string',
  returnType: 'string',
  value: {
    value: {
      exp: 'concat',
      args: CONCAT_OPERANDS.map((value) => ({ type: 'string', value })),
    },
    is_expression: true,
  },
};

/** Base: a `concat` varargs expression with three string operands, default reorder surface. */
export const ConcatExpression: Story = {
  args: concatArgs,
  parameters: {
    docs: {
      description: {
        story:
          'Renders a "concat" varargs expression with three string operands ("first", "second", "third"). The default reorder surface is a "Move Argument" section in each operand\'s ⋮ menu — opened and expanded here on the second operand to show its "Move earlier / later / to start / to end" rows.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    await waitForOrder(CONCAT_OPERANDS);
    expect(removeArgCount()).toBe(2);
    expect(count('.expression-arg-drag-handle')).toBe(0);
    expect(count('.expression-arg-position')).toBe(0);

    await openMoveMenu(1);
    await waitForText('Move earlier');
    expect(count('.expression-arg-move-later')).toBe(1);
    expect(count('.expression-arg-move-start')).toBe(1);
    expect(count('.expression-arg-move-end')).toBe(1);
  },
};

/** Reorder through the ⋮ menu — "Move to start" then "Move later". */
export const ReorderViaOverflowMenu: Story = {
  ...ConcatExpression,
  parameters: {
    ...ConcatExpression.parameters,
    docs: {
      description: {
        story:
          'Renders the "concat" expression and reorders it through the ⋮ menus\' "Move Argument" section: "Move to start" on the third operand, then "Move later" on the operand that is now second — the order goes first/second/third → third/first/second → third/second/first, each move closes its menu, and onChange reports the reordered args.',
      },
    },
  },
  play: async (context) => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    await waitForOrder(CONCAT_OPERANDS);

    await openMoveMenu(2);
    await waitForText('Move to start');
    await clickSelector('.expression-arg-move-start');
    await waitForOrder(['third', 'first', 'second']);
    // A move closes the menu it came from.
    await waitFor(() => expect(count('.expression-arg-move-start')).toBe(0), { timeout: 10000 });

    await openMoveMenu(1);
    await waitForText('Move later');
    await clickSelector('.expression-arg-move-later');
    await waitForOrder(['third', 'second', 'first']);

    expectReportedOrder(context, ['third', 'second', 'first']);
  },
};

/** `reorder: ['dragHandle']` — a grip before each operand, no menu rows. */
export const ReorderViaDragHandle: Story = {
  args: { ...concatArgs, reorder: ['dragHandle'] },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the "concat" expression with a drag grip before each operand and no "Move Argument" section in the ⋮ menu. Dragging the third operand onto the first puts it first — the order becomes third/first/second.',
      },
    },
  },
  play: async (context) => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    await waitForOrder(CONCAT_OPERANDS);
    expect(count('.expression-arg-drag-handle')).toBe(3);
    expect(count('.expression-arg-position')).toBe(0);

    await openFieldMenu(1);
    await waitForText('Use Template');
    expect(count('.template-menu-actions')).toBe(0);

    const handles = document.querySelectorAll('.expression-arg-drag-handle');
    const target = handles[0].closest('.expression-arg')!;
    expect(handles[2].getAttribute('draggable')).toBe('true');
    await fireEvent.dragStart(handles[2]);
    await fireEvent.dragOver(target);
    await fireEvent.drop(target);
    await fireEvent.dragEnd(handles[2]);

    await waitForOrder(['third', 'first', 'second']);
    expectReportedOrder(context, ['third', 'first', 'second']);
  },
};

/** A template operand moved past a literal: each field shows the operand now in its slot. */
export const ReorderKeepsTemplateOperand: Story = {
  args: {
    ...concatArgs,
    value: {
      value: {
        exp: 'concat',
        args: [
          { type: 'string', value: '$local:some-richtext' },
          { type: 'string', value: 'plain' },
        ],
      },
      is_expression: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a "concat" whose first operand is the template reference "$local:some-richtext" and whose second is the literal "plain". "Move to end" on the template operand swaps them — the literal now sits first and the reference second, each in its own field, and nothing shows the reference twice.',
      },
    },
  },
  play: async (context) => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    await waitForOrder(['$local:some-richtext', 'plain']);

    await openMoveMenu(0);
    await waitForText('Move to end');
    await clickSelector('.expression-arg-move-end');

    // Without remounting the slots, slot 0 would keep its template state and
    // still show the reference while the literal showed nowhere.
    await waitForOrder(['plain', '$local:some-richtext']);
    expect(context.args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: expect.objectContaining({
          exp: 'concat',
          args: [
            { type: 'string', value: 'plain' },
            { type: 'string', value: '$local:some-richtext' },
          ],
        }),
      })
    );
  },
};

/** `reorder: ['positionPicker']` — an ordinal dropdown before each operand. */
export const ReorderViaPositionPicker: Story = {
  args: { ...concatArgs, reorder: ['positionPicker'] },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the "concat" expression with each operand\'s position ("1st", "2nd", "3rd") as a dropdown before its field. Picking "1st" on the third operand moves it to the front — the order becomes third/first/second.',
      },
    },
  },
  play: async (context) => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    await waitForOrder(CONCAT_OPERANDS);
    expect(count('.expression-arg-position')).toBe(3);
    expect(count('.expression-arg-drag-handle')).toBe(0);

    await clickSelector('.expression-arg-position', 2);
    // The open list adds a second "1st" — the first is the first operand's own trigger.
    await waitFor(() => expect(within(document.body).queryAllByText('1st').length).toBe(2), {
      timeout: 10000,
    });
    const items = within(document.body).queryAllByText('1st');
    await fireEvent.click(items[items.length - 1]);

    await waitForOrder(['third', 'first', 'second']);
    expectReportedOrder(context, ['third', 'first', 'second']);
  },
};

/** Every surface at once. */
export const ReorderAllSurfaces: Story = {
  args: { ...concatArgs, reorder: ['overflowMenu', 'dragHandle', 'positionPicker'] },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the "concat" expression with every reorder surface at once — a drag grip and a position dropdown before each operand, plus the "Move Argument" section in the ⋮ menu, opened and expanded on the second operand.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    await waitForOrder(CONCAT_OPERANDS);
    expect(count('.expression-arg-drag-handle')).toBe(3);
    expect(count('.expression-arg-position')).toBe(3);

    await openMoveMenu(1);
    await waitForText('Move earlier');
  },
};

/** `reorder: false` — nothing but the remove buttons. */
export const ReorderDisabled: Story = {
  args: { ...concatArgs, reorder: false },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the "concat" expression with reordering turned off — no grip, no position dropdown, and the ⋮ menu (opened on the second operand) has no "Move Argument" section; only the remove buttons remain.',
      },
    },
  },
  play: async () => {
    await waitFor(() => expect(expressionCount()).toBe(1), { timeout: 10000 });
    await waitForOrder(CONCAT_OPERANDS);
    expect(removeArgCount()).toBe(2);
    expect(count('.expression-arg-drag-handle')).toBe(0);
    expect(count('.expression-arg-position')).toBe(0);

    await openFieldMenu(1);
    await waitForText('Use Template');
    expect(count('.template-menu-actions')).toBe(0);
  },
};

/** Phone width: the operands stack, the ⋮ menu still carries the move rows. */
export const ReorderOnPhone: Story = {
  args: { ...concatArgs, reorder: ['overflowMenu', 'dragHandle', 'positionPicker'] },
  parameters: {
    qlip: { viewport: { width: 390, height: 844 } },
    docs: {
      description: {
        story:
          'Renders the phone presentation of the "concat" expression with every reorder surface — the operands stack into a column, each keeps its grip and position dropdown, and the ⋮ menu (opened and expanded on the second operand) still carries the "Move Argument" section, so reordering needs no hover or drag.',
      },
    },
  },
  play: ReorderAllSurfaces.play,
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a seeded "Convert to Boolean" expression, hovers the card and picks "Join List Elements" from the Wrap picker — the outer op mounts and the original expression becomes its first operand.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // Seeded base op + its operand render.
    await waitFor(() => expect(expressionCount(canvasElement)).toBe(1), { timeout: 10000 });
    await waitForText('Value To Convert', canvasElement);

    // Hover the card to reveal the floating "Wrap" picker, then wrap it in
    // `Join List Elements` — the wrapped op becomes its first operand and the
    // outer card shows "List To Join". The card count goes 1 → 2.
    await userEvent.hover(canvasElement.querySelectorAll('.expression')[0]);
    await sleep(500);
    await selectOperation('Wrap', 'Join List Elements', canvasElement.ownerDocument);
    await waitForText('List To Join', canvasElement);
    await waitFor(() => expect(expressionCount(canvasElement)).toBe(2), { timeout: 10000 });
  },
};

/** Wrap, then unwrap — back to a single expression card. */
export const ExpressionCanBeUnwrapped: Story = {
  ...ExpressionCanBeWrapped,
  parameters: {
    ...ExpressionCanBeWrapped.parameters,
    docs: {
      description: {
        story:
          'Renders the wrapped expression from ExpressionCanBeWrapped, then hovers and unwraps the outer op — the inner "Convert to Boolean" survives and the outer wrapper is removed.',
      },
    },
  },
  play: async (args) => {
    await ExpressionCanBeWrapped.play!(args);

    // Unwrap the outer op (keep the child) — the `.expression-unwrap` action.
    await userEvent.hover(args.canvasElement.querySelectorAll('.expression')[0]);
    await sleep(500);
    // The card's actions are ReQore *floating* actions, so they are portalled out
    // of the canvas — this one lookup stays document-scoped on purpose.
    await clickSelector('.expression-unwrap');

    await waitFor(() => expect(expressionCount(args.canvasElement)).toBe(1), { timeout: 10000 });
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders a valued "Format Date" expression and switches the operation to "Matches Regular Expression" — the carried date arg is accepted-but-not-exact for the new richtext operand and the mismatched-arguments confirmation modal mounts.',
      },
    },
  },
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
  parameters: {
    ...SeededMismatchBase.parameters,
    docs: {
      description: {
        story:
          'Renders the seeded mismatch-flagged expression, then clicks "Confirm selection" on the mismatched-arguments modal — the (still-selected) argument is kept and transformed to the new expected type.',
      },
    },
  },
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
  parameters: {
    ...SeededMismatchBase.parameters,
    docs: {
      description: {
        story:
          'Renders the seeded mismatch-flagged expression, then clicks "Accept all" on the mismatched-arguments modal — every flagged argument is transformed and kept.',
      },
    },
  },
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
  parameters: {
    ...SeededMismatchBase.parameters,
    docs: {
      description: {
        story:
          'Renders the seeded mismatch-flagged expression, then clicks "Discard all" on the mismatched-arguments modal — every flagged argument is cleared.',
      },
    },
  },
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
