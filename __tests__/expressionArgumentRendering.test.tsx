import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { Expression } from '../src/components/form/expressions/builder';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
} as any;

/**
 * The served `value` expression: one argument, declared `any`.
 *
 * `null` is a DPQL literal, and `value(null)` is how an author says "this call
 * returns nothing" — the only way to assert it. The visual view has to draw
 * that without falling over and without calling it empty.
 */
const VALUE_EXPRESSION = {
  name: 'value',
  display_name: 'Value',
  return_type: 'any',
  args: [
    {
      signature_type_code: 'any',
      name: 'any',
      display_name: 'Any',
      ui_type: 'any',
      required: true,
    },
  ],
};

const renderBuilder = (args: unknown[], onValueChange: (v: unknown) => void = () => undefined) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <Expression
          value={{ is_expression: true, value: { exp: 'value', args } } as never}
          onValueChange={onValueChange as never}
          expressions={[VALUE_EXPRESSION] as never}
          type='any'
          level={0}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const settled = () => new Promise((resolve) => setTimeout(resolve, 800));

describe('drawing an argument that is the null literal', () => {
  it('draws the enveloped null the server sends, and does not call it empty', async () => {
    // `dpql/parse` answers `null` as `{type: 'any', value: null}` — the
    // argument envelope, already widened server-side.
    renderBuilder([{ type: 'any', value: null }]);
    await settled();

    expect(document.body.textContent).not.toContain('Something went wrong');
    expect(document.body.textContent).not.toContain('Value is empty');
  });

  it('draws a raw null argument instead of falling over', async () => {
    /* Not what the server sends — it envelopes every argument — but the label
       component declares `arg` optional and then dereferenced it unguarded, so
       any draft or catalogue path that produced one took the whole expression
       editor down to its error boundary. */
    renderBuilder([null]);
    await settled();

    expect(document.body.textContent).not.toContain('Something went wrong');
  });

  it('draws a missing argument as missing', async () => {
    renderBuilder([{}]);
    await settled();

    expect(document.body.textContent).not.toContain('Something went wrong');
    expect(document.body.textContent).toContain('Missing value');
  });
});

describe('what the builder stores when an argument is edited', () => {
  it('never writes the schema key `required` into the value', async () => {
    const changes: any[] = [];
    renderBuilder([{ type: 'string', value: 'hello' }], (v) => changes.push(v));

    const editor = await waitFor(() => {
      const el = document.querySelector('textarea') as HTMLTextAreaElement;
      expect(el).toBeTruthy();
      return el;
    });

    fireEvent.change(editor, { target: { value: 'edited' } });
    await waitFor(() => expect(changes.length).toBeGreaterThan(0), { timeout: 3000 });

    /* `required` describes the catalogue's declaration, not the author's
       value, and nothing reads it back off a stored argument. Persisting it is
       what made a cleared argument indistinguishable from real data: the value
       dropped out as `undefined` and `{type, required}` was saved in its
       place — an argument DEFINITION where its value belonged. */
    changes.forEach((change) =>
      change.value.args.forEach((arg: object) => expect(arg).not.toHaveProperty('required'))
    );
  });
});
