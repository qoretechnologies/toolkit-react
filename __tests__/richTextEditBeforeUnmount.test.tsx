// Copyright 2026 Qore Technologies, s.r.o.
// An edit is handed to the field's host even when the field goes away before the debounce would have sent it
// (qorus#646): a template picked on a value's Value tab and the Expression tab opened at once lost the pick -
// the Value tab's field unmounted with the edit still waiting, and the value stayed empty.
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('@qoretechnologies/reqore/dist/components/RichTextEditor', () => ({
  ReqoreRichTextEditor: (props: Record<string, any>) => {
    editor.props = props;
    return null;
  },
}));

import { RichTextFormField } from '../src/components/form/fields/rich-text/RichText';
import { templateTextToNodes } from '../src/helpers/templateText';

beforeEach(() => {
  vi.useFakeTimers();
  editor.props = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('an edit made just before the field goes away', () => {
  it('is handed to the host as text', () => {
    const onChange = vi.fn();
    const { unmount } = render(<RichTextFormField valueFormat='text' value='' onChange={onChange} />);
    act(() => editor.props?.onChange(templateTextToNodes('$record:{pos}', undefined)));
    // gone before the debounce would have sent it
    unmount();
    expect(onChange).toHaveBeenCalledWith('$record:{pos}');
  });

  it('is handed to the host as a document', () => {
    const onChange = vi.fn();
    const { unmount } = render(<RichTextFormField value={undefined} onChange={onChange} />);
    const document = templateTextToNodes('hello', undefined);
    act(() => editor.props?.onChange(document));
    unmount();
    expect(onChange).toHaveBeenCalledWith(document);
  });

  it('is not sent twice, and nothing is sent where nothing was edited', async () => {
    const onChange = vi.fn();
    const { unmount } = render(<RichTextFormField valueFormat='text' value='' onChange={onChange} />);
    act(() => editor.props?.onChange(templateTextToNodes('abc', undefined)));
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(onChange).toHaveBeenCalledTimes(1);
    unmount();
    expect(onChange).toHaveBeenCalledTimes(1);

    const untouched = vi.fn();
    render(<RichTextFormField valueFormat='text' value='x' onChange={untouched} />).unmount();
    expect(untouched).not.toHaveBeenCalled();
  });
});
