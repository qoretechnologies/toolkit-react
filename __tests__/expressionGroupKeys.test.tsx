import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { ExpressionBuilder } from '../src/components/form/expressions/builder';
import { mockExpressions } from '../src/components/form/expressions/mockExpressions';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/* An AND/OR group draws each condition and the word between two of them: one keyed part per condition, so React
   says nothing of keys, and each condition gets its own arguments. */

const contains = (text: string, part: string) => ({
  is_expression: true,
  value: {
    exp: 'contains',
    args: [
      { type: 'string', value: text },
      { type: 'string', value: part },
    ],
  },
});

const group = (exp: '&&' | '||') => ({
  is_expression: true,
  value: { exp, args: [contains('alpha', 'al'), contains('beta', 'be'), contains('gamma', 'ga')] },
});

const settled = () => new Promise((resolve) => setTimeout(resolve, 800));

const renderGroup = (exp: '&&' | '||') =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <ExpressionBuilder value={group(exp) as any} expressions={mockExpressions} onChange={() => undefined} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('an AND/OR group', () => {
  afterEach(() => vi.restoreAllMocks());

  test.each(['&&', '||'] as const)('draws its conditions with no React key warning (%s)', async (exp) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderGroup(exp);
    await settled();

    const keyWarnings = errors.mock.calls.filter((call) =>
      call.some((part) => typeof part === 'string' && /unique "key"/.test(part))
    );
    expect(keyWarnings).toEqual([]);
  });

  test('passes each condition its own arguments, with the joining word between two of them', async () => {
    renderGroup('&&');
    await settled();

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Something went wrong');
    for (const value of ['alpha', 'beta', 'gamma']) {
      expect(text).toContain(value);
    }
    // three conditions, two joining words
    const joiningWords = Array.from(document.querySelectorAll('*')).filter(
      (element) => element.children.length === 0 && element.textContent?.trim() === 'and'
    );
    expect(joiningWords.length).toBe(2);
  });
});
