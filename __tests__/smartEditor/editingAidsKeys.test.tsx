// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The keys of a code editor's editing aids (qorus#646, David: the DPQL editor that replaces Monaco loses nothing),
 * on a Slate editor as the DPQL editor has it: pairs closed, a selection wrapped, a closing bracket stepped over,
 * an empty pair taken back whole, a quote after a word left an apostrophe, a line's indent kept, lines moved and
 * copied.
 */
import { renderHook } from '@testing-library/react';
import { createEditor, Editor, Transforms } from 'slate';
import { withHistory } from 'slate-history';
import { withReact } from 'slate-react';
import { describe, expect, it } from 'vitest';
import { dpqlSlateConverter } from '../../src/components/dpqlEditor/dpqlHelpers';
import { DPQL_EDITING_LANGUAGE } from '../../src/components/smartEditor/editingAids';
import { ISlateElement } from '../../src/components/smartEditor/types';
import { useEditingAids } from '../../src/components/smartEditor/useEditingAids';

/** A DPQL editor holding `lines`, its caret (or selection) at plain-text offsets in the first line. */
const editorWith = (lines: string[], anchor: number, focus = anchor) => {
  const editor = withHistory(withReact(createEditor()));
  editor.children = lines.map((line) => ({ type: 'paragraph', children: [{ text: line }] })) as any;
  Transforms.select(editor, {
    anchor: { path: [0, 0], offset: anchor },
    focus: { path: [0, 0], offset: focus },
  });
  return editor;
};

/** A key pressed in the editor: whether the aids took it, and the text after. */
const press = (
  editor: Editor,
  key: string,
  modifiers: { shiftKey?: boolean; altKey?: boolean } = {}
) => {
  const { result } = renderHook(() =>
    useEditingAids({
      editorRef: { current: editor },
      converter: dpqlSlateConverter,
      nodes: editor.children as unknown as ISlateElement[],
      language: DPQL_EDITING_LANGUAGE,
    })
  );
  let prevented = false;
  const taken = result.current.onKeyDown({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: !!modifiers.altKey,
    shiftKey: !!modifiers.shiftKey,
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => undefined,
  } as any);
  return {
    taken,
    prevented,
    text: dpqlSlateConverter.fromSlateNodes(editor.children as unknown as ISlateElement[]),
  };
};

const caret = (editor: Editor) => editor.selection?.anchor.offset;

describe('pairs', () => {
  it('closes a bracket typed before nothing, the caret inside it', () => {
    const editor = editorWith(['concat'], 6);
    expect(press(editor, '(')).toMatchObject({ taken: true, text: 'concat()' });
    expect(caret(editor)).toBe(7);
  });

  it('does not close a bracket typed before a word', () => {
    expect(press(editorWith(['a'], 0), '(')).toMatchObject({ taken: false });
  });

  it('steps over a closing bracket typed before the same one', () => {
    const editor = editorWith(['f()'], 2);
    expect(press(editor, ')')).toMatchObject({ taken: true, text: 'f()' });
    expect(caret(editor)).toBe(3);
  });

  it('closes a quote, and steps over the closing one in its string', () => {
    const editor = editorWith(['f()'], 2);
    expect(press(editor, '"')).toMatchObject({ taken: true, text: 'f("")' });
    expect(caret(editor)).toBe(3);
    const closing = editorWith(['f("a")'], 4);
    expect(press(closing, '"')).toMatchObject({ taken: true, text: 'f("a")' });
    expect(caret(closing)).toBe(5);
  });

  it('leaves a quote after a word an apostrophe, and a quote in a string a quote', () => {
    expect(press(editorWith(['"it'], 3), "'")).toMatchObject({ taken: false });
    expect(press(editorWith(['"a '], 3), "'")).toMatchObject({ taken: false });
  });

  it('takes back an empty pair whole with Backspace', () => {
    const editor = editorWith(['f()'], 2);
    expect(press(editor, 'Backspace')).toMatchObject({ taken: true, text: 'f' });
  });

  it('wraps a selection typed over with a bracket or a quote, keeping it selected', () => {
    const editor = editorWith(['a + b'], 0, 5);
    expect(press(editor, '(')).toMatchObject({ taken: true, text: '(a + b)' });
    expect(Editor.string(editor, editor.selection!)).toBe('a + b');
    expect(press(editor, '"')).toMatchObject({ taken: true, text: '("a + b")' });
  });
});

describe('lines', () => {
  it('keeps the indent of the line on Enter', () => {
    const editor = editorWith(['  @a > 1'], 8);
    expect(press(editor, 'Enter')).toMatchObject({ taken: true, text: '  @a > 1\n  ' });
  });

  it('leaves Enter to the editor on a line with no indent', () => {
    expect(press(editorWith(['@a'], 2), 'Enter')).toMatchObject({ taken: false });
  });

  it('moves a line down and up with Alt+↓ and Alt+↑', () => {
    const editor = editorWith(['one', 'two'], 0);
    expect(press(editor, 'ArrowDown', { altKey: true }).text).toBe('two\none');
    Transforms.select(editor, { path: [1, 0], offset: 0 });
    expect(press(editor, 'ArrowUp', { altKey: true }).text).toBe('one\ntwo');
  });

  it('copies a line with Shift+Alt+↓', () => {
    expect(
      press(editorWith(['one', 'two'], 0), 'ArrowDown', { altKey: true, shiftKey: true }).text
    ).toBe('one\none\ntwo');
  });
});
