import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

/**
 * "Clear value" empties the option, and the editor has to go with it.
 *
 * The DPQL text is local state, seeded once on entering Text mode, and the
 * seeding effect returns early for an empty AST — it exists to FILL the editor,
 * not to empty it. So clearing removed the value and left the text: the row
 * reported "This field is required" while still showing `1 + 2`, which reads as
 * the clear having silently failed.
 */
vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ value, onChange }, ref) => {
    useImperativeHandle(ref, () => ({ serialize: async () => '1 + 2' }), []);
    return (
      <textarea
        data-testid='fake-dpql'
        value={value ?? ''}
        onChange={(e) => onChange?.((e.target as HTMLTextAreaElement).value)}
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

const WITH_EXPRESSION = { is_expression: true, value: { exp: '+', args: [1, 2] } };

/** The host owns the value, exactly as a form does, so clearing is a prop change. */
const Harness = ({ cleared }: { cleared: boolean }) => {
  const [value, setValue] = useState<any>(WITH_EXPRESSION);
  return (
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <ExpressionField
          value={cleared ? ({ is_expression: true, value: undefined } as any) : value}
          onChange={(v) => setValue(v)}
          type='auto'
          defaultMode='text'
          expressions={[]}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

describe('clearing an expression', () => {
  it('empties the editor, not just the value', async () => {
    const { rerender } = render(<Harness cleared={false} />);

    // The editor seeds from the stored AST.
    await waitFor(() =>
      expect((screen.getByTestId('fake-dpql') as HTMLTextAreaElement).value).toContain('1 + 2')
    );

    // "Clear value" empties the option; the text must go with it.
    rerender(<Harness cleared />);

    await waitFor(() =>
      expect((screen.getByTestId('fake-dpql') as HTMLTextAreaElement).value).toBe('')
    );
  });
});
