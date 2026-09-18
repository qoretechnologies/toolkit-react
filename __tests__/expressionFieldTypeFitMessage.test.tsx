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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

let parseResult: Record<string, unknown> = {};
let parseCalls = 0;

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ onChange, readOnly, value }, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        parse: async () => {
          parseCalls++;
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

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

const analysedAs = (type: string, text: string, analysis: Record<string, unknown>) => {
  parseCalls = 0;
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
        <FetchContext.Provider value={fetchContext as never}>
          <ExpressionField
            value={value}
            onChange={(v) => setValue(v)}
            type={type}
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
   absence cases would otherwise pass before the answer arrived. */
const settle = async () => {
  await waitFor(() => expect(parseCalls).toBeGreaterThan(0), { timeout: 5000 });
  await new Promise((resolve) => setTimeout(resolve, 50));
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
    const { container, type } = analysedAs('bool', '1 + 2', {
      inferred_type: 'int',
      target_type: 'bool',
      type_compatible: false,
      auto_coercible: false,
      coercion_may_fail: false,
    });
    await type();

    await waitFor(() => expect(container.textContent).toContain('This does not fit'), { timeout: 5000 });
    expect(container.textContent).toContain('The expression returns int, and this field holds bool.');
    expect(container.querySelector('[data-testid="expression-type-fix"]')).toBeNull();
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
