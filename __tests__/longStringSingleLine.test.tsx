/**
 * The single-line rule as the FIELD enforces it.
 *
 * `singleLineString.test.ts` covers the rule; this covers the enforcement,
 * which is where it was missing. qorus-ide had both, in its own copy of this
 * field — and an alert rule's Internal Name still took Enter, because a form
 * built by FormEngine renders THIS field, not that one.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ReQore's textarea is mocked to a real <textarea> so the props that carry the
// behaviour — onKeyDown, onChange, rows, scaleWithContent — are observable.
vi.mock('@qoretechnologies/reqore', () => ({
  ReqoreTextarea: ({ onChange, onKeyDown, value, rows, scaleWithContent, ...rest }: any) => (
    <textarea
      data-testid='textarea'
      data-rows={rows}
      data-scale-with-content={String(scaleWithContent)}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      {...rest}
    />
  ),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LongStringFormField } from '../src/components/form/fields/long-string/LongString';

const textarea = () => screen.getByTestId('textarea') as HTMLTextAreaElement;

describe('a single-line field', () => {
  it('refuses Enter', () => {
    render(<LongStringFormField type='string' value='name' onChange={() => {}} />);
    const event = fireEvent.keyDown(textarea(), { key: 'Enter' });
    // fireEvent returns false when a handler called preventDefault
    expect(event).toBe(false);
  });

  it('refuses Enter for every string-backed type that holds one line', () => {
    for (const type of ['string', 'email', 'uuid', 'hostname', 'ipv4', 'ipv6', 'phone']) {
      const { unmount } = render(
        <LongStringFormField type={type} value='v' onChange={() => {}} />
      );
      expect(fireEvent.keyDown(textarea(), { key: 'Enter' })).toBe(false);
      unmount();
    }
  });

  /**
   * A keydown guard catches typing and nothing else. The break also arrives by
   * paste, by drag-and-drop, from autofill and from an IME, and every one of
   * those reaches the field as a change with a newline already in it.
   */
  it('flattens a line break that arrives by paste rather than by Enter', () => {
    render(<LongStringFormField type='string' value='' onChange={() => {}} />);
    fireEvent.change(textarea(), { target: { value: 'two\nwords' } });
    expect(textarea().value).toBe('two words');
  });

  it('does not grow, and offers no resize grip that says it can', () => {
    render(<LongStringFormField type='string' value='name' onChange={() => {}} />);
    expect(textarea().getAttribute('data-rows')).toBe('1');
    expect(textarea().getAttribute('data-scale-with-content')).toBe('false');
  });
});

describe('a multi-line field', () => {
  it('still accepts Enter', () => {
    render(<LongStringFormField type='long-string' value='desc' onChange={() => {}} />);
    expect(fireEvent.keyDown(textarea(), { key: 'Enter' })).toBe(true);
  });

  it('keeps the newlines in a pasted value', () => {
    render(<LongStringFormField type='long-string' value='' onChange={() => {}} />);
    fireEvent.change(textarea(), { target: { value: 'two\nlines' } });
    expect(textarea().value).toBe('two\nlines');
  });

  /**
   * `list`, `hash` and `binary` render through this same field, and their values
   * are YAML. Flattening one would not trim a label, it would corrupt a
   * document.
   */
  it('leaves the collection types alone', () => {
    for (const type of ['list', 'hash', 'binary']) {
      const { unmount } = render(<LongStringFormField type={type} value='' onChange={() => {}} />);
      fireEvent.change(textarea(), { target: { value: '- a\n- b' } });
      expect(textarea().value).toBe('- a\n- b');
      unmount();
    }
  });

  /**
   * An unrecognised type stays multi-line: missing a single-line type leaves it
   * behaving as it does today, while wrongly flattening a new document type
   * would destroy what the operator typed.
   */
  it('treats a field with no type as multi-line', () => {
    render(<LongStringFormField value='' onChange={() => {}} />);
    expect(fireEvent.keyDown(textarea(), { key: 'Enter' })).toBe(true);
    fireEvent.change(textarea(), { target: { value: 'a\nb' } });
    expect(textarea().value).toBe('a\nb');
  });
});
