// Copyright 2026 Qore Technologies, s.r.o.
// A rich-text FORM FIELD draws no document toolbar.
//
// The field asked Reqore for undo and redo but not styling, and Reqore draws
// that bar as a panel as wide as the tag list: under the field sat an empty
// 600px box holding two greyed icons (undo and redo are disabled until there
// is history to walk). Reported as "an empty template menu appears" on
// Auto - Via Form Engine after choosing the Text type, which is `richtext`.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('@qoretechnologies/reqore/dist/components/RichTextEditor', () => ({
  ReqoreRichTextEditor: (props: Record<string, any>) => {
    editor.props = props;
    return null;
  },
}));

import { RichTextFormField } from '../src/components/form/fields/rich-text/RichText';

beforeEach(() => {
  editor.props = undefined;
});

describe('a rich-text form field', () => {
  it.each([
    ['editing a document', {}],
    ['editing text with chips', { valueFormat: 'text' as const }],
    ['read-only', { readOnly: true }],
  ])('offers no toolbar actions when %s', (_case, props) => {
    render(<RichTextFormField value={'hello' as never} onChange={vi.fn()} {...props} />);

    // Every one false: Reqore draws no bar at all, rather than an empty one.
    expect(editor.props?.actions).toEqual({ undo: false, redo: false, styling: false });
  });

  it('cannot be given one back by a caller', () => {
    render(
      <RichTextFormField
        value={'hello' as never}
        onChange={vi.fn()}
        {...({ actions: { undo: true, redo: true, styling: true } } as never)}
      />
    );

    expect(editor.props?.actions).toEqual({ undo: false, redo: false, styling: false });
  });
});
