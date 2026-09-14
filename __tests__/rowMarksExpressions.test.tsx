import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
} as any;

const SCHEMA = {
  subject: { type: 'auto', display_name: 'Value', desc: 'The value this assertion is about' },
} as any;

const renderRow = (field: unknown) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          name='assertion'
          compact
          options={SCHEMA}
          value={{ subject: field } as never}
          onChange={() => undefined}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** The Σ mark, by its own stable class — reqore icons carry no per-icon class. */
const expressionMarkers = () => document.querySelectorAll('.reqraft-expression-marker');

/**
 * A collapsed row has to say when its value is an EXPRESSION.
 *
 * Reported from the live IDE: an author accepted the *Use as expression* offer
 * on one field and not on the other, and both rows read exactly the same —
 * `1 + 2` and `2 + 1`, plain text either way. There was no way to see which had
 * been converted, so an assertion that compared the string `"1 + 2"` against
 * the number `3` looked like it should have passed.
 */
describe('a compact row carrying an expression', () => {
  it('marks it, so it cannot be mistaken for plain text', async () => {
    renderRow({
      type: 'auto',
      is_expression: true,
      value: { exp: '+', args: [{ type: 'int', value: 1 }, { type: 'int', value: 2 }] },
    });

    await waitFor(() => expect(expressionMarkers().length).toBeGreaterThan(0));
  });

  it('marks it when the host declares its own ui_type for the field', async () => {
    /* The IDE renders an assertion's Value through `test-reference`, and the
       stored envelope carries that type alongside the flag — the exact shape
       the draft holds. */
    renderRow({
      type: 'test-reference',
      is_expression: true,
      value: { exp: '+', args: [{ type: 'int', value: 1 }, { type: 'int', value: 2 }] },
    });

    await waitFor(() => expect(expressionMarkers().length).toBeGreaterThan(0));
  });

  it('shows the expression as DPQL, through the one read-only rendering', async () => {
    /* Every read-only expression surface — Explain, Preview, a suggested
       conversion, this row — draws through `DpqlRendering`, so the row and the
       editor it opens read the same: monospace, server-coloured, references as
       chips. Proportional text here was the one place that differed. */
    renderRow({
      type: 'auto',
      is_expression: true,
      value: { exp: '+', args: [{ type: 'int', value: 1 }, { type: 'int', value: 2 }] },
    });

    await waitFor(() => {
      const rendering = document.querySelector('.dpql-rendering');
      expect(rendering).toBeTruthy();
      expect(rendering?.textContent).toContain('1 + 2');
    });
  });

  it('leaves a plain value unmarked', async () => {
    renderRow({ type: 'string', value: '1 + 2' });

    // Settle, then confirm the mark never appears — the whole point is that the
    // two are distinguishable.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(expressionMarkers().length).toBe(0);
    // ...and a plain string is not dressed up as DPQL.
    expect(document.querySelector('.dpql-rendering')).toBeNull();
  });
});
