// Copyright 2026 Qore Technologies, s.r.o.
// Text typed into a PLAIN field that is really a DPQL expression.
//
// Every assertion here is about the value the field STORES, never about what
// the expression editor happens to be showing. Inside a single mount nothing
// re-reads the stored value, so a DOM-only assertion would pass just as
// happily against a field that stored nothing at all.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const probe = vi.fn();

vi.mock('../src/components/dpqlEditor/useDpqlProbe', () => ({
  useDpqlProbe: () => probe,
}));

import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/** What the live server returns for a real expression. */
const expressionResult = (exp: string) => ({
  success: true,
  expression: { is_expression: true, value: { exp, args: [{ type: 'int', value: 5 }] } },
  diagnostics: [],
});

/** What the live server returns for ordinary text — note `success: true`. */
const literalResult = (value: string) => ({
  success: true,
  expression: { is_expression: true, value: { exp: 'value', args: [{ type: 'string', value }] } },
  diagnostics: [],
});

/**
 * Renders a plain, expression-capable field and drives it the way an author
 * does: by typing. `value` is fed back in, as a real form does, so the
 * component sees the text it was given.
 */
const renderTypedField = async (
  text: string,
  props: Record<string, unknown> = {}
): Promise<ReturnType<typeof vi.fn>> => {
  const onChange = vi.fn();

  const Harness = () => {
    const [value, setValue] = useState<any>(undefined);

    return (
      <TemplateField
        name='opt'
        aria-label='Option'
        value={value}
        type='string'
        // `AutoFormField` picks its editor from `defaultType`, so a field
        // that declares only `type` renders the type PICKER, not an input.
        defaultType={(props.type as string) ?? 'string'}
        allowFunctions
        allowTextExpressions
        allowTemplates={false}
        onChange={(name: string, val: any, type?: any, isFunction?: boolean) => {
          onChange(name, val, type, isFunction);
          setValue(val);
        }}
        {...props}
      />
    );
  };

  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as any}>
        <Harness />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

  // A string field renders a textarea and a number field an `input[number]`
  // (role `spinbutton`), so ask for the editor rather than for a role.
  const input = await waitFor(() => {
    const editor = document.querySelector('textarea, input');

    if (!editor) {
      throw new Error('field editor did not render');
    }

    return editor as HTMLElement;
  });
  await userEvent.type(input, text);

  return onChange;
};

/** The "Use as expression" button, or `null` when nothing is being offered. */
const offer = (): Element | null => document.querySelector('.dpql-detected-offer');

const findOffer = (): Promise<Element> =>
  waitFor(() => {
    const button = offer();

    if (!button) {
      throw new Error('no offer rendered');
    }

    return button;
  });

/** The stored value from the most recent expression-mode `onChange`. */
const storedExpression = (onChange: ReturnType<typeof vi.fn>): any =>
  onChange.mock.calls.filter((call) => call[3] === true).slice(-1)[0]?.[1];

beforeEach(() => {
  probe.mockReset();
});

