import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What the Preview box is allowed to say.
 *
 * It renders the AST, and the AST only moves on a SUCCESSFUL parse — so while
 * an edit is invalid or mid-flight it still describes the last thing that
 * parsed. Three rules, all reported from the running IDE:
 *
 *  - it must not repeat the line above it (`1 + 2` previewing as `1 + 2`);
 *  - it must not speak for text it was not parsed from (deleting the `2` left
 *    "Unexpected end of input" above a Preview still reading `1 + 2`);
 *  - it must not come back afterwards with that stale value.
 */
let renderedText = '';
let parseSucceeds = true;

vi.mock('../src/components/form/expressions/useRenderExpression', () => ({
  useRenderExpression: () => ({
    renderRich: async () => ({ text: renderedText, server: false }),
  }),
}));

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ value, onChange }, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        serialize: async () => '1 + 2',
        parse: async (t: string) =>
          parseSucceeds ?
            { success: true, expression: { is_expression: true, value: { exp: '+', args: [t] } } }
          : { success: false, expression: null },
      }),
      []
    );
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

const Harness = () => {
  const [value, setValue] = useState<any>({
    is_expression: true,
    value: { exp: '+', args: [1, 2] },
  });
  return (
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <ExpressionField
          value={value}
          onChange={(v) => setValue(v)}
          type='auto'
          defaultMode='text'
          expressions={[]}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

/** ReqoreMessage splits its title across nodes, so match the rendered text. */
const previewShown = () => (document.body.textContent || '').includes('Preview');

const editor = () => screen.getByTestId('fake-dpql') as HTMLTextAreaElement;

beforeEach(() => {
  renderedText = '';
  parseSucceeds = true;
});

describe('the Preview box', () => {
  it('shows a rendering that differs from the typed text', async () => {
    renderedText = '$local:order == 1';
    render(<Harness />);

    await waitFor(() => expect(editor().value).toBe('1 + 2'));
    await waitFor(() => expect(previewShown()).toBe(true), { timeout: 4000 });
  });

  it('stays hidden when it would only echo the text back', async () => {
    renderedText = '1 + 2';
    render(<Harness />);

    await waitFor(() => expect(editor().value).toBe('1 + 2'));
    // Waited out rather than asserted instantly: the box is debounced, so an
    // immediate check would pass before it had a chance to appear.
    await new Promise((r) => setTimeout(r, 1200));
    expect(previewShown()).toBe(false);
  });

  it('hides once the text no longer parses, and does not come back', async () => {
    renderedText = '$local:order == 1';
    render(<Harness />);

    await waitFor(() => expect(previewShown()).toBe(true), { timeout: 4000 });

    // Delete the `2`: the text no longer parses, so the AST still describes
    // `1 + 2` and the preview must stop speaking for it.
    parseSucceeds = false;
    fireEvent.change(editor(), { target: { value: '1 +' } });

    await waitFor(() => expect(previewShown()).toBe(false), { timeout: 4000 });
    // And it must not reappear once the debounce settles.
    await new Promise((r) => setTimeout(r, 1200));
    expect(previewShown()).toBe(false);
  });
});
