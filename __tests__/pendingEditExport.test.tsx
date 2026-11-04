// Copyright 2026 Qore Technologies, s.r.o.
// A host's own debounced field keeps its unreported edit for the row that closes it, as reqraft's own fields do
// (qorus#646): `usePendingEdit` is public. Imported from the package root, as a host imports it.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useDebounce } from 'react-use';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine, usePendingEdit } from '../src';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/** A host's field: keeps what is typed, reports it after its own pause, and holds it until then. */
const HostText = ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => {
  const [text, setText] = useState<string>(value ?? '');
  const [reported, setReported] = useState<string>(value ?? '');
  const pending = usePendingEdit<string>((next) => {
    setReported(next);
    onChange(next);
  });
  useDebounce(
    () => {
      pending.release();
      if (text !== reported) {
        setReported(text);
        onChange(text);
      }
    },
    200,
    [text]
  );
  return (
    <input
      aria-label='host text'
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        pending.hold(event.target.value);
      }}
    />
  );
};

const renderForm = (value: Record<string, unknown> = {}) => {
  const onChange = vi.fn();
  const view = render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='host'
          value={value as never}
          options={
            {
              topic: {
                type: 'string',
                ui_type: 'host-text',
                display_name: 'Topic',
                preselected: true,
              },
            } as never
          }
          componentOverrides={{ 'host-text': HostText }}
          onChange={onChange}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  return { onChange, ...view };
};

const isOpen = (container: HTMLElement) =>
  !!container.querySelector(
    '[data-field="topic"].readfirst-row-editing, [data-field="topic"].options-readfirst-card'
  );

const openAndType = async (container: HTMLElement, text: string) => {
  await waitFor(() => expect(container.querySelector('[data-field="topic"]')).toBeTruthy());
  fireEvent.click(container.querySelector('[data-field="topic"]')!);
  await waitFor(() => expect(container.querySelector('[aria-label="host text"]')).toBeTruthy());
  fireEvent.change(container.querySelector('[aria-label="host text"]')!, {
    target: { value: text },
  });
};

const reported = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.map(([, value]) => (value as Record<string, any> | undefined)?.topic?.value);

describe("a host's own debounced field in a read-first row", () => {
  it('is public from the package root', () => {
    expect(typeof usePendingEdit).toBe('function');
  });

  it('keeps what was typed when Done follows at once', async () => {
    const { container, onChange } = renderForm();
    await openAndType(container, 'orders/created');

    fireEvent.click(container.querySelector('.options-readfirst-done')!);

    await waitFor(() => expect(isOpen(container)).toBe(false));
    expect(container.querySelector('[data-field="topic"]')?.textContent).toContain(
      'orders/created'
    );
    await waitFor(() => expect(reported(onChange)).toContain('orders/created'));
  });

  it('drops what was typed when Escape follows at once', async () => {
    const { container, onChange } = renderForm({ topic: { type: 'string', value: 'kept' } });
    await openAndType(container, 'thrown away');

    fireEvent.keyDown(container.querySelector('[aria-label="host text"]')!, { key: 'Escape' });

    await waitFor(() => expect(isOpen(container)).toBe(false));
    expect(container.querySelector('[data-field="topic"]')?.textContent).toContain('kept');
    expect(reported(onChange)).not.toContain('thrown away');
  });
});
