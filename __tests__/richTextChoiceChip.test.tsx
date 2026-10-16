// Copyright 2026 Qore Technologies, s.r.o.
// A rich-text field's value that IS one of its own choices is drawn as the
// choice's name, and stored as the choice's value.
//
// Picking a Slack channel from a field's suggestions wrote the channel's id
// into the editor, so an author who chose "general" read `C07ERBFS0P6`. The id
// is the right value — it is what the server resolves — so it stays the value;
// the editor draws it as one chip named from the choice, the way a reference
// is drawn from the template catalogue.
import { render, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { createEditor, Editor, Transforms } from 'slate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The editor is a mock that records its props and, as Reqore's does, hands
   the Slate editor it was given through its ref. */
const editor = vi.hoisted(() => ({
  props: undefined as Record<string, any> | undefined,
  instance: undefined as Editor | undefined,
}));

vi.mock('@qoretechnologies/reqore/dist/components/RichTextEditor', () => ({
  ReqoreRichTextEditor: forwardRef((props: Record<string, any>, ref) => {
    useImperativeHandle(ref, () => editor.instance);
    editor.props = props;
    return null;
  }),
}));

import { RichTextFormField } from '../src/components/form/fields/rich-text/RichText';
import {
  choiceChipAtCursor,
  choiceForValue,
  choiceToNodes,
  choiceValueOfNodes,
  IChoiceChipBehavior,
  plainTextOfNodes,
  unwrapChoiceChip,
} from '../src/helpers/choiceChip';

const CHOICES = [
  {
    display_name: 'general',
    short_desc: 'Company-wide announcements',
    value: { type: 'richtext', value: 'C07ERBFS0P6' },
  },
  { display_name: 'random', value: { type: 'richtext', value: 'C07RANDOM01' } },
] as never[];

/** The field inside a form that keeps what it emits, as the form engine does. */
const Form = ({
  initial,
  valueFormat,
  choiceChip,
  onEmit,
}: {
  initial: unknown;
  valueFormat?: 'richtext' | 'text';
  choiceChip?: IChoiceChipBehavior;
  onEmit?: (value: unknown) => void;
}) => {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <RichTextFormField
      valueFormat={valueFormat}
      choiceChip={choiceChip}
      allowed_values={CHOICES}
      value={value as string}
      onChange={(next) => {
        onEmit?.(next);
        setValue(next);
      }}
    />
  );
};

const chipOf = (document: any) => document?.[0]?.children.find((node: any) => node.type === 'tag');

const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

/** A Slate editor as Reqore's is set up — a tag is an inline void — holding `document`. */
const slateEditor = (document: any[]): Editor => {
  const instance = createEditor();
  const { isInline, isVoid } = instance;
  instance.isInline = (element) => element.type === 'tag' || isInline(element);
  instance.isVoid = (element) => element.type === 'tag' || isVoid(element);
  instance.children = document;
  return instance;
};

const TEXT = (text: string) => [{ type: 'paragraph', children: [{ text }] }];

/** The first paragraph's children; a Slate descendant is typed as text or element, and this is the element. */
const childrenOf = (instance: Editor): any[] => (instance.children[0] as { children: any[] }).children;

const backspace = () => {
  const event = { key: 'Backspace', preventDefault: vi.fn() };
  editor.props?.onKeyDown(event);
  return event.preventDefault;
};

beforeEach(() => {
  editor.props = undefined;
  editor.instance = undefined;
});

