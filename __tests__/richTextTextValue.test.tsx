// Copyright 2026 Qore Technologies, s.r.o.
// A string field's value, edited with its template references drawn as chips.
//
// Template mode edited a string holding `$local:name` in a plain textarea, so
// the reference read as its spelling. The rich-text field's `text` format draws
// each reference as a chip named from the catalogue and still stores the string.
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
import { templateTextToNodes } from '../src/helpers/templateText';

const TEMPLATES = {
  items: [{ label: 'Local', items: [{ label: 'Customer Name', value: '$local:name' }] }],
} as never;

/** The field inside a form that keeps what it emits, as TemplateField does. */
const Form = ({ initial, onEmit }: { initial: string; onEmit?: (value: string) => void }) => {
  const [value, setValue] = useState(initial);
  return (
    <RichTextFormField
      valueFormat='text'
      templates={TEMPLATES}
      allowTemplates
      value={value}
      onChange={(next) => {
        onEmit?.(next as string);
        setValue(next as string);
      }}
    />
  );
};

beforeEach(() => {
  editor.props = undefined;
});

describe("RichTextFormField valueFormat='text'", () => {
  it('draws a reference in the string as a chip named from the catalogue', () => {
    render(<Form initial='Dear $local:name' />);

    const [paragraph] = editor.props?.value;
    expect(paragraph.children[1]).toMatchObject({ type: 'tag', value: '$local:name' });
    expect(editor.props?.getTagProps(paragraph.children[1])).toMatchObject({
      label: 'Customer Name',
      icon: 'ExchangeDollarLine',
    });
  });

  it('stores what is edited as the string, each chip written as its reference', async () => {
    const onEmit = vi.fn();
    render(<Form initial='' onEmit={onEmit} />);

    editor.props?.onChange(templateTextToNodes('Hi $local:name', TEMPLATES));

    await waitFor(() => expect(onEmit).toHaveBeenLastCalledWith('Hi $local:name'));
  });

  it('keeps the document it is editing when the stored string comes back', async () => {
    /* Rebuilding the document from the echoed string would hand the editor a
       new tree on every keystroke, which it answers by moving the cursor to the
       end. */
    const onEmit = vi.fn();
    render(<Form initial='' onEmit={onEmit} />);
    const typed = templateTextToNodes('Hi $local:name', TEMPLATES);

    editor.props?.onChange(typed);
    await waitFor(() => expect(onEmit).toHaveBeenCalled());

    expect(editor.props?.value).toBe(typed);
  });

  it('shows a string that changes from outside', () => {
    const { rerender } = render(
      <RichTextFormField valueFormat='text' templates={TEMPLATES} value='one' onChange={vi.fn()} />
    );

    rerender(<RichTextFormField valueFormat='text' templates={TEMPLATES} value='$local:name' onChange={vi.fn()} />);

    expect(editor.props?.value[0].children[1]).toMatchObject({ type: 'tag', value: '$local:name' });
  });

  it('reads a HOST’s own grammar, so the editor chips what the row it opens chips', () => {
    /* The field's `templateToken`. Without it the editor knew only reqraft's
       `$key:{path}` and drew `$._case.attempt` as raw text, while the collapsed
       row — which IS given the grammar — drew it as a chip. `attempt` is
       deliberately NOT in the catalogue: an offered value would be found by
       matching the catalogue's literals alone, so it would not tell the two
       mechanisms apart. */
    render(
      <RichTextFormField
        valueFormat='text'
        templates={TEMPLATES}
        templateToken={/\$\.[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g}
        value="skip if $._case.attempt == 1"
        onChange={vi.fn()}
      />
    );

    const [paragraph] = editor.props?.value;
    expect(paragraph.children.map((node: any) => node.text ?? node.value)).toEqual([
      'skip if ',
      '$._case.attempt',
      ' == 1',
    ]);
    expect(paragraph.children[1]).toMatchObject({ type: 'tag', value: '$._case.attempt' });
  });

  it('holds one line when asked to: Enter adds none, and a pasted break is flattened', async () => {
    const onChange = vi.fn();
    render(
      <RichTextFormField valueFormat='text' singleLine templates={TEMPLATES} value='' onChange={onChange} />
    );
    const enter = { key: 'Enter', preventDefault: vi.fn() };

    editor.props?.onKeyDown(enter);
    editor.props?.onChange(templateTextToNodes('a\nb', TEMPLATES));

    expect(enter.preventDefault).toHaveBeenCalled();
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0]).not.toContain('\n');
    expect(editor.props?.value).toHaveLength(1);
  });
});
