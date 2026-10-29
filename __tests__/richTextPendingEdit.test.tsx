// Copyright 2026 Qore Technologies, s.r.o.
// The rich-text field's edit that waits for its pause belongs to the editor that closes it (qorus#646): the
// read-first row's Done sends it before the row closes, Cancel and Escape drop it - sent on the way out, it was
// committed by the very keys meant to throw it away - and a value from outside replaces it.
import { act, render } from '@testing-library/react';
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

import { createPendingEdits, PendingEditsContext } from '../src/components/form/fields/pendingEdit';
import { RichTextFormField } from '../src/components/form/fields/rich-text/RichText';
import { templateTextToNodes } from '../src/helpers/templateText';

beforeEach(() => {
  vi.useFakeTimers();
  editor.props = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

const type = (text: string) =>
  act(() => editor.props?.onChange(templateTextToNodes(text, undefined)));

describe('a rich-text edit inside its pause', () => {
  it('is sent when its scope flushes, once', async () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    render(
      <PendingEditsContext.Provider value={scope}>
        <RichTextFormField valueFormat='text' value='' onChange={onChange} />
      </PendingEditsContext.Provider>
    );

    type('$record:{pos}');
    act(() => scope.flush());
    expect(onChange.mock.calls).toEqual([['$record:{pos}']]);

    // the pause that follows has nothing left to send
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is sent as a document when the field holds one', () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    render(
      <PendingEditsContext.Provider value={scope}>
        <RichTextFormField value={undefined} onChange={onChange} />
      </PendingEditsContext.Provider>
    );
    const document = templateTextToNodes('hello', undefined);

    act(() => editor.props?.onChange(document));
    act(() => scope.flush());

    expect(onChange).toHaveBeenCalledWith(document);
  });

  it('is dropped when its scope discards, and not sent as the field goes away', async () => {
    const scope = createPendingEdits();
    const onChange = vi.fn();
    const { unmount } = render(
      <PendingEditsContext.Provider value={scope}>
        <RichTextFormField valueFormat='text' value='kept' onChange={onChange} />
      </PendingEditsContext.Provider>
    );

    type('thrown away');
    act(() => scope.discard());
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('is dropped when a value from outside replaces it', () => {
    const onChange = vi.fn();
    const { rerender, unmount } = render(
      <RichTextFormField valueFormat='text' value='first' onChange={onChange} />
    );

    type('typed');
    rerender(<RichTextFormField valueFormat='text' value='from outside' onChange={onChange} />);
    unmount();

    expect(onChange).not.toHaveBeenCalled();
  });
});
