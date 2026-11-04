// Copyright 2026 Qore Technologies, s.r.o.
// A field path reads as the path wherever an expression is shown, as the Visual tab draws it (qorus#646, David):
// the row summary, the Text view's text of an unfinished expression, and the server's rendering (Explain, the
// Preview, the read view).
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  connect: vi.fn<() => Promise<void>>(),
  customRequest: vi.fn<() => Promise<unknown>>(),
  disconnect: vi.fn(),
}));

vi.mock('../src/utils/lspClient', () => ({
  ReqraftLspClient: class {
    constructor() {
      return client;
    }
  },
}));

import { withFieldPathsAsReferences } from '../src/components/form/expressions/fieldPath';
import { renderExpressionToText } from '../src/components/form/expressions/renderExpressionToText';
import { incompleteExpressionText } from '../src/components/form/expressions/textOfExpression';
import { IExpression, IExpressionSchema } from '../src/components/form/expressions/types';
import {
  _resetRenderExpressionTransportForTests,
  useRenderExpression,
} from '../src/components/form/expressions/useRenderExpression';

const field = (name: string): IExpression => ({ type: 'auto', value: `$record:{${name}}` });
const op = (exp: string, ...args: IExpression[]): IExpression => ({
  is_expression: true,
  value: { exp, args },
});
const ORDER_IDS = op('list_wildcard', field('orders'), field('id'));
const PRICES = op('hash_wildcard', field('prices'), field('value'));
// size(@orders[*].id) + size(@prices{*})
const SUM = { exp: '+', args: [op('size', ORDER_IDS), op('size', PRICES)] };
const CATALOG = [
  { name: '+', symbol: '+', subtype: 1, args: [], varargs: true },
  { name: 'size', symbol: 'size', subtype: 1, args: [], varargs: false },
  { name: '>', symbol: '>', subtype: 1, args: [], varargs: false },
  { name: 'list_wildcard', symbol: '[*]', subtype: 1, args: [], varargs: false },
] as unknown as IExpressionSchema[];

describe('the row summary', () => {
  it('reads each path in an expression as the path', () => {
    expect(renderExpressionToText(SUM, CATALOG)).toBe(
      'size("$record:{orders[*].id}") + size("$record:{prices{*}}")'
    );
  });

  it('reads an expression that is a path as the path', () => {
    expect(renderExpressionToText(ORDER_IDS.value, CATALOG)).toBe('"$record:{orders[*].id}"');
  });
});

describe("the Text view's text of an unfinished expression", () => {
  it('names each path as DPQL does, braces and all', () => {
    expect(
      incompleteExpressionText({ exp: '>', args: [PRICES, undefined as never] }, CATALOG)
    ).toBe('@prices{*} > …');
    expect(incompleteExpressionText({ exp: '>', args: [ORDER_IDS, field('limit')] }, CATALOG)).toBe(
      '@orders[*].id > @limit'
    );
  });
});

describe("the server's rendering", () => {
  beforeEach(() => {
    _resetRenderExpressionTransportForTests();
    client.connect.mockReset().mockResolvedValue(undefined);
    client.customRequest.mockReset().mockResolvedValue({ rendered: 'r', richtext: null });
  });
  afterEach(() => vi.useRealTimers());

  it('is asked for the expression with each path as the reference it reads as', async () => {
    const { result } = renderHook(() => useRenderExpression());
    await result.current.renderRich(SUM);

    expect(client.customRequest).toHaveBeenCalledWith('dpql/renderExpression', {
      expression: {
        exp: '+',
        args: [
          op('size', { type: 'auto', value: '$record:{orders[*].id}' }),
          op('size', { type: 'auto', value: '$record:{prices{*}}' }),
        ],
      },
    });
  });

  it('is not asked for an expression that is a path: it is the reference', async () => {
    const { result } = renderHook(() => useRenderExpression());

    await expect(result.current.renderRich(PRICES.value)).resolves.toEqual({
      text: '$record:{prices{*}}',
      richtext: null,
    });
    expect(client.customRequest).not.toHaveBeenCalled();
  });

  it('is asked for anything else as it is', () => {
    const plain = { exp: '+', args: [field('a'), { type: 'int', value: 1 }] };
    expect(withFieldPathsAsReferences(plain)).toEqual(plain);
  });
});