describe("RichTextFormField drawing the field's own choices", () => {
  it('draws a value that is one of the choices as a chip named by the choice', () => {
    render(<Form initial='C07ERBFS0P6' />);

    const chip = chipOf(editor.props?.value);
    expect(chip).toMatchObject({ type: 'tag', value: 'C07ERBFS0P6', label: 'general' });
    expect(editor.props?.getTagProps(chip)).toMatchObject({
      label: 'general',
      tooltip: 'Company-wide announcements',
    });
  });

  it('is not a change: the chip stands for the stored value, so nothing is emitted', async () => {
    const onEmit = vi.fn();
    render(<Form initial='C07ERBFS0P6' onEmit={onEmit} />);

    await settle();

    expect(onEmit).not.toHaveBeenCalled();
  });

  it('keeps the value when the editor hands the chip back, and emits the document once the author writes around it', async () => {
    const onEmit = vi.fn();
    render(<Form initial='C07ERBFS0P6' onEmit={onEmit} />);

    editor.props?.onChange(choiceToNodes(CHOICES[0]));
    await settle();
    expect(onEmit).not.toHaveBeenCalled();

    const extended = [
      { type: 'paragraph', children: [{ text: 'in ' }, ...choiceToNodes(CHOICES[0])[0].children] },
    ];
    editor.props?.onChange(extended);

    await waitFor(() => expect(onEmit).toHaveBeenLastCalledWith(extended));
  });

  it('leaves a value that is not a choice as the text it is', () => {
    render(<Form initial='C07UNKNOWN' />);

    expect(editor.props?.value[0].children).toEqual([{ text: 'C07UNKNOWN' }]);
  });

  it('draws the chip when the value becomes a choice from outside', () => {
    const { rerender } = render(
      <RichTextFormField allowed_values={CHOICES} value='plain' onChange={vi.fn()} />
    );

    rerender(<RichTextFormField allowed_values={CHOICES} value='C07RANDOM01' onChange={vi.fn()} />);

    expect(chipOf(editor.props?.value)).toMatchObject({ value: 'C07RANDOM01', label: 'random' });
  });

  it('draws the chip once the choices arrive after the value, and leaves an edit in progress alone', async () => {
    const { rerender } = render(
      <RichTextFormField value='C07ERBFS0P6' onChange={vi.fn()} />
    );
    expect(editor.props?.value[0].children).toEqual([{ text: 'C07ERBFS0P6' }]);

    rerender(<RichTextFormField allowed_values={CHOICES} value='C07ERBFS0P6' onChange={vi.fn()} />);
    expect(chipOf(editor.props?.value)).toMatchObject({ value: 'C07ERBFS0P6', label: 'general' });

    const typed = [{ type: 'paragraph', children: [{ text: 'C07ERBFS0P6 and more' }] }];
    editor.props?.onChange(typed);
    rerender(
      <RichTextFormField allowed_values={[...CHOICES]} value='C07ERBFS0P6' onChange={vi.fn()} />
    );
    expect(editor.props?.value).toBe(typed);
  });

  it("draws and stores the same way in the 'text' format", async () => {
    const onEmit = vi.fn();
    render(<Form initial='C07ERBFS0P6' valueFormat='text' onEmit={onEmit} />);

    expect(chipOf(editor.props?.value)).toMatchObject({ value: 'C07ERBFS0P6', label: 'general' });

    editor.props?.onChange(editor.props?.value);
    await settle();

    expect(onEmit).not.toHaveBeenCalled();
  });

  it('reads a lone chip back as its value, and anything more as the document', () => {
    expect(choiceValueOfNodes(choiceToNodes(CHOICES[1]))).toBe('C07RANDOM01');
    expect(
      choiceValueOfNodes([
        { type: 'paragraph', children: [{ text: 'x' }, ...choiceToNodes(CHOICES[1])[0].children] },
      ])
    ).toBeUndefined();
    expect(choiceValueOfNodes([{ type: 'paragraph', children: [{ text: 'C07RANDOM01' }] }])).toBeUndefined();
  });
});

describe('editing a choice chip', () => {
  const chipDocument = () => choiceToNodes(CHOICES[0]);
  /** The chip alone, to lay text around; the document above is it between two empty texts. */
  const chip = () => chipDocument()[0].children[1];
  const afterChip = { path: [0, 2], offset: 0 };

  it('Backspace right after the chip opens it into its value as text, the cursor at the end', async () => {
    const onEmit = vi.fn();
    editor.instance = slateEditor(chipDocument());
    Transforms.select(editor.instance, afterChip);
    render(<Form initial='C07ERBFS0P6' onEmit={onEmit} />);

    const preventDefault = backspace();

    expect(preventDefault).toHaveBeenCalled();
    expect(editor.instance.children).toEqual(TEXT('C07ERBFS0P6'));
    expect(editor.instance.selection?.anchor).toEqual({ path: [0, 0], offset: 11 });

    // Opened, the document still stands for the choice, so nothing is emitted;
    // typed into, it is the author's text, stored the way anything typed is.
    editor.props?.onChange(editor.instance.children);
    await settle();
    expect(onEmit).not.toHaveBeenCalled();

    editor.props?.onChange(TEXT('C07ERBFS0P7'));
    await waitFor(() => expect(onEmit).toHaveBeenLastCalledWith(TEXT('C07ERBFS0P7')));
  });

  it('leaves Backspace to the editor when the cursor is not on a chip', () => {
    editor.instance = slateEditor([{ type: 'paragraph', children: [{ text: 'in ' }, chip(), { text: '' }] }]);
    Transforms.select(editor.instance, { path: [0, 0], offset: 3 });
    render(<Form initial='C07ERBFS0P6' />);

    expect(backspace()).not.toHaveBeenCalled();
    expect(childrenOf(editor.instance)).toHaveLength(3);
  });

  it("with `backspace: 'remove'` the chip is left to the editor's own delete", () => {
    editor.instance = slateEditor(chipDocument());
    Transforms.select(editor.instance, afterChip);
    render(<Form initial='C07ERBFS0P6' choiceChip={{ backspace: 'remove' }} />);

    expect(backspace()).not.toHaveBeenCalled();
    expect(editor.instance.children).toEqual(chipDocument());
  });

  it('a click on the chip opens it the same way', () => {
    editor.instance = slateEditor(chipDocument());
    render(<Form initial='C07ERBFS0P6' />);

    const chip = childrenOf(editor.instance)[1];
    editor.props?.getTagProps(chip).onClick();

    expect(editor.instance.children).toEqual(TEXT('C07ERBFS0P6'));
    expect(editor.instance.selection?.anchor).toEqual({ path: [0, 0], offset: 11 });
  });

  it("with `click: 'cursor'` a click is left to the editor, which places the cursor after the chip", () => {
    editor.instance = slateEditor(chipDocument());
    render(<Form initial='C07ERBFS0P6' choiceChip={{ click: 'cursor' }} />);

    const chip = childrenOf(editor.instance)[1];
    expect(editor.props?.getTagProps(chip).onClick).toBeUndefined();
  });

  it('finds the chip the cursor is inside of, and opens it in the middle of a line', () => {
    const instance = slateEditor([
      { type: 'paragraph', children: [{ text: 'in ' }, chip(), { text: ' now' }] },
    ]);

    Transforms.select(instance, { path: [0, 1, 0], offset: 0 });
    expect(choiceChipAtCursor(instance)).toEqual([0, 1]);

    Transforms.select(instance, { path: [0, 0], offset: 1 });
    expect(choiceChipAtCursor(instance)).toBeUndefined();

    expect(unwrapChoiceChip(instance, [0, 1])).toBe(true);
    expect(instance.children).toEqual(TEXT('in C07ERBFS0P6 now'));
    expect(instance.selection?.anchor).toEqual({ path: [0, 0], offset: 14 });
  });

  it('opens nothing that is not a choice chip', () => {
    const instance = slateEditor([
      {
        type: 'paragraph',
        children: [{ text: '' }, { type: 'tag', value: '$local:x', children: [{ text: '' }] }, { text: '' }],
      },
    ]);
    Transforms.select(instance, afterChip);

    expect(choiceChipAtCursor(instance)).toBeUndefined();
    expect(unwrapChoiceChip(instance, [0, 1])).toBe(false);
    expect(childrenOf(instance)).toHaveLength(3);
  });
});

