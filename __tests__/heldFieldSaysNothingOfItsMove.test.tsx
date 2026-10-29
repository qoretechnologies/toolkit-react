/*
 * Copyright (c) 2026 Qore Technologies, s.r.o.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * An open field is held in the box it was opened in, so finishing an edit does not move it and take the focus. A
 * note under the first such field said where it would move when closed ('Moves to "Set" when you close it (✓)');
 * it was one more line to read while writing a value, and it is gone (Foxhoundn, qlip #392: "Remove the whole
 * `Moves to` please"). The field is still held, and moves when it is closed.
 */
const NOTE = 'when you close it (✓)';

const Form = ({ expandMode }: { expandMode?: 'single' | 'multi' }) => {
  const [value, setValue] = useState<any>({});
  return (
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='once'
          expandMode={expandMode}
          value={value}
          options={
            {
              first: { type: 'string', ui_type: 'string', display_name: 'First', required: true },
              second: { type: 'string', ui_type: 'string', display_name: 'Second', required: true },
            } as never
          }
          onChange={(_n, v) => setValue(v)}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

const row = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-field="${name}"]`);

const fill = async (container: HTMLElement, name: string, text: string) => {
  await waitFor(() => expect(row(container, name)).toBeTruthy());
  fireEvent.click(row(container, name)!);
  const input = await waitFor(() => {
    const el = container.querySelector<HTMLInputElement>(
      `[data-field="${name}"] input, [data-field="${name}"] textarea`
    );
    expect(el).toBeTruthy();
    return el!;
  });
  fireEvent.change(input, { target: { value: text } });
};

const close = (container: HTMLElement, name: string) =>
  fireEvent.click(container.querySelector<HTMLElement>(`[data-field="${name}"] .options-readfirst-done`)!);

describe('an open field held in its box', () => {
  it('says nothing of where it moves, and moves when it is closed', async () => {
    const { container } = render(<Form />);
    await fill(container, 'first', 'a');
    // set, and still open where it was opened, with nothing under it saying where it goes
    await waitFor(() => expect(container.textContent).toContain('1/2 set'));
    expect(container.querySelector('[data-field="first"].readfirst-row-editing')).toBeTruthy();
    expect(container.textContent).not.toContain(NOTE);
    close(container, 'first');
    await waitFor(() => expect(container.querySelector('.readfirst-row-editing')).toBeNull());

    await fill(container, 'second', 'b');
    await waitFor(() => expect(container.textContent).toContain('2/2 set'));
    await waitFor(() => expect(container.querySelector('.readfirst-row-editing')).toBeTruthy());
    expect(container.textContent).not.toContain(NOTE);
  });

  it('says nothing while two are held', async () => {
    const { container } = render(<Form expandMode='multi' />);
    await fill(container, 'first', 'a');
    await fill(container, 'second', 'b');
    await waitFor(() => expect(container.textContent).toContain('2/2 set'));
    await waitFor(() => expect(container.querySelectorAll('.readfirst-row-editing').length).toBe(2));
    expect(container.textContent).not.toContain(NOTE);
  });
});
