// Copyright 2026 Qore Technologies, s.r.o.
// Which type-fit message an expression earns — from the whole analysis.
//
// The server answers three things about fitting a field: whether the types
// match (`type_compatible`), whether a conversion exists (`auto_coercible`),
// and whether that conversion can fail on the day (`coercion_may_fail`). The
// field read only the first, so a number used as text — a conversion that
// always works — was reported in red as "This does not fit", the very noise the
// message's own rule exists to prevent. The story mock never answered with that
// combination, so no story could show it.
//
// Every analysis below is what the Qorus `/lsp` handler returned for the text.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

let parseResult: Record<string, unknown> = {};
let parseCalls = 0;
/** what each parse asked: the target type, and whether it asked about a condition */
let parseAsked: { targetType?: string; condition?: boolean }[] = [];

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ onChange, readOnly, value, onReady }, ref) => {
    // a session that is up: the field reads and writes its text through it from the start
    useEffect(() => {
      onReady?.();
    }, []);
    useImperativeHandle(
      ref,
      () => ({
        parse: async (_text: string, targetType?: string, options?: { condition?: boolean }) => {
          parseCalls++;
          parseAsked.push({ targetType, condition: options?.condition });
          return parseResult;
        },
      }),
      []
    );
    /* A READ-ONLY instance is a rendering (`DpqlRendering`: the Preview, the
       suggested conversion), not the editor under test — draw its text. */
    if (readOnly) {
      return <span data-testid='fake-dpql-rendering'>{value}</span>;
    }
    return (
      <textarea
        data-testid='fake-dpql'
        onChange={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      />
    );
  }),
}));

