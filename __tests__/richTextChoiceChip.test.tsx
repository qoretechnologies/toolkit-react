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
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('@qoretechnologies/reqore/dist/components/RichTextEditor', () => ({
  ReqoreRichTextEditor: (props: Record<string, any>) => {
    editor.props = props;
    return null;
  },
}));

import { RichTextFormField } from '../src/components/form/fields/rich-text/RichText';
import { choiceToNodes, choiceValueOfNodes } from '../src/helpers/choiceChip';

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
  onEmit,
}: {
  initial: string;
  valueFormat?: 'richtext' | 'text';
  onEmit?: (value: unknown) => void;
}) => {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <RichTextFormField
      valueFormat={valueFormat}
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

beforeEach(() => {
  editor.props = undefined;
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
