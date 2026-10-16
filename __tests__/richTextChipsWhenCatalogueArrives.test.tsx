// Copyright 2026 Qore Technologies, s.r.o.
// A reference a string holds is drawn as a chip as soon as something can name it, even when the catalogue
// that names it arrives after the editor's first render (qorus#646).
//
// A reference neither grammar matches — a DPQL `@create`, say — is recognised only by the catalogue that
// NAMES it. The catalogue is fetched, so it is often not in hand at the first render. The editor built its
// document once and rebuilt it only when the stored string changed, so a preset reference stayed raw text
// until the author re-picked it. Here the catalogue arrives on a later render and the reference becomes a
// chip without the string changing.
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('@qoretechnologies/reqore/dist/components/RichTextEditor', () => ({
  ReqoreRichTextEditor: (props: Record<string, any>) => {
    editor.props = props;
    return null;
  },
}));

import { RichTextFormField } from '../src/components/form/fields/rich-text/RichText';

/** A reference only the catalogue can name: it matches neither reqraft's `$key:…` grammar nor a declared
 *  `$.`-token, so without the catalogue it is raw text. */
const VALUE = '@create + 1';
const EMPTY = { items: [] } as never;
const NAMED = { items: [{ label: 'Created order', value: '@create' }] } as never;

const chipValues = (): string[] =>
  (editor.props?.value ?? [])
    .flatMap((paragraph: any) => paragraph.children ?? [])
    .filter((node: any) => node?.type === 'tag')
    .map((node: any) => node.value);

beforeEach(() => {
  editor.props = undefined;
});

describe('a reference drawn as a chip once the catalogue can name it', () => {
  it('chips the reference when the catalogue arrives after the first render', async () => {
    const { rerender } = render(
      <RichTextFormField
        valueFormat='text'
        templates={EMPTY}
        allowTemplates
        value={VALUE}
        onChange={vi.fn()}
      />
    );
    // nothing names @create yet, so it is raw text
    expect(chipValues()).toEqual([]);

    // the catalogue arrives; the stored string is unchanged
    rerender(
      <RichTextFormField
        valueFormat='text'
        templates={NAMED}
        allowTemplates
        value={VALUE}
        onChange={vi.fn()}
      />
    );

    await waitFor(() => expect(chipValues()).toEqual(['@create']));
  });

  it('chips a reference the catalogue already names at the first render', () => {
    render(
      <RichTextFormField
        valueFormat='text'
        templates={NAMED}
        allowTemplates
        value={VALUE}
        onChange={vi.fn()}
      />
    );

    expect(chipValues()).toEqual(['@create']);
  });

  it('leaves the document alone when a catalogue change names nothing new', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RichTextFormField
        valueFormat='text'
        templates={EMPTY}
        allowTemplates
        value='plain text'
        onChange={onChange}
      />
    );
    const before = editor.props?.value;

    rerender(
      <RichTextFormField
        valueFormat='text'
        templates={NAMED}
        allowTemplates
        value='plain text'
        onChange={onChange}
      />
    );

    // same document object: a rebuild that changes no chip must not replace it (that would move the cursor)
    expect(editor.props?.value).toBe(before);
  });
});
