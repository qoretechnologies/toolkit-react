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
  it('offers no toolbar actions', () => {
    render(<RichTextFormField value={'hello' as never} onChange={vi.fn()} />);

    // Every one false: Reqore draws no bar at all, rather than an empty one.
    expect(editor.props?.actions).toEqual({ undo: false, redo: false, styling: false });
  });

  // The props are spread before this one, so a caller cannot put the bar back:
  // pins the ORDER, which is the part a refactor breaks silently.
  it('keeps them off when a caller passes its own actions', () => {
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
