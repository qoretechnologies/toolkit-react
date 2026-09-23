import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
let serializedText = '1 + 2';
let parseSucceeds = true;

vi.mock('../src/components/form/expressions/useRenderExpression', () => ({
  useRenderExpression: () => ({
    renderRich: async () => ({ text: renderedText, richtext: null }),
  }),
}));

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ value, onChange, readOnly }, ref) => {
    useImperativeHandle(
      ref,
      () => ({
        serialize: async () => serializedText,
        parse: async (t: string) =>
          parseSucceeds ?
            { success: true, expression: { is_expression: true, value: { exp: '+', args: [t] } } }
          : { success: false, expression: null },
      }),
      []
    );
    /* A READ-ONLY instance is a rendering (`DpqlRendering`: the Preview, the
       suggested conversion), not the editor under test — draw its text. */
    if (readOnly) {
      return <span data-testid='fake-dpql-rendering'>{value}</span>;
    }
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
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

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
  serializedText = '1 + 2';
  parseSucceeds = true;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

/* The field debounces its parse by `PARSE_DEBOUNCE_MS` (300) before the Preview
   can appear, so the "stays hidden" cases have to get past that window to mean
   anything. They used to sleep 1200ms of wall clock each, which is both slow
   and a bet on an idle machine — and its failure mode is silent: under load the
   debounce fires after the assertion and the test proves nothing.

   The clock is jumped instead. `shouldAdvanceTime` leaves `waitFor` working
   normally; this moves past the debounce exactly and instantly. */
const PARSE_DEBOUNCE_MS = 300;

const pastTheParseDebounce = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(PARSE_DEBOUNCE_MS * 2);
  });
};

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
    await pastTheParseDebounce();
    expect(previewShown()).toBe(false);
  });

  it('stays hidden when the two differ only by quotes a chip draws over', async () => {
    // The DPQL writes a reference held in a string inside quotes; the rendering
    // writes it bare. Both editors draw it as the same chip, so on screen the
    // Preview would be a second copy of the line above it.
    serializedText = '"$local:name" == "John"';
    renderedText = '$local:name == "John"';
    render(<Harness />);

    await waitFor(() => expect(editor().value).toBe('"$local:name" == "John"'));
    await pastTheParseDebounce();
    expect(previewShown()).toBe(false);
  });

  it('still shows a rendering that reads differently around a reference', async () => {
    serializedText = '"$local:name" contains "es"';
    renderedText = '$local:name contains "es" (ignore case)';
    render(<Harness />);

    await waitFor(() => expect(previewShown()).toBe(true), { timeout: 4000 });
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
    await pastTheParseDebounce();
    expect(previewShown()).toBe(false);
  });
});
