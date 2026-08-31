import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const queryMock = vi.fn();
vi.mock('../src/utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/utils/fetch')>()),
  query: (...args: unknown[]) => queryMock(...args),
}));

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * Getting out of an open field without keeping what you typed.
 *
 * An open field offered one way out — the green Done check — so every exit
 * committed. Escape closed the row without discarding, which made the one
 * keystroke every editor treats as "get me out of this" the quietest way to
 * commit an edit the user was trying to abandon.
 */

const OPTIONS = {
  cookie_name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Cookie Name',
    short_desc: 'Cookie name for cookie authentication',
  },
} as never;

const VALUE = { cookie_name: { type: 'string', value: 'my-cookie' } } as never;

const renderForm = (onChange = vi.fn()) => ({
  onChange,
  ...render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='profile' value={VALUE} options={OPTIONS} onChange={onChange} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  ),
});

const isExpanded = (container: HTMLElement) =>
  !!container.querySelector(
    '[data-field="cookie_name"].readfirst-row-editing, [data-field="cookie_name"].options-readfirst-card'
  );

const openField = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[data-field="cookie_name"]')).toBeTruthy());
  fireEvent.click(container.querySelector('[data-field="cookie_name"]')!);
  await waitFor(() => expect(isExpanded(container)).toBe(true));
};

const editor = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    '[data-field="cookie_name"] input, [data-field="cookie_name"] textarea'
  );

const type = async (container: HTMLElement, text: string) => {
  const field = editor(container)!;
  fireEvent.change(field, { target: { value: text } });
  await waitFor(() => expect(editor(container)?.value).toBe(text));
};

const cancelButton = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.options-readfirst-cancel');

describe('cancelling an open field', () => {
  it('offers no Cancel until there is something to discard', async () => {
    // Cancel and Done would do the same thing on an untouched field, and two
    // buttons that differ in name but not in effect are worse than one.
    const { container } = renderForm();
    await openField(container);

    expect(cancelButton(container)).toBeNull();
  });

  it('offers Cancel the moment the value differs from what was opened', async () => {
    const { container } = renderForm();
    await openField(container);
    await type(container, 'changed-cookie');

    await waitFor(() => expect(cancelButton(container)).not.toBeNull());
  });

  it('restores the value the field was opened with, and closes it', async () => {
    const { container } = renderForm();
    await openField(container);
    await type(container, 'changed-cookie');
    await waitFor(() => expect(cancelButton(container)).not.toBeNull());

    fireEvent.click(cancelButton(container)!);

    await waitFor(() => expect(isExpanded(container)).toBe(false));
    await waitFor(() =>
      expect(container.querySelector('[data-field="cookie_name"]')?.textContent).toContain(
        'my-cookie'
      )
    );
  });

  it('discards on Escape rather than keeping the edit', async () => {
    // The regression: Escape used to collapse the row and keep what had been
    // typed, so it committed silently.
    const { container } = renderForm();
    await openField(container);
    await type(container, 'changed-cookie');
    await waitFor(() => expect(cancelButton(container)).not.toBeNull());

    fireEvent.keyDown(editor(container)!, { key: 'Escape' });

    await waitFor(() => expect(isExpanded(container)).toBe(false));
    await waitFor(() =>
      expect(container.querySelector('[data-field="cookie_name"]')?.textContent).toContain(
        'my-cookie'
      )
    );
  });

  it('keeps the edit when Done is used instead', async () => {
    // The counterpart assertion: cancelling must not be the only outcome.
    const { container } = renderForm();
    await openField(container);
    await type(container, 'changed-cookie');
    // The Cancel button appearing is the signal that the typed value has
    // reached the form — waiting on it keeps this deterministic without a
    // sleep, since the commit out of the editor is asynchronous.
    await waitFor(() => expect(cancelButton(container)).not.toBeNull());

    fireEvent.click(container.querySelector('.options-readfirst-done')!);

    await waitFor(() => expect(isExpanded(container)).toBe(false));
    await waitFor(() =>
      expect(container.querySelector('[data-field="cookie_name"]')?.textContent).toContain(
        'changed-cookie'
      )
    );
  });

  it('closes without a value change when Escape is pressed on an untouched field', async () => {
    const { container, onChange } = renderForm();
    await openField(container);
    onChange.mockClear();

    fireEvent.keyDown(editor(container)!, { key: 'Escape' });

    await waitFor(() => expect(isExpanded(container)).toBe(false));
    expect(onChange).not.toHaveBeenCalled();
  });
});
