// Copyright 2026 Qore Technologies, s.r.o.
// What a debounced field has reported and not yet heard back is public: a host's own field tracks its reports
// as reqraft's own fields do (the Qorus IDE's rich text, which lost what was typed to the echo of a report).
// Imported from the package root, as a host imports it - a deep import into `dist/` is a dependency on the
// file layout, not on the API.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmittedValues, TEmittedValuesEquals, useEmittedValues } from '../src';

const document = (text: string) => [{ type: 'paragraph', children: [{ text }] }];

/** As the IDE's rich text reads values: '', undefined, null and an empty document are one empty value. */
const sameText: TEmittedValuesEquals<unknown> = (a, b) => {
  const text = (value: unknown) =>
    Array.isArray(value) ?
      value
        .map((paragraph: any) => paragraph.children.map((leaf: any) => leaf.text).join(''))
        .join('\n')
    : value === undefined || value === null ? ''
    : String(value);
  return text(a) === text(b);
};

describe('the package root', () => {
  it('exports EmittedValues and useEmittedValues', () => {
    expect(typeof EmittedValues).toBe('function');
    expect(typeof useEmittedValues).toBe('function');
  });
});

describe('EmittedValues', () => {
  it('takes the echo of a report for the parent catching up, and acknowledges it and the reports before it', () => {
    const emitted = new EmittedValues<string>();
    emitted.record('s');
    emitted.record('sh');
    expect(emitted.settled('')).toBe('sh');

    // the parent hands back the first report while the second is still on its way
    expect(emitted.isEcho('s')).toBe(true);
    expect(emitted.includes('sh')).toBe(true);
    expect(emitted.isEcho('sh')).toBe(true);
    // nothing left in flight: what the parent holds is what it holds
    expect(emitted.settled('sh')).toBe('sh');
  });

  it('takes anything else for a change from outside, and drops what was in flight', () => {
    const emitted = new EmittedValues<string>();
    emitted.record('ship');
    expect(emitted.isEcho('other')).toBe(false);
    expect(emitted.includes('ship')).toBe(false);
  });

  it("reads values as the same only as its equals says: by default '', undefined, null and an empty document differ", () => {
    const emitted = new EmittedValues<unknown>();
    emitted.record('');
    expect(emitted.includes(undefined)).toBe(false);
    expect(emitted.includes(null)).toBe(false);
    expect(emitted.includes(document(''))).toBe(false);
    // a copy of a reported document is not the document that was reported
    const report = document('1');
    emitted.record(report);
    expect(emitted.includes(document('1'))).toBe(false);
    expect(emitted.includes(report)).toBe(true);
  });

  it('reads them as the same where the caller says they are', () => {
    const emitted = new EmittedValues<unknown>(sameText);
    emitted.record('');
    expect(emitted.includes(undefined)).toBe(true);
    expect(emitted.includes(null)).toBe(true);
    expect(emitted.includes(document(''))).toBe(true);
    expect(emitted.isEcho(undefined)).toBe(true);
  });
});

describe('useEmittedValues', () => {
  it('is one EmittedValues for the life of the component, comparing as its first equals says', () => {
    const { result, rerender } = renderHook(
      ({ equals }: { equals?: TEmittedValuesEquals<unknown> }) => useEmittedValues<unknown>(equals),
      { initialProps: { equals: sameText } }
    );
    const first = result.current;
    act(() => first.record(''));

    rerender({ equals: undefined });
    expect(result.current).toBe(first);
    // still the first render's equals: undefined is the echo of ''
    expect(result.current.isEcho(undefined)).toBe(true);
  });
});