import { ExpressionField } from '../src/components/form/expressions/ExpressionField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const analysedAs = (
  type: string,
  text: string,
  analysis: Record<string, unknown>,
  condition?: boolean
) => {
  parseCalls = 0;
  parseAsked = [];
  parseResult = {
    success: true,
    expression: { is_expression: true, value: { exp: '+', args: [] } },
    diagnostics: [],
    ...analysis,
  };
  const Harness = () => {
    const [value, setValue] = useState<any>({ is_expression: true, value: { args: [] } });
    return (
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <ExpressionField
            value={value}
            onChange={(v) => setValue(v)}
            type={type}
            condition={condition}
            defaultMode='text'
            expressions={[]}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
  };
  const view = render(<Harness />);
  return {
    ...view,
    type: async () => fireEvent.change(await screen.findByTestId('fake-dpql'), { target: { value: text } }),
  };
};

/* Settled once the analysis has been asked for and a render has passed — the
   absence cases would otherwise pass before the answer arrived.

   The second half used to be a 50ms sleep. That is a bet that a render fits in
   50ms of WALL CLOCK, which is true on an idle machine and not inside a loaded
   143-file run — the shape that makes a test pass alone and fail in the suite.
   `act` flushes the pending effects and microtasks instead, which is the thing
   the sleep was approximating, and it takes exactly as long as the work does. */
const settle = async () => {
  await waitFor(() => expect(parseCalls).toBeGreaterThan(0), { timeout: 5000 });
  await act(async () => {});
};

describe('the type-fit message', () => {
  it('says nothing when the conversion always works (a number used as text)', async () => {
    const { container, type } = analysedAs('string', '1 + 2', {
      inferred_type: 'int',
      target_type: 'string',
      type_compatible: false,
      auto_coercible: true,
      coercion_may_fail: false,
      suggested_fix: { text: 'toString(1 + 2)' },
    });
    await type();
    await settle();

    expect(container.textContent).not.toContain('This does not fit');
    expect(container.textContent).not.toContain('This may not fit');
    expect(container.querySelector('[data-testid="expression-type-fix"]')).toBeNull();
  });

  it('warns, with the conversion, when it may fail (text used as a number)', async () => {
    const { container, type } = analysedAs('int', '"a" + 1', {
      inferred_type: 'string',
      target_type: 'int',
      type_compatible: false,
      auto_coercible: true,
      coercion_may_fail: true,
      suggested_fix: { text: 'toInt("a" + 1)' },
    });
    await type();

    await waitFor(() => expect(container.textContent).toContain('This may not fit'), { timeout: 5000 });
    expect(container.textContent).not.toContain('This does not fit');
    expect(container.querySelector('[data-testid="expression-type-fix"]')?.textContent).toContain(
      'toInt("a" + 1)'
    );
  });

  it('reports a result that cannot become the field type at all', async () => {
    const { container, type } = analysedAs('hash', '1 + 2', {
      inferred_type: 'int',
      target_type: 'hash',
      type_compatible: false,
      auto_coercible: false,
      coercion_may_fail: false,
    });
    await type();

    await waitFor(() => expect(container.textContent).toContain('This does not fit'), { timeout: 5000 });
    expect(container.textContent).toContain('The expression returns int, and this field holds hash.');
    expect(container.querySelector('[data-testid="expression-type-fix"]')).toBeNull();
  });

  /* A condition (a field its host marks as one) is not a type to fit (qorus#646): the server reads it as
     true unless its value is zero or empty. The field asks how the server reads it (`condition: true`, no
     target type) and says what it answers, in the server's words when it gave them; a server that does
     not know the question answers with the inferred type alone, which is read the same way. */
  it('asks the server how it reads a condition, not whether it fits bool', async () => {
    const { type } = analysedAs('bool', '1 + 2', { inferred_type: 'int' }, true);
    await type();
    await settle();
    expect(parseAsked).toEqual([{ targetType: 'bool', condition: true }]);
  });

  it("says of a condition that gives a number what the server says of it", async () => {
    const { container, type } = analysedAs(
      'bool',
      '1 + 2',
      {
        inferred_type: 'int',
        target_type: 'bool',
        condition_reading: 'truthiness',
        type_compatible: false,
        auto_coercible: true,
        coercion_may_fail: true,
        diagnostics: [{ code: 'CONDITION_BY_TRUTHINESS', message: 'Wahr, solange der Wert nicht null ist.' }],
      },
      true
    );
    await type();

    await waitFor(() => expect(container.textContent).toContain('Wahr, solange der Wert nicht null ist.'), {
      timeout: 5000,
    });
    expect(container.textContent).not.toContain('This may not fit');
    expect(container.textContent).not.toContain('This does not fit');
  });

  it('refuses a condition that gives text, and says to compare it explicitly', async () => {
    const { container, type } = analysedAs(
      'bool',
      '"a" + 1',
      {
        inferred_type: 'string',
        target_type: 'bool',
        condition_reading: 'not_a_condition',
        type_compatible: false,
        auto_coercible: false,
        coercion_may_fail: false,
        diagnostics: [],
      },
      true
    );
    await type();

    await waitFor(() => expect(container.textContent).toContain("A condition can't give string"), {
      timeout: 5000,
    });
    expect(container.textContent).not.toContain('This does not fit');
  });

  it('reads the inferred type as a condition when the server does not know the question', async () => {
    const { container, type } = analysedAs('bool', '1 + 2', { inferred_type: 'int' }, true);
    await type();

    await waitFor(
      () => expect(container.textContent).toContain("This condition is true whenever its value isn't zero or empty"),
      { timeout: 5000 }
    );
  });

  it('says nothing of a condition that gives true or false', async () => {
    const { container, type } = analysedAs(
      'bool',
      '1 < 2',
      { inferred_type: 'bool', condition_reading: 'condition', type_compatible: true },
      true
    );
    await type();
    await settle();
    expect(container.textContent).not.toContain('This condition is true whenever');
    expect(container.textContent).not.toContain("A condition can't give");
  });

  it('keeps the type check of a bool value that is not a condition', async () => {
    const { container, type } = analysedAs('bool', '1 + 2', {
      inferred_type: 'int',
      target_type: 'bool',
      type_compatible: false,
      auto_coercible: false,
      coercion_may_fail: false,
    });
    await type();

    await waitFor(() => expect(container.textContent).toContain('This does not fit'), { timeout: 5000 });
    expect(parseAsked).toEqual([{ targetType: 'bool', condition: undefined }]);
  });

  it('says nothing when the result already fits', async () => {
    const { container, type } = analysedAs('int', '1 + 2', {
      inferred_type: 'int',
      target_type: 'int',
      type_compatible: true,
      auto_coercible: true,
      coercion_may_fail: false,
    });
    await type();
    await settle();

    expect(container.textContent).not.toContain('fit');
  });
});
