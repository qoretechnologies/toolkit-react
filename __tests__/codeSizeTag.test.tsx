/**
 * Unit tests for src/components/codeSize — the shared "how much code is
 * there?" summary used by the compact form engine and by read-only source
 * views outside it.
 *
 * Each test calls real production code and asserts on actual behaviour.
 */

import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ReqraftCodeSizeTag,
  codeSizeTagProps,
  describeCodeSize,
  formatCodeChars,
  formatCodeLines,
} from '../src/components/codeSize';

describe('describeCodeSize', () => {
  it('counts lines by separator, not by content', () => {
    expect(describeCodeSize('a\nb\nc')).toEqual({ lines: 3, chars: 5 });
  });

  it('counts the empty line a trailing newline leaves behind', () => {
    // an editor showing "a\n" puts the caret on a second, empty line, so
    // reporting one line would contradict what the reader sees
    expect(describeCodeSize('a\n')).toEqual({ lines: 2, chars: 2 });
  });

  it('calls an empty string one line of nothing, not zero lines', () => {
    expect(describeCodeSize('')).toEqual({ lines: 1, chars: 0 });
  });

  it('counts characters including whitespace and indentation', () => {
    expect(describeCodeSize('  x')).toEqual({ lines: 1, chars: 3 });
  });
});

describe('code size phrasing', () => {
  it('singularises exactly one', () => {
    expect(formatCodeLines(1)).toBe('1 line');
    expect(formatCodeChars(1)).toBe('1 char');
  });

  it('pluralises everything else, zero included', () => {
    expect(formatCodeLines(0)).toBe('0 lines');
    expect(formatCodeLines(2)).toBe('2 lines');
    expect(formatCodeChars(0)).toBe('0 chars');
    expect(formatCodeChars(92)).toBe('92 chars');
  });
});

describe('ReqraftCodeSizeTag', () => {
  const renderTag = (props: Record<string, unknown>) =>
    render(
      <ReqoreUIProvider>
        <ReqraftCodeSizeTag code='' {...(props as never)} />
      </ReqoreUIProvider>
    );

  it('shows both halves of the measurement', () => {
    const { container } = renderTag({ code: 'a\nbb\nccc' });

    expect(container.textContent).toContain('3 lines');
    expect(container.textContent).toContain('8 chars');
  });

  it('lets a caller restyle the chip without touching the labels', () => {
    // the labels are the point of the component, so they are not overridable;
    // everything else a ReqoreTag takes has to pass through, or callers fork it
    const { container } = renderTag({
      code: 'a',
      className: 'custom-size-tag',
      label: 'ignored',
      labelKey: 'ignored',
    } as never);

    expect(container.querySelector('.custom-size-tag')).toBeTruthy();
    expect(container.textContent).toContain('1 line');
    expect(container.textContent).not.toContain('ignored');
  });
});

describe('codeSizeTagProps', () => {
  it('carries the same measurement the tag renders, as plain props', () => {
    // hosts that take tag *props* rather than an element — a panel badge, a
    // button badge — must not have to rebuild the chip by hand
    expect(codeSizeTagProps('a\nbb')).toEqual(
      expect.objectContaining({ label: '2 lines', labelKey: '4 chars', icon: 'CodeLine' })
    );
  });
});
