// Copyright 2026 Qore Technologies, s.r.o.
// A text field with no value says nothing until someone types.
//
// The field keeps a local copy of its text and reports it after a short pause
// whenever the copy differs from the value it was given. An empty field's copy
// is '' and its value `undefined`, which differ, so every empty text field
// reported '' as soon as it mounted: a form was "changed" before anyone touched
// it, and TemplateField read the emptied text as "not a template" and swapped
// its editor.
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@qoretechnologies/reqore', () => ({
  ReqoreTextarea: ({ value, onChange }: { value?: string; onChange?: (e: unknown) => void }) => (
    <textarea data-testid='textarea' value={value} onChange={onChange} />
  ),
}));

import { fireEvent, screen } from '@testing-library/react';
import { LongStringFormField } from '../src/components/form/fields/long-string/LongString';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LongStringFormField', () => {
  it.each([undefined, null, ''])('does not report anything on mount when its value is %s', async (value) => {
    const onChange = vi.fn();
    render(<LongStringFormField value={value as never} onChange={onChange} />);

    await vi.advanceTimersByTimeAsync(500);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a clear even where nobody feeds the value back', async () => {
    // An uncontrolled parent: `value` stays undefined however the field is
    // edited, so a field comparing itself against the prop would go quiet the
    // moment its text returned to empty — losing the deletion.
    const onChange = vi.fn();
    render(<LongStringFormField value={undefined as never} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('textarea'), { target: { value: 'a' } });
    await vi.advanceTimersByTimeAsync(500);
    expect(onChange).toHaveBeenLastCalledWith('a');

    fireEvent.change(screen.getByTestId('textarea'), { target: { value: '' } });
    await vi.advanceTimersByTimeAsync(500);

    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('still reports what is typed, including clearing it', async () => {
    const onChange = vi.fn();
    render(<LongStringFormField value='abc' onChange={onChange} />);

    fireEvent.change(screen.getByTestId('textarea'), { target: { value: '' } });
    await vi.advanceTimersByTimeAsync(500);

    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
