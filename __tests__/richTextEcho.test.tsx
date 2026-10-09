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
