// Copyright 2026 Qore Technologies, s.r.o.
import { createEditor, Element, Node, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDpqlTagRenderer } from '../src/components/dpqlEditor/dpqlTags';
import { templateChipInserter } from '../src/components/smartEditor/templateCompletions';
import type { ISlateElement } from '../src/components/smartEditor/types';
import { getTemplateTagStyle } from '../src/helpers/templates';

/**
 * qorus#646, David's review (the IDE's Qonsole › Sheet Contract Review › Added Whole Number With Text Around A
 * Field): in a value's text, `@` typed opens the list of the fields and templates, and Enter picks one - but the `@`
 * stayed in front of the chip, and on the Expression tab the chip was gray where the Value tab drew it blue.
 */

/** A Slate editor holding `text`, its caret at the end, chips inline and void, as the field's editor has them. */
const editorWith = (text: string) => {
  const editor = createEditor();
  const { isInline, isVoid } = editor;
  editor.isInline = (element) => (element as { type?: string }).type === 'tag' || isInline(element);
  editor.isVoid = (element) => (element as { type?: string }).type === 'tag' || isVoid(element);
  editor.children = [{ type: 'paragraph', children: [{ text }] } as Element];
  Transforms.select(editor, { path: [0, 0], offset: text.length });
  return editor;
};

const pick = (text: string) => {
  const editor = editorWith(text);
  templateChipInserter({ label: 'pos', insertText: '$record:{pos}' }, editor as never, {
    plainText: text,
    cursorOffset: text.length,
  });
  const paragraph = editor.children[0] as Element;
  return {
    text: Node.string(paragraph),
    chips: paragraph.children
      .filter((child) => (child as { type?: string }).type === 'tag')
      .map((child) => (child as { value?: string }).value),
  };
};

describe('a template picked from the list typing opens in a text', () => {
  // the editor is not on a page: giving it the focus would retry, and throw, after the test
  beforeEach(() => {
    vi.spyOn(ReactEditor, 'focus').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['an @ alone', '12 @', '12 '],
    ['an @ and what follows it', '12 @po', '12 '],
    ['a $ alone', '12 $', '12 '],
    ['a $ and what follows it', '12 $rec', '12 '],
    ['an @ at the start', '@', ''],
  ])('takes the place of %s', (_name, typed, before) => {
    expect(pick(typed)).toEqual({ text: before, chips: ['$record:{pos}'] });
  });

  it('leaves the text before the word it completes', () => {
    expect(pick('a@b.com @po')).toEqual({ text: 'a@b.com ', chips: ['$record:{pos}'] });
  });

  /* The IDE's Sheet Contract Review: `SUP-` typed, the text clicked and a field picked from the picker that opened
     at the caret read as the chip alone - "SUP-" was deleted, as if it were what the pick was asked for by. Only a
     reference being written (a `$` or an `@` and what follows it) is what a pick takes the place of. */
  it.each([
    ['a word with a dash', 'SUP-', 'SUP-'],
    ['a word', 'Order', 'Order'],
    ['a word after a space', 'Ticket SUP', 'Ticket SUP'],
    ['a path', 'a.b:c', 'a.b:c'],
    ['a word after a mail address', 'mail a@b.com', 'mail a@b.com'],
    ['nothing', '', ''],
  ])('keeps %s that no $ or @ starts', (_name, typed, kept) => {
    expect(pick(typed)).toEqual({ text: kept, chips: ['$record:{pos}'] });
  });

  it('takes the place of a reference only where one opens the list', () => {
    // after a dash or a space, `$rec` is a reference being written: it goes, the word before it stays
    expect(pick('SUP-$rec')).toEqual({ text: 'SUP-', chips: ['$record:{pos}'] });
    expect(pick('SUP- $rec')).toEqual({ text: 'SUP- ', chips: ['$record:{pos}'] });
    // inside a word a `$` opens no list, so nothing typed is what the pick was asked for by
    expect(pick('SUP$rec')).toEqual({ text: 'SUP$rec', chips: ['$record:{pos}'] });
  });
});

describe('a template chip in an expression', () => {
  const tag = (value: string): ISlateElement => ({
    type: 'tag',
    value,
    label: value,
    children: [{ text: '' }],
  });

  const TEMPLATES = {
    items: [
      { label: 'pos', value: '$record:{pos}' },
      { label: 'Started', value: '$local:{started}', metadata: { builtIn: true } },
      { label: 'Event', value: '$data:{event}', metadata: { isEventTrigger: true } },
    ],
  } as never;

  it("is drawn as a value's text draws it: the same intent, and no color of its own", () => {
    for (const [value, metadata] of [
      ['$record:{pos}', undefined],
      ['$local:{started}', { builtIn: true }],
      ['$data:{event}', { isEventTrigger: true }],
      ['$static:{unknown}', undefined],
    ] as const) {
      const props = makeDpqlTagRenderer({}, { templates: TEMPLATES })(tag(value));
      expect(props).toMatchObject(getTemplateTagStyle(metadata));
      expect(props).not.toHaveProperty('color');
    }
  });

  it('is blue (info) for a field of the row, as on the Value tab', () => {
    expect(makeDpqlTagRenderer({})(tag('$record:{pos}'))).toMatchObject({ intent: 'info' });
  });

  it('keeps the per-prefix palette only where asked to', () => {
    const props = makeDpqlTagRenderer({}, { templateTagsUseIntent: false })(tag('$data:{x}'));
    expect(props).toHaveProperty('color');
    expect(props).not.toHaveProperty('intent');
  });
});
