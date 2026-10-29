/*
 * Copyright (c) 2026 Qore Technologies, s.r.o.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { Expression } from '../src/components/form/expressions/builder';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/** ">" as the catalogue serves it: two operands, each declared `any`, giving a yes/no. */
const GREATER_THAN = {
  name: 'gt',
  display_name: 'Logical Greater Than',
  return_type: 'bool',
  args: [
    { signature_type_code: 'any', name: 'arg0', display_name: 'Value', ui_type: 'any', required: true },
    { signature_type_code: 'any', name: 'arg1', display_name: 'Value', ui_type: 'any', required: true },
  ],
};

const TEMPLATES = {
  items: [{ label: 'Fields of the row', items: [{ label: 'pos', value: '$record:{pos}', badge: 'int' }] }],
};

const renderCondition = (type?: string) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <Expression
          value={{ is_expression: true, value: { exp: 'gt', args: [] } } as never}
          onValueChange={vi.fn() as never}
          expressions={[GREATER_THAN] as never}
          localTemplates={TEMPLATES as never}
          type={type as never}
          level={0}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/**
 * qorus#646: a row rule's condition (the builder's type `bool`) with ">" chosen showed its first value as
 * "Unknown type!" and only its second as the text field an untyped value is written in. The first
 * operand's type came from the builder's own type - what the whole condition gives - not from what the
 * catalogue declares the operand to be.
 */
describe('the untyped operands of a condition not filled in yet', () => {
  for (const type of ['bool', undefined]) {
    it(`are each a text field, in a builder of type ${type}`, async () => {
      const { container } = renderCondition(type);
      await waitFor(() => expect(container.querySelectorAll('.expression-arg').length).toBe(2));
      await waitFor(() => expect(container.querySelectorAll('.expression-arg [data-slate-editor]').length).toBe(2));
      expect(container.textContent).not.toContain('Unknown type');
    });
  }
});
