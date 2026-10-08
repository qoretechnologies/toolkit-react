// Copyright 2026 Qore Technologies, s.r.o.
// An expression put in the Text view is checked against the field's type, as typed text is.
//
// The text the view opens with is serialized from the expression, not typed, and the check was asked only for
// typed text. It still happened when the editor reported the seeded text back as a change - which Slate does
// only when an operation runs, so only with the editor focused. With the focus elsewhere (the field's picker
// opened at once, qorus#646) the expression was shown and never checked: a whole-number field said nothing
// of an expression that does not fit it.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

let parsed: { text: string; targetType?: string }[] = [];

vi.mock('../src/components/dpqlEditor', () => ({
  // an editor that never reports its text back: nothing typed, nothing echoed
  DpqlEditor: forwardRef<any, any>(({ readOnly, value }, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        serialize: async () => '1 + 2',
        parse: async (text: string, targetType?: string) => {
          parsed.push({ text, targetType });
          return {
            success: true,
            expression: { is_expression: true, value: { exp: '+', args: [] } },
            diagnostics: [],
            inferred_type: 'int',
            target_type: targetType,
            type_compatible: targetType === 'int',
            auto_coercible: false,
            coercion_may_fail: false,
          };
        },
      }),
      []
    );
    return readOnly ? <span>{value}</span> : <div data-testid='fake-dpql'>{value}</div>;
  }),
}));

import { ExpressionField } from '../src/components/form/expressions/ExpressionField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const ONE_PLUS_TWO = {
  is_expression: true,
  value: {
    exp: '+',
    args: [
      { type: 'int', value: 1 },
      { type: 'int', value: 2 },
    ],
  },
};

const opened = (type: string) => {
  parsed = [];
  const Harness = () => {
    const [value, setValue] = useState<any>(ONE_PLUS_TWO);
    return (
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <ExpressionField
            value={value}
            onChange={setValue}
            type={type}
            defaultMode='text'
            expressions={[]}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
  };
  return render(<Harness />);
};

describe('an expression opened in the Text view', () => {
  it('is checked against the field type, untyped', async () => {
    const { container, findByTestId } = opened('bool');
    const editor = await findByTestId('fake-dpql');
    await waitFor(() => expect(editor.textContent).toBe('1 + 2'));
    await waitFor(() => expect(container.textContent).toContain('This does not fit'), {
      timeout: 5000,
    });
    expect(container.textContent).toContain(
      'The expression returns int, and this field holds bool.'
    );
    expect(parsed).toEqual([{ text: '1 + 2', targetType: 'bool' }]);
  });

  it('says nothing when it fits', async () => {
    const { container, findByTestId } = opened('int');
    const editor = await findByTestId('fake-dpql');
    await waitFor(() => expect(editor.textContent).toBe('1 + 2'));
    await waitFor(() => expect(parsed).toHaveLength(1), { timeout: 5000 });
    expect(container.textContent).not.toContain('This does not fit');
    expect(container.textContent).not.toContain('This may not fit');
  });

  it('is not asked of a field that holds anything', async () => {
    const { findByTestId } = opened('auto');
    const editor = await findByTestId('fake-dpql');
    await waitFor(() => expect(editor.textContent).toBe('1 + 2'));
    expect(parsed).toEqual([]);
  });
});
