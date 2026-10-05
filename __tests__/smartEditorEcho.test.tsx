// Copyright 2026 Qore Technologies, s.r.o.
// The smart editor (DPQL text, an expression's Text mode) must not lose what was typed to the echo of its
// own emit: a host can hand an emit back after the next key is already in the editor, and rebuilding the
// document from that stale text replaced it and put the caret at its end, so `name` came out `nae`.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The editor as reqore's holds it: its own document, replaced when a value it does not hold comes in. */
const editor = vi.hoisted(() => ({
  props: undefined as Record<string, any> | undefined,
  text: '',
  rebuilt: 0,
  toText: undefined as ((nodes: any) => string) | undefined,
}));

vi.mock('@qoretechnologies/reqore/dist/components/RichTextEditor', () => ({
  ReqoreRichTextEditor: (props: Record<string, any>) => {
    // a value that changed and that the editor does not hold replaces its document, as reqore's does (it
    // compares the value with the previous one, then with its own document; the caret goes to the end)
    const incoming = editor.toText!(props.value);
    const changed = !editor.props || JSON.stringify(props.value) !== JSON.stringify(editor.props.value);
    if (editor.props && changed && incoming !== editor.text) {
      editor.rebuilt += 1;
      editor.text = incoming;
    }
    if (!editor.props) editor.text = incoming;
    editor.props = props;
    return null;
  },
}));

import { SmartEditor } from '../src/components/smartEditor/SmartEditor';
import { defaultSlateConverter } from '../src/components/smartEditor/helpers';

const sent: string[] = [];
const session = {
  client: null,
  uri: 'test://doc',
  isReady: false,
  isContextReady: false,
  diagnostics: [],
  semanticTokensLegend: null,
  capabilities: null,
  didChange: (text: string) => sent.push(text),
  getCompletions: async () => [],
  format: async () => null,
} as never;

let reported: string[] = [];
let setExternal: (value: string) => void = () => undefined;

/** A host that hands each emit back after its own delay, as a debouncing form does. */
const Host = ({ initial, delay }: { initial: string; delay: number }) => {
  const [value, setValue] = useState(initial);
  setExternal = setValue;
  return (
    <SmartEditor
      session={session}
      value={value}
      onChange={(next: string) => {
        reported.push(next);
        setTimeout(() => setValue(next), delay);
      }}
    />
  );
};

editor.toText = (nodes) => defaultSlateConverter.fromSlateNodes(nodes);

const shown = () => editor.text;

/** Each key goes on the end of what the editor holds, as typing does. */
const type = async (text: string, gapMs: number) => {
  for (const key of text) {
    editor.text += key;
    act(() => editor.props?.onChange(defaultSlateConverter.toSlateNodes(editor.text)));
    await act(() => vi.advanceTimersByTimeAsync(gapMs));
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  editor.props = undefined;
  editor.text = '';
  editor.rebuilt = 0;
  reported = [];
  sent.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SmartEditor and the echo of its own emit', () => {
  it('loses nothing when the host hands each emit back after the next key', async () => {
    render(<ReqoreUIProvider><Host initial='' delay={120} /></ReqoreUIProvider>);
    await type('name', 50);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(shown()).toBe('name');
    expect(reported.at(-1)).toBe('name');
    // the editor was never rebuilt from a stale echo
    expect(editor.rebuilt).toBe(0);
    // and the language server was never sent one
    expect(sent.filter((t) => t !== '' && !'name'.startsWith(t))).toEqual([]);
    expect(sent.at(-1)).toBe('name');
  });

  it('applies a genuine change from outside, and sends it to the server', async () => {
    render(<ReqoreUIProvider><Host initial='abc' delay={120} /></ReqoreUIProvider>);
    await type('d', 50);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(shown()).toBe('abcd');

    act(() => setExternal('x == 1'));
    await act(() => vi.advanceTimersByTimeAsync(10));

    expect(shown()).toBe('x == 1');
    expect(sent.at(-1)).toBe('x == 1');
  });

  it('applies a change from outside back to a value it emitted long ago', async () => {
    render(<ReqoreUIProvider><Host initial='' delay={10} /></ReqoreUIProvider>);
    await type('ab', 50);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    act(() => setExternal('zzz'));
    await act(() => vi.advanceTimersByTimeAsync(10));
    act(() => setExternal('a'));
    await act(() => vi.advanceTimersByTimeAsync(10));

    expect(shown()).toBe('a');
  });
});
