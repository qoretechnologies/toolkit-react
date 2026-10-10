// Copyright 2026 Qore Technologies, s.r.o.
// The rich-text field in text mode must not lose what was typed to the echo of
// its own emit: the parent hands each emitted string back after its own delay,
// and rebuilding the document from that stale string threw away later keys.
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
import { templateNodesToText, templateTextToNodes } from '../src/helpers/templateText';

let lastReported: string | undefined;
let setExternal: (value: string) => void = () => undefined;

const Parent = ({ initial }: { initial: string }) => {
  const [value, setValue] = useState(initial);
  setExternal = setValue;
  return (
    <RichTextFormField
      valueFormat='text'
      value={value}
      onChange={(next) => {
        lastReported = next as string;
        setTimeout(() => setValue(next as string), 120);
      }}
    />
  );
};

const shown = () => templateNodesToText(editor.props?.value);

const typeSlowly = async (text: string, gapMs: number) => {
  for (const key of text) {
    act(() => editor.props?.onChange(templateTextToNodes(shown() + key, undefined)));
    await act(() => vi.advanceTimersByTimeAsync(gapMs));
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  editor.props = undefined;
  lastReported = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RichTextFormField valueFormat='text' and the echo of its own emit", () => {
  it('loses nothing typed 150 ms apart', async () => {
    render(<Parent initial='' />);
    await typeSlowly('ship-order', 150);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(shown()).toBe('ship-order');
    expect(lastReported).toBe('ship-order');
  });

  it('applies a genuine change from outside', async () => {
    render(<Parent initial='abc' />);
    await typeSlowly('d', 150);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(shown()).toBe('abcd');

    act(() => setExternal('abc'));
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(shown()).toBe('abc');
  });
});

/*
 * An edit back to what the parent had before, made while the parent's echo of the edit before it is still on its
 * way (qorus#646). The field compared the edit with the value it was given - still the old one - found them
 * equal and sent nothing; then the echo arrived and was taken as the echo it was. The parent kept the edit that
 * had been undone while the field showed the text without it: " $" typed after a field's chip and deleted again
 * at once left the added field reading `concat(@pos, " $")`, flagged as text, over an editor showing `pos`.
 */
describe('RichTextFormField and an edit undone while its emit is in flight', () => {
  const edit = (text: string) =>
    act(() => editor.props?.onChange(templateTextToNodes(text, undefined)));

  it('reports the text it went back to, as text', async () => {
    render(<Parent initial='abc' />);
    edit('abcd');
    // the field emits "abcd" at 100 ms; the parent hands it back at 220 ms
    await act(() => vi.advanceTimersByTimeAsync(110));
    expect(lastReported).toBe('abcd');
    edit('abc');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(shown()).toBe('abc');
    expect(lastReported).toBe('abc');
  });

  it('reports the document it went back to', async () => {
    let reported: unknown;
    const initial = templateTextToNodes('abc', undefined);
    const DocumentParent = () => {
      const [value, setValue] = useState<unknown>(initial);
      return (
        <RichTextFormField
          value={value as any}
          onChange={(next) => {
            reported = next;
            setTimeout(() => setValue(next), 120);
          }}
        />
      );
    };
    render(<DocumentParent />);
    edit('abcd');
    await act(() => vi.advanceTimersByTimeAsync(110));
    expect(templateNodesToText(reported as any)).toBe('abcd');
    edit('abc');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(templateNodesToText(reported as any)).toBe('abc');
  });

  it('hands the text it went back to to its host when it goes away first', async () => {
    const { unmount } = render(<Parent initial='abc' />);
    edit('abcd');
    await act(() => vi.advanceTimersByTimeAsync(110));
    edit('abc');
    // a tab switched before the debounce sends the edit back
    unmount();

    expect(lastReported).toBe('abc');
  });
});
