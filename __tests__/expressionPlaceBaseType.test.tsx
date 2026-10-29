// Copyright 2026 Qore Technologies, s.r.o.
// An expression is judged against what its place takes by the place's base type, where the type catalogue does
// not list the place's type.
//
// Qorus gives every field and every expression argument the base data type of its values (`base_type`). The
// builder judged an expression against the place's type alone: a field of a user type whose values are text
// (qoretechnologies/order-ref) refused an expression that gives text ("This expression gives text, which this
// field does not take"), and an argument of such a type took nothing at all, its accepted types being looked
// up without its base type (qorus#646).
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** What the server has said every expression gives. */
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

/** "lower case": it gives text. */
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

/** "find order": its argument is an order reference, a user type whose values are text. */
const FIND_ORDER = {
  name: 'find_order',
  display_name: 'Find Order',
  return_type: 'string',
  ui_return_type: 'string',
  args: [
    {
      signature_type_code: 'string',
      name: 'ref',
      display_name: 'Order reference',
      ui_type: 'qoretechnologies/order-ref',
      base_type: 'string',
      required: true,
    },
  ],
};

const MISMATCH = /This expression gives .*(but this field takes|which this field does not take)/;

const renderExpression = (value: unknown, returnType: string, returnBaseType?: string) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <Expression
          value={value as never}
          onValueChange={vi.fn() as never}
          expressions={[LOWER, FIND_ORDER] as never}
          type={'string' as never}
          returnType={returnType as never}
          returnBaseType={returnBaseType}
          level={0}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('an expression in a place of a type the catalogue does not list', () => {
  afterEach(() => {
    serverType = undefined;
  });

  it('fits where it gives what the place takes by its base type', () => {
    serverType = { inferred_type: 'string', ui_type: 'string', known: true };
    const { container } = renderExpression(
      { is_expression: true, value: { exp: 'lwr', args: [{ type: 'string', value: 'A' }] } },
      'qoretechnologies/order-ref',
      'string'
    );
    expect(container.textContent).not.toMatch(MISMATCH);
  });

  it('does not fit where it gives what the base type does not take', () => {
    serverType = { inferred_type: 'int', ui_type: 'int', known: true };
    const { container } = renderExpression(
      { is_expression: true, value: { exp: 'lwr', args: [{ type: 'string', value: 'A' }] } },
      'qoretechnologies/order-id',
      'date'
    );
    expect(container.textContent).toMatch(MISMATCH);
  });

  it('fits in an argument whose type the catalogue does not list, by the argument base type', () => {
    serverType = { inferred_type: 'string', ui_type: 'string', known: true };
    const { container } = renderExpression(
      {
        is_expression: true,
        value: {
          exp: 'find_order',
          args: [
            {
              is_expression: true,
              value: { exp: 'lwr', args: [{ type: 'string', value: 'A' }] },
            },
          ],
        },
      },
      'string'
    );
    expect(container.textContent).not.toMatch(MISMATCH);
  });
});
