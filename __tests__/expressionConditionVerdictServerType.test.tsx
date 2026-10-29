// Copyright 2026 Qore Technologies, s.r.o.
// A condition's verdict is judged by the type the server gives the expression (qoretechnologies/qorus#713,
// qorus#646).
//
// The builder used to work out an expression's type from the catalogue's `ui_return_type`, one level deep,
// and the condition verdicts (refused for text, a date or a time; a warning for a number, a list or a hash)
// were drawn from that guess. The type is now the server's alone: the verdict follows what the server says,
// even where the catalogue says otherwise, and while the type is not known no verdict is drawn - neither
// the right one nor a wrong one.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** What the server has said the expression gives, or `undefined` while it has not. */
let serverType: { inferred_type: string; ui_type: string; known: boolean } | undefined;

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

vi.mock('../src/components/form/expressions/useExpressionType', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../src/components/form/expressions/useExpressionType')
  >()),
  useExpressionType: () => serverType,
  getCachedExpressionType: () => serverType,
}));

import { Expression } from '../src/components/form/expressions/builder';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/** "lower case" as the catalogue serves it: it says the result is text. */
const LOWER = {
  name: 'lwr',
  display_name: 'Lower Case',
  return_type: 'string',
  ui_return_type: 'string',
  args: [
    {
      signature_type_code: 'string',
      name: 'arg0',
      display_name: 'Text',
      ui_type: 'string',
      required: true,
    },
  ],
};

const renderCondition = (returnType: string | undefined = 'bool') =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <Expression
          value={
            {
              is_expression: true,
              value: { exp: 'lwr', args: [{ type: 'string', value: 'A' }] },
            } as never
          }
          onValueChange={vi.fn() as never}
          expressions={[LOWER] as never}
          type={'bool' as never}
          returnType={returnType as never}
          condition
          level={0}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const verdicts = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.expression-condition-verdict')).map(
    (tag) => tag.textContent
  );

describe("a condition's verdict", () => {
  afterEach(() => {
    serverType = undefined;
  });

  it('refuses text when the server says the expression gives text', () => {
    serverType = { inferred_type: 'string', ui_type: 'richtext', known: true };
    const { container } = renderCondition();

    const said = verdicts(container);
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('must evaluate to true or false');
  });

  it('refuses text in a condition field that declares no type of its own', () => {
    // a condition field need not declare `bool`: the refusal does not hang on a declared type
    serverType = { inferred_type: 'string', ui_type: 'richtext', known: true };
    const { container } = renderCondition(undefined);

    const said = verdicts(container);
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('must evaluate to true or false');
  });

  it("follows the server's type, not the catalogue's: a number is read by its value", () => {
    // the catalogue says text; the server says a number
    serverType = { inferred_type: 'int', ui_type: 'number', known: true };
    const { container } = renderCondition();

    const said = verdicts(container);
    expect(said).toHaveLength(1);
    // named by the type's own name, as the Text view names it
    expect(said[0]).toContain('The condition evaluates to a whole number');
    expect(said[0]).toContain('Qorus treats it as true unless it is 0');
    expect(said[0]).not.toContain('must evaluate to true or false');
  });

  it('draws no verdict while the server has not said what the expression gives', () => {
    serverType = undefined;
    const { container } = renderCondition();

    expect(verdicts(container)).toEqual([]);
    // and no type mismatch is claimed either
    expect(container.textContent).not.toContain('must evaluate to true or false');
  });

  it('draws no verdict for a type the server knows only when the expression runs', () => {
    serverType = { inferred_type: 'auto', ui_type: 'any', known: false };
    const { container } = renderCondition();

    expect(verdicts(container)).toEqual([]);
  });

  it('draws no verdict for an expression the server says gives true or false', () => {
    serverType = { inferred_type: 'bool', ui_type: 'bool', known: true };
    const { container } = renderCondition();

    expect(verdicts(container)).toEqual([]);
  });
});
