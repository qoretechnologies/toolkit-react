// Copyright 2026 Qore Technologies, s.r.o.
// The type analysis must survive a language server that attaches LATE.
//
// The editor mounts on the render that flips the field into Text mode; its LSP
// session comes up after that. Everything on the way to `parse` is optional
// (`dpqlRef.current?.parse?.()`), so a debounce that fires before the session
// is up resolves `undefined`, the analysis is CLEARED, and nothing asks again —
// the author is told nothing about the type until they type another character.
//
// This is the bug CI caught and a local story run could not: on a fast machine
// the session is always up before the 300ms debounce.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

/** When the fake session starts answering `parse`. */
let parseReady = false;
let parseCalls = 0;

/** What the server returns for "text used as a number" — a conversion that
 *  may fail, which is the one case that warrants a warning. */
const mayNotFitResult = {
  success: true,
  expression: { is_expression: true, value: { exp: 'value', args: [] } },
  diagnostics: [],
  // FLAT, exactly as the server and the story mock return it — `readTypeCheck`
  // reads `result.type_compatible`, so nesting these under `type_analysis`
  // silently reads as "no analysis" and the message never renders.
  inferred_type: 'string',
  target_type: 'int',
  type_compatible: false,
  auto_coercible: true,
  coercion_may_fail: true,
  suggested_fix: { text: 'toInt(total)' },
};

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ onChange }, ref) => {
    /* A GETTER, not a snapshot: the real ref gains `parse` when the session
       attaches, so the handle has to answer differently over time. Freezing it
       at mount (the obvious `[]`-dep version) models a session that never
       arrives, which no retry can rescue. */
    useImperativeHandle(
      ref,
      () => ({
        get parse() {
          return parseReady ?
              async () => {
                parseCalls++;
                return mayNotFitResult;
              }
            : undefined;
        },
      }),
      []
    );
    return (
      <textarea
        data-testid='fake-dpql'
        onChange={(e) => onChange((e.target as HTMLTextAreaElement).value)}
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
  const [value, setValue] = useState<any>({ is_expression: true, value: { args: [] } });
  return (
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <ExpressionField
          value={value}
          onChange={(v) => setValue(v)}
          type='int'
          defaultMode='text'
          expressions={[]}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

describe('the type analysis survives a language server that attaches late', () => {
  it('asks again once the session is up, instead of staying silent', async () => {
    parseReady = false;
    const { container } = render(<Harness />);

    const editor = await screen.findByTestId('fake-dpql');
    // Type while the session is still attaching — the debounce fires into a
    // ref that cannot parse yet.
    fireEvent.change(editor, { target: { value: 'total' } });

    /* The session attaches only AFTER the 300ms debounce has already fired, so
       the first attempt genuinely finds no `parse`. The author types NOTHING
       more — everything from here has to come from the component asking
       again. */
    setTimeout(() => {
      parseReady = true;
    }, 700);

    /* Matched against the container's text rather than with `getByText`:
       ReqoreMessage renders its title through nested nodes, so an exact
       single-element match reports "not found" for a message that is on
       screen — the failure mode testing-library warns about in that very
       error. */
    await waitFor(
      () => {
        expect(container.textContent).toContain('This may not fit');
        expect(container.querySelector('[data-testid="expression-type-fix"]')?.textContent)
          .toContain('toInt(');
      },
      { timeout: 12000 }
    );
    expect(parseCalls).toBeGreaterThan(0);
  }, 20000);
});
