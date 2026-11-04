// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { Expression } from '../src/components/form/expressions/builder';
import { mockExpressions } from '../src/components/form/expressions/mockExpressions';
import { IExpression } from '../src/components/form/expressions/types';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A value added with the "Add value" slot takes the focus, and opens nothing (qorus#646).
 *
 * A new operand has no type yet, so it has no text box: its first control is its template picker, a list that
 * opens when it is focused. The builder gave that picker the focus, and since reqore 0.78 a list focused as it
 * mounts opens at once, so adding a value opened the list of templates over the form. David: adding a value is
 * not asking for that list. The operand itself takes the focus; its picker opens when the user goes to it.
 */
const Host = ({ initial, type }: { initial: IExpression; type: string }) => {
  const [value, setValue] = useState(initial);

  return (
    <Expression
      value={value}
      onValueChange={((next: IExpression) => setValue(next)) as never}
      expressions={mockExpressions as never}
      type={type as never}
      returnType={type as never}
      level={0}
    />
  );
};

const operands = () => document.querySelectorAll<HTMLElement>('.expression-arg');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('a value added with the "Add value" slot', () => {
  it.each([
    ['concat', 'string', 'first'],
    ['+', 'int', 1],
    ['&&', 'bool', true],
  ])('in %s takes the focus itself, not its template picker', async (exp, type, value) => {
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <Host
            initial={{ is_expression: true, value: { exp, args: [{ type, value }] } } as never}
            type={type}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    const slot = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('.expression-add-arg');
      expect(found).toBeTruthy();
      return found as HTMLElement;
    });

    fireEvent.click(slot);

    await waitFor(() => expect(operands()).toHaveLength(2));
    const added = operands()[1];
    // a new value has no type yet, so nothing to type into: only its template picker
    expect(added.querySelector('textarea, input')).toBeNull();
    expect(added.querySelector('.template-selector')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(added));
    expect(document.querySelector('.reqore-popover-content')).toBeNull();
  });
});