describe('DPQL typed into a plain field', () => {
  it('never asks the server about ordinary prose', async () => {
    probe.mockResolvedValue(literalResult('hello world'));

    await renderTypedField('hello world');

    // Give the debounce more than its window to fire.
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(probe).not.toHaveBeenCalled();
  });

  it('leaves text alone when the server says it is only a literal', async () => {
    probe.mockResolvedValue(literalResult('a > b'));

    const onChange = await renderTypedField('a > b');

    await waitFor(() => expect(probe).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(storedExpression(onChange)).toBeUndefined();
    expect(offer()).toBeNull();
  });

  it('OFFERS, and stores nothing, when the text is also a valid literal here', async () => {
    probe.mockResolvedValue(expressionResult('+'));

    const onChange = await renderTypedField('a + b');

    // The offer appears...
    expect(await findOffer()).toBeTruthy();
    // ...and until it is taken, the field still holds the author's text.
    expect(storedExpression(onChange)).toBeUndefined();
    expect(onChange.mock.calls.slice(-1)[0][1]).toBe('a + b');

    await userEvent.click(offer() as HTMLElement);

    // Only now is the expression stored, and with the expression flag set.
    await waitFor(() => expect(storedExpression(onChange)).toEqual({
      exp: '+',
      args: [{ type: 'int', value: 5 }],
    }));
  });

  it('keeps the literal when the offer is dismissed, and does not ask again', async () => {
    probe.mockResolvedValue(expressionResult('+'));

    const onChange = await renderTypedField('a + b');

    await findOffer();
    await userEvent.click(document.querySelector('.dpql-detected-dismiss') as HTMLElement);

    await waitFor(() => expect(offer()).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(offer()).toBeNull();
    expect(storedExpression(onChange)).toBeUndefined();
  });

  it('SWITCHES when the text cannot be a literal of the field type', async () => {
    probe.mockResolvedValue(expressionResult('>'));

    // A name field: its editor takes any text, but `@a > 5` is not a legal
    // identifier, so it was already an invalid value the moment it landed.
    const onChange = await renderTypedField('@a > 5', { has_to_be_valid_identifier: true });

    await waitFor(() =>
      expect(storedExpression(onChange)).toEqual({
        exp: '>',
        args: [{ type: 'int', value: 5 }],
      })
    );
    // Nothing to accept — it already happened.
    expect(offer()).toBeNull();
  });

  it('SWITCHES on a typed field whose editor takes free text', async () => {
    probe.mockResolvedValue(expressionResult('>'));

    const onChange = await renderTypedField('@a > 5', { type: 'binary' });

    await waitFor(() =>
      expect(storedExpression(onChange)).toEqual({
        exp: '>',
        args: [{ type: 'int', value: 5 }],
      })
    );
  });

  it('makes the switch undoable, restoring the exact text', async () => {
    probe.mockResolvedValue(expressionResult('>'));

    const onChange = await renderTypedField('@a > 5', { has_to_be_valid_identifier: true });

    await waitFor(() => expect(storedExpression(onChange)).toBeTruthy());

    await userEvent.click(document.querySelector('.dpql-detected-undo') as HTMLElement);

    await waitFor(() => {
      const last = onChange.mock.calls.slice(-1)[0];
      expect(last[1]).toBe('@a > 5');
      expect(last[3]).toBe(false);
    });
  });

  it('never sees expression text on a numeric field, whose editor filters it out', async () => {
    // Not a gap to fix here: `int` and `float` render `input[type=number]`,
    // which drops `@`, `>` and spaces before any handler runs. Detection on
    // those types is therefore unreachable BY DESIGN of the editor, and the
    // expression affordance in the ⋮ menu is the way in. Pinned so that a
    // future editor change that starts passing raw text through is noticed.
    probe.mockResolvedValue(expressionResult('>'));

    const onChange = await renderTypedField('@a > 5', { type: 'int' });

    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(probe).not.toHaveBeenCalled();
    expect(storedExpression(onChange)).toBeUndefined();
    // Only the digits survived the number input.
    expect(onChange.mock.calls.slice(-1)[0]?.[1]).toBe(5);
  });

  it('does not detect on a field that cannot hold an expression', async () => {
    probe.mockResolvedValue(expressionResult('>'));

    await renderTypedField('@a > 5', { type: 'int', allowFunctions: false });

    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(probe).not.toHaveBeenCalled();
  });

  it('offers a template reference carrying an operator instead of swallowing it', async () => {
    // `$local:count + 1` starts with `$` and holds a colon, so the loose
    // template check claims it — leaving the arithmetic as dead text in a
    // template chip that no affordance could reach.
    probe.mockResolvedValue(expressionResult('+'));

    const onChange = await renderTypedField('$local:count + 1', { allowTemplates: true });

    expect(await findOffer()).toBeTruthy();

    await userEvent.click(offer() as HTMLElement);

    await waitFor(() => expect(storedExpression(onChange)).toEqual({
      exp: '+',
      args: [{ type: 'int', value: 5 }],
    }));
  });
});
