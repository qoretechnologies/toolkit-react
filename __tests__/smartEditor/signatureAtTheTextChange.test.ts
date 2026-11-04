// Copyright 2026 Qore Technologies, s.r.o.
// The signature help is asked for the caret as it was when the text changed, not as it is when the request goes.
//
// The request is debounced, and it read the caret when it went. A tap that put the caret in a call's arguments
// soon after the editor had loaded was read by the request the load had started, and the signature showed; a tap
// later than the debounce showed none. DpqlEditor · Details On A Chip On A Touch Screen had the signature pill
// behind the Details card or not from run to run (qorus#646). The signature follows what is typed; a caret moved
// alone asks for nothing.
import { act, renderHook } from '@testing-library/react';
import { createEditor } from 'slate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('slate-react', () => ({
  ReactEditor: {
    toDOMRange: () => ({
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 1, height: 16 }),
    }),
  },
}));

import { defaultSlateConverter } from '../../src/components/smartEditor/helpers';
import { useLspSignatureHelp } from '../../src/components/smartEditor/useLspSignatureHelp';

const SIGNATURE = {
  signatures: [{ label: 'size(Value) → int', parameters: [{ label: 'Value' }] }],
  activeSignature: 0,
  activeParameter: 0,
};

/** The caret at `offset` in the editor's one line. */
const caretAt = (offset: number) => ({
  anchor: { path: [0, 0], offset },
  focus: { path: [0, 0], offset },
});

let getSignatureHelp: ReturnType<typeof vi.fn>;

const editorWith = (text: string) => {
  const editor = createEditor() as any;
  editor.children = defaultSlateConverter.toSlateNodes(text);
  editor.selection = null;
  return editor;
};

const hookOn = (editor: any) => {
  getSignatureHelp = vi.fn(async () => SIGNATURE);
  const session = {
    client: { getSignatureHelp },
    isReady: true,
    isContextReady: true,
    capabilities: { signatureHelpProvider: { triggerCharacters: ['('] } },
  } as any;
  const editorRef = { current: editor };
  return renderHook(
    ({ nodes }) => useLspSignatureHelp(session, editorRef, defaultSlateConverter, nodes),
    { initialProps: { nodes: editor.children } }
  );
};

/** The debounce runs out, and the answer comes back. */
const requestGoes = () => act(() => vi.advanceTimersByTimeAsync(200));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the signature help', () => {
  it('asked for as the editor loads is of the end of the text, though the caret is put in a call before the request goes', async () => {
    const text = 'size(@a) > 1';
    const editor = editorWith(text);
    hookOn(editor);

    // a tap puts the caret in size's arguments while the load's request waits
    editor.selection = caretAt(5);
    await requestGoes();

    expect(getSignatureHelp).toHaveBeenCalledTimes(1);
    expect(getSignatureHelp).toHaveBeenCalledWith(0, text.length);
  });

  it('asked for as text is typed is of the caret where the typing left it', async () => {
    const editor = editorWith('size(');
    const hook = hookOn(editor);
    await requestGoes();
    getSignatureHelp.mockClear();

    // `@a` typed in the call: the text and the caret change together
    editor.children = defaultSlateConverter.toSlateNodes('size(@a');
    editor.selection = caretAt(7);
    hook.rerender({ nodes: editor.children });
    await requestGoes();

    expect(getSignatureHelp).toHaveBeenCalledTimes(1);
    expect(getSignatureHelp).toHaveBeenCalledWith(0, 7);
    expect(hook.result.current.signature).toEqual(SIGNATURE);
  });

  it('is not asked for when the caret moves alone', async () => {
    const editor = editorWith('size(@a) > 1');
    const hook = hookOn(editor);
    await requestGoes();
    getSignatureHelp.mockClear();

    editor.selection = caretAt(5);
    hook.rerender({ nodes: editor.children });
    await requestGoes();

    expect(getSignatureHelp).not.toHaveBeenCalled();
  });
});
