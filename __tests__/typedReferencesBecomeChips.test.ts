// Copyright 2026 Qore Technologies, s.r.o.
// A reference typed out in full is drawn as its chip once it has been typed, as one picked from the completion list
// is (qorus#646): the Qorus IDE's test case typed `@create + 1` as its expected value, and `@create` stayed text.
import { describe, expect, it } from 'vitest';
import { dpqlSlateConverter } from '../src/components/dpqlEditor/dpqlHelpers';
import { rechipTypedReferences } from '../src/components/smartEditor/typedReferences';
import { ISlateElement } from '../src/components/smartEditor/types';

/** A paragraph as typed: all of it one text node, no chip. */
const typed = (text: string): ISlateElement => ({ type: 'paragraph', children: [{ text }] });

const chipsOf = (children: unknown[] | undefined) =>
  (children as ISlateElement[] | undefined)
    ?.filter((node) => node.type === 'tag')
    .map((node) => node.value);

describe('a reference typed out in full', () => {
  it('is drawn as its chip once a space follows it, the caret where it was', () => {
    const rechipped = rechipTypedReferences(dpqlSlateConverter, typed('@create + 1'), 0, 11);

    expect(chipsOf(rechipped?.children)).toEqual(['@create']);
    // the caret stays after "+ 1", in the text after the chip
    expect(rechipped?.caret).toEqual({ path: [0, 2], offset: 4 });
  });

  it('is drawn as its chip once an operator follows it', () => {
    expect(
      chipsOf(rechipTypedReferences(dpqlSlateConverter, typed('@create+'), 0, 8)?.children)
    ).toEqual(['@create']);
  });

  it('is left as text while it is still being typed', () => {
    expect(rechipTypedReferences(dpqlSlateConverter, typed('@crea'), 0, 5)).toBeUndefined();
  });

  it('is left as text when a dot follows it: a sub-field may come next', () => {
    expect(rechipTypedReferences(dpqlSlateConverter, typed('@create.'), 0, 8)).toBeUndefined();
  });

  it('is drawn as its chip when the editor is left, though nothing followed it', () => {
    expect(
      chipsOf(rechipTypedReferences(dpqlSlateConverter, typed('@create'), 0)?.children)
    ).toEqual(['@create']);
  });

  it('a template reference too', () => {
    expect(
      chipsOf(rechipTypedReferences(dpqlSlateConverter, typed('$local:name == 1'), 0, 16)?.children)
    ).toEqual(['$local:name']);
  });

  it('a paragraph whose chips are all drawn already is left as it is', () => {
    const [drawn] = dpqlSlateConverter.toSlateNodes('@create + 1');

    expect(rechipTypedReferences(dpqlSlateConverter, drawn, 0, 11)).toBeUndefined();
  });

  it('text with no reference in it is left as it is', () => {
    expect(rechipTypedReferences(dpqlSlateConverter, typed('1 + 2 '), 0, 6)).toBeUndefined();
  });
});

/* qorus#646, David's review: a half-typed reference, `$data:receive_order.ev`, was drawn as a chip when the editor
   was left, and read as a reference that stood for something. One that names nothing stays the text it was. */
describe('a reference typed out that names nothing', () => {
  const namesNothing = (reference: string) => reference === '$data:receive_order.ev';

  it('stays the text it was typed as when the editor is left', () => {
    expect(
      rechipTypedReferences(
        dpqlSlateConverter,
        typed('$data:receive_order.ev == "x"'),
        0,
        undefined,
        namesNothing
      )
    ).toBeUndefined();
  });

  it('stays text beside one that names something, which is drawn as its chip', () => {
    const rechipped = rechipTypedReferences(
      dpqlSlateConverter,
      typed('$data:receive_order.ev == $data:receive_order.event_type'),
      0,
      undefined,
      namesNothing
    );
    expect(chipsOf(rechipped?.children)).toEqual(['$data:receive_order.event_type']);
    expect((rechipped?.children[0] as { text?: string }).text).toBe('$data:receive_order.ev == ');
  });
});

/* qorus#646, David's review: a context of free keys and its key, typed out, is a whole reference - drawn as its
   chip when Enter takes it, the caret after it; one naming nothing stays text. */
describe('references typed out, taken at once', () => {
  it('draws the caret paragraph\'s, keeps the one naming nothing as text, and puts the caret at its end', async () => {
    const { createEditor } = await import('slate');
    const { commitTypedReferences } = await import('../src/components/smartEditor/typedReferences');
    const editor = createEditor();
    // a chip is an inline void, as the editors declare it
    editor.isInline = (element) => (element as ISlateElement).type === 'tag';
    editor.isVoid = (element) => (element as ISlateElement).type === 'tag';
    editor.children = [typed('$dynamic:order.id == $data:nothing.here')] as never;
    editor.selection = { anchor: { path: [0, 0], offset: 3 }, focus: { path: [0, 0], offset: 3 } };
    const drawn = commitTypedReferences(
      editor,
      dpqlSlateConverter,
      (reference) => reference === '$data:nothing.here',
      0
    );
    expect(drawn).toBe(true);
    expect(chipsOf((editor.children[0] as ISlateElement).children)).toEqual(['$dynamic:order.id']);
    expect(editor.selection?.anchor).toEqual({ path: [0, 2], offset: ' == $data:nothing.here'.length });
  });

  it('draws nothing where nothing is typed out', async () => {
    const { createEditor } = await import('slate');
    const { commitTypedReferences } = await import('../src/components/smartEditor/typedReferences');
    const editor = createEditor();
    editor.children = [typed('1 + 2')] as never;
    expect(commitTypedReferences(editor, dpqlSlateConverter, undefined, 0)).toBe(false);
  });
});