describe('a choice typed back', () => {
  it('reads a document of nothing but a choice\'s text as the choice, and anything more as text', () => {
    expect(plainTextOfNodes(TEXT('C07ERBFS0P6'))).toBe('C07ERBFS0P6');
    expect(plainTextOfNodes([{ type: 'paragraph', children: [{ text: 'C07ERBF' }, { text: 'S0P6' }] }])).toBe(
      'C07ERBFS0P6'
    );
    expect(plainTextOfNodes(choiceToNodes(CHOICES[0]))).toBeUndefined();
    expect(plainTextOfNodes([{ type: 'paragraph', children: [{ text: 'C07ERBFS0P6', bold: true }] }])).toBeUndefined();
    expect(plainTextOfNodes([...TEXT('C07ERBFS0P6'), ...TEXT('')])).toBeUndefined();

    expect(choiceForValue(TEXT('C07ERBFS0P6'), CHOICES)?.display_name).toBe('general');
    expect(choiceForValue(TEXT('C07ERBFS0P7'), CHOICES)).toBeUndefined();
  });

  it('draws a stored document of nothing but the choice\'s text as its chip, and emits nothing for it', async () => {
    const onEmit = vi.fn();
    render(<Form initial={TEXT('C07ERBFS0P6')} onEmit={onEmit} />);

    expect(chipOf(editor.props?.value)).toMatchObject({ value: 'C07ERBFS0P6', label: 'general' });

    await settle();
    expect(onEmit).not.toHaveBeenCalled();
  });

  it('stays text while being typed, and is its chip again once the field is left', async () => {
    const onEmit = vi.fn();
    editor.instance = slateEditor(choiceToNodes(CHOICES[0]));
    render(<Form initial='C07ERBFS0P6' onEmit={onEmit} />);

    editor.props?.getTagProps(childrenOf(editor.instance)[1]).onClick();
    editor.props?.onChange(TEXT('C07ERBFS0P'));
    await waitFor(() => expect(onEmit).toHaveBeenLastCalledWith(TEXT('C07ERBFS0P')));

    editor.props?.onChange(TEXT('C07ERBFS0P6'));
    await waitFor(() => expect(onEmit).toHaveBeenLastCalledWith(TEXT('C07ERBFS0P6')));
    expect(chipOf(editor.props?.value)).toBeUndefined();

    editor.props?.onBlur({});
    await waitFor(() => expect(chipOf(editor.props?.value)).toMatchObject({ label: 'general' }));

    // The chip stands for what is stored, so leaving the field changes nothing.
    const emits = onEmit.mock.calls.length;
    await settle();
    expect(onEmit).toHaveBeenCalledTimes(emits);
  });

  it('leaves text that is not a choice as text when the field is left', async () => {
    render(<Form initial='C07ERBFS0P6' />);

    editor.props?.onChange(TEXT('C07ERBFS0P7'));
    editor.props?.onBlur({});
    await settle();

    expect(editor.props?.value).toEqual(TEXT('C07ERBFS0P7'));
  });

  it("returns to the chip on leaving the field in the 'text' format too", async () => {
    render(<Form initial='C07ERBFS0P6' valueFormat='text' />);

    editor.props?.onChange(TEXT('C07ERBFS0P'));
    editor.props?.onChange(TEXT('C07ERBFS0P6'));
    await waitFor(() => expect(editor.props?.value).toEqual(TEXT('C07ERBFS0P6')));

    editor.props?.onBlur({});
    await waitFor(() => expect(chipOf(editor.props?.value)).toMatchObject({ label: 'general' }));
  });
});

