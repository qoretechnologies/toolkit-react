// Copyright 2026 Qore Technologies, s.r.o.
// A rich-text field holding a string - which is what the server's rich text is - draws it as text with each
// template reference a chip, and sends nothing back until it is edited.
//
// Handed to the editor as it was, the string was drawn as raw text: `$local:some-richtext` spelled out where
// its chip belongs. A field mounted through an untyped first render had drawn the chip by accident, in the
// text format that render used; with the field drawn as its type from the first render, the string reached
// the editor as it was (reqraft's "Expression Can Be Wrapped").
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

/* A ref-taking component, as the real one is: the field hands it a ref for its completion list. */
vi.mock('@qoretechnologies/reqore/dist/components/RichTextEditor', async () => {
  const { forwardRef } = await import('react');
  return {
    ReqoreRichTextEditor: forwardRef((props: Record<string, any>, _ref) => {
      editor.props = props;
      return null;
    }),
  };
});

import { RichTextFormField } from '../src/components/form/fields/rich-text/RichText';
import { templateTextToNodes } from '../src/helpers/templateText';

const TEMPLATES = {
  items: [{ label: 'Richtext Template', value: '$local:some-richtext' }],
} as any;

const EMPTY = [{ type: 'paragraph', children: [{ text: '' }] }];

let reported: unknown[] = [];
let setExternal: (value: unknown) => void = () => undefined;

const Parent = ({ initial }: { initial: unknown }) => {
  const [value, setValue] = useState<unknown>(initial);
  setExternal = setValue;
  return (
    <RichTextFormField
      value={value as any}
      templates={TEMPLATES}
      allowTemplates
      onChange={(next) => {
        reported.push(next);
        setValue(next);
      }}
    />
  );
};

/** The chips the editor was handed, as `label (value)`. */
const chips = () =>
  (editor.props?.value ?? []).flatMap((paragraph: any) =>
    (paragraph.children ?? [])
      .filter((node: any) => node.type === 'tag')
      .map((node: any) => `${node.label} (${node.value})`)
  );

const settle = () => act(() => vi.advanceTimersByTimeAsync(1000));

beforeEach(() => {
  vi.useFakeTimers();
  editor.props = undefined;
  reported = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a rich-text field holding a string', () => {
  it('draws a template reference as its chip, not as its spelling', async () => {
    render(<Parent initial='$local:some-richtext' />);
    await settle();

    expect(chips()).toEqual(['Richtext Template ($local:some-richtext)']);
  });

  it('draws text around a reference as text, the reference as its chip', async () => {
    render(<Parent initial='Dear $local:some-richtext,' />);
    await settle();

    expect(editor.props?.value).toEqual(
      templateTextToNodes('Dear $local:some-richtext,', TEMPLATES)
    );
    expect(chips()).toEqual(['Richtext Template ($local:some-richtext)']);
  });

  it('sends nothing back until it is edited: the string held stays a string', async () => {
    render(<Parent initial='$local:some-richtext' />);
    await settle();

    expect(reported).toEqual([]);
  });

  it('sends nothing back when the editor reports the document it was handed (a click into it)', async () => {
    render(<Parent initial='$local:some-richtext' />);
    await settle();

    act(() => editor.props?.onChange(templateTextToNodes('$local:some-richtext', TEMPLATES)));
    await settle();
    // as the editor's own copy reports it: a key that holds nothing is left out
    act(() => editor.props?.onChange(JSON.parse(JSON.stringify(editor.props?.value))));
    await settle();

    expect(reported).toEqual([]);
  });

  it('sends the document once it is edited', async () => {
    render(<Parent initial='$local:some-richtext' />);
    await settle();

    const edited = templateTextToNodes('$local:some-richtext!', TEMPLATES);
    act(() => editor.props?.onChange(edited));
    await settle();

    expect(reported).toEqual([edited]);
  });

  it('draws a new string from outside', async () => {
    render(<Parent initial='$local:some-richtext' />);
    await settle();

    act(() => setExternal('plain'));
    await settle();

    expect(editor.props?.value).toEqual(templateTextToNodes('plain', TEMPLATES));
    expect(reported).toEqual([]);
  });

  it("holding '', sends nothing when the editor reports the empty text it was handed", async () => {
    render(<Parent initial='' />);
    await settle();
    expect(editor.props?.value).toEqual(EMPTY);

    act(() => editor.props?.onChange(EMPTY));
    await settle();

    expect(reported).toEqual([]);
  });
});

describe('a rich-text field holding a document', () => {
  it('hands the editor the document as it is, and sends nothing back until it is edited', async () => {
    const document = templateTextToNodes('$local:some-richtext', TEMPLATES);
    render(<Parent initial={document} />);
    await settle();

    expect(editor.props?.value).toEqual(document);
    expect(reported).toEqual([]);
  });

  it('emptied, sends no value', async () => {
    render(<Parent initial={templateTextToNodes('abc', TEMPLATES)} />);
    await settle();

    act(() => editor.props?.onChange(EMPTY));
    await settle();

    expect(reported).toEqual([undefined]);
  });
});
