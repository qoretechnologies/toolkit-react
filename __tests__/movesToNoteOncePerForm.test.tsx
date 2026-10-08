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
 * qlip build 20261008-083118 (Foxhoundn): 'Moves to "Set" when you close it (✓)' "does not need to be shown
 * everytime, the user will learn what happens after the first time". David's decision: once per form, on the
 * first field the user edits that is held in its box. Once that field is closed, no field says it again.
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

describe('the note saying where an open field moves', () => {
  it('is said on the first field edited, and on no field after it is closed', async () => {
    const { container } = render(<Form />);
    await fill(container, 'first', 'a');
    await waitFor(() => expect(row(container, 'first')!.textContent).toContain(NOTE));
    close(container, 'first');
    await waitFor(() => expect(container.textContent).not.toContain(NOTE));

    await fill(container, 'second', 'b');
    // the second field is set, and held open in "Needs attention" like the first was - and does not say so
    await waitFor(() => expect(container.textContent).toContain('2/2 set'));
    await waitFor(() => expect(container.querySelector('.readfirst-row-editing')).toBeTruthy());
    expect(container.textContent).not.toContain(NOTE);
  });

  it('is said on one field only while two are held', async () => {
    const { container } = render(<Form expandMode='multi' />);
    await fill(container, 'first', 'a');
    await waitFor(() => expect(row(container, 'first')!.textContent).toContain(NOTE));
    await fill(container, 'second', 'b');
    await waitFor(() => expect(container.textContent).toContain('2/2 set'));
    await waitFor(() => expect(container.querySelectorAll('.readfirst-row-editing').length).toBe(2));
    expect(row(container, 'first')!.textContent).toContain(NOTE);
    expect(row(container, 'second')!.textContent).not.toContain(NOTE);
  });
});
