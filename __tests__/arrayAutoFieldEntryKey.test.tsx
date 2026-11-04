// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render } from '@testing-library/react';
import { jsx } from 'react/jsx-runtime';
import { describe, expect, it, vi } from 'vitest';
import { ArrayAutoField } from '../src/components/form/fields/array/ArrayAutoField';

/**
 * qorus#646 (React's warning, found by the story run's warning gate): a list's entry input was given the key that
 * remounts it inside the props it is drawn from, and the field spreads those props into JSX - React warned "A
 * props object containing a "key" prop is being spread into JSX". The key goes on an element around the entry; the
 * entry is still drawn afresh, empty, once its value is added.
 */

/** The entry, drawn the way the form's field draws it: from its props, spread. */
const Entry = (props: { value?: unknown; onChange: (value: unknown) => void }) => (
  <input
    data-testid='entry'
    value={(props.value as string) ?? ''}
    onChange={(event) => props.onChange(event.target.value)}
  />
);

const renderList = () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const result = render(
      <ReqoreUIProvider>
        <ArrayAutoField
          name='tags'
          type='string'
          value={[]}
          onChange={vi.fn()}
          // as `<Entry {...props} />` compiles for the automatic JSX runtime (the package's and the stories'):
          // this test file's own JSX is compiled to createElement, which takes a spread key without a word
          renderItem={(props) => jsx(Entry, props)}
        />
      </ReqoreUIProvider>
    );
    // read before the spy is restored, which clears what it recorded
    const errors = consoleError.mock.calls.map((call) => call.map(String).join(' '));
    return { ...result, errors };
  } finally {
    consoleError.mockRestore();
  }
};

describe("a list's entry input", () => {
  it('is drawn with no key among its props', () => {
    const { errors } = renderList();
    expect(errors.filter((error) => /props object containing a "key" prop/.test(error))).toEqual(
      []
    );
  });

  it('is drawn afresh, empty, once its value is added', () => {
    const { getByTestId, container } = renderList();
    const before = getByTestId('entry');
    fireEvent.change(before, { target: { value: 'first' } });
    fireEvent.click(container.querySelector('.array-auto-compact-confirm') as HTMLElement);
    const after = getByTestId('entry') as HTMLInputElement;
    expect(container.querySelector('.array-auto-compact-tag')?.textContent).toContain('first');
    expect(after).not.toBe(before);
    expect(after.value).toBe('');
  });
});
