import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A new form is not already wrong. It used to open with "2 need attention" and every
 * required field in amber before anyone had typed a thing, so the first thing a person
 * met was a list of faults. Until they have been to a field (opened it and left it) or
 * the host reports a submit attempt (`revealRequired`), an empty required field is only
 * still to fill in: the first box reads "To fill in", in the quiet colour.
 */
const SCHEMA = {
  title: { type: 'string', ui_type: 'string', display_name: 'Title', required: true },
  owner: { type: 'string', ui_type: 'string', display_name: 'Owner', required: true },
} as never;

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='iface'
          value={{} as never}
          options={SCHEMA}
          expandFirstRequired={false}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const header = async () => {
  await waitFor(() => expect(document.querySelector('.options-readfirst-completion')).toBeTruthy());
  return (document.querySelector('.options-readfirst-completion') as HTMLElement).textContent || '';
};

describe('a new form', () => {
  it('opens with its required fields to fill in, not as faults', async () => {
    renderForm();
    const text = await header();
    expect(text).toContain('2 to fill in');
    expect(text).not.toContain('need attention');
    expect(document.body.textContent).toContain('To fill in');
    expect(document.body.textContent).not.toContain('Needs attention');
  });

  it('shows every empty required field as needing attention after a submit attempt', async () => {
    renderForm({ revealRequired: true });
    const text = await header();
    expect(text).toContain('2 need attention');
    expect(document.body.textContent).toContain('Needs attention');
    expect(document.body.textContent).not.toContain('To fill in');
  });

  it('tells the host the same two numbers its readiness line shows', async () => {
    const onAttentionChange = vi.fn();
    const { rerender } = renderForm({ onAttentionChange });
    await header();
    await waitFor(() => expect(onAttentionChange).toHaveBeenLastCalledWith({ count: 2, faults: 0 }));

    rerender(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='iface'
            value={{} as never}
            options={SCHEMA}
            expandFirstRequired={false}
            onChange={vi.fn()}
            onAttentionChange={onAttentionChange}
            revealRequired
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(onAttentionChange).toHaveBeenLastCalledWith({ count: 2, faults: 2 }));
  });

  /* The answer to a submit that could not go is where to type. The submit button
     holds the caret when it is pressed; each request moves it to the first field that
     needs attention, and a second press moves it again. */
  it('moves the caret from the submit button to the first field to fill in, on every request', async () => {
    const formWith = (focusAttentionRequest?: number) => (
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <button type='button'>Submit</button>
          <FormEngine
            compact
            name='iface'
            value={{} as never}
            options={SCHEMA}
            expandFirstRequired={false}
            onChange={vi.fn()}
            revealRequired={!!focusAttentionRequest}
            focusAttentionRequest={focusAttentionRequest}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    const { rerender } = render(formWith(undefined));
    await header();
    const submit = screen.getByRole('button', { name: 'Submit' });
    submit.focus();

    rerender(formWith(1));
    await waitFor(() =>
      expect(
        document.querySelector('[data-field="title"]')?.contains(document.activeElement)
      ).toBe(true)
    );

    // Pressed again with the field still open: the caret goes back to it.
    submit.focus();
    rerender(formWith(2));
    await waitFor(() =>
      expect(
        document.querySelector('[data-field="title"]')?.contains(document.activeElement)
      ).toBe(true)
    );
  });

  /* "N need attention →" shows only the fields that need attention. The first character
     typed into an empty required field makes it valid; the row being typed in must not
     vanish then, or the rest of the word goes nowhere. */
  it('keeps the field being typed in while the form shows only what needs attention', async () => {
    const user = userEvent.setup();
    // Controlled, as a host holds it: each keystroke comes back as the form's value.
    const Controlled = () => {
      const [value, setValue] = useState<Record<string, unknown>>({});
      return (
        <ReqoreUIProvider>
          <FetchContext.Provider value={fetchContext}>
            <FormEngine
              compact
              name='iface'
              value={value as never}
              options={SCHEMA}
              expandFirstRequired={false}
              initialExpandedOptions={['title']}
              revealRequired
              onChange={(_name, next) => setValue((next ?? {}) as Record<string, unknown>)}
            />
          </FetchContext.Provider>
        </ReqoreUIProvider>
      );
    };
    render(<Controlled />);
    await header();
    await user.click(document.querySelector('.options-readfirst-attention-link') as HTMLElement);
    const input = await waitFor(() => {
      const found = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '[data-field="title"] input, [data-field="title"] textarea'
      );
      expect(found).toBeTruthy();
      return found!;
    });
    await user.click(input);
    // The first letters reach the form (the field is valid now), then the rest is typed.
    await user.keyboard('Or');
    await waitFor(() =>
      expect(document.querySelector('.options-readfirst-attention-link')?.textContent).toContain(
        '1 need attention'
      )
    );
    expect(input.isConnected).toBe(true);
    await user.keyboard('der sync');

    await waitFor(() => expect(input.value).toBe('Order sync'));
    expect(document.activeElement).toBe(input);
  });

  it('turns a field into a fault once someone has been to it and left it empty', async () => {
    const user = userEvent.setup();
    // The reader has the Title row open; opening Owner closes it (one row at a time),
    // so Title has been visited and left empty.
    renderForm({ initialExpandedOptions: ['title'] });
    await waitFor(() => expect(document.querySelector('[data-field="owner"]')).toBeTruthy());
    expect(await header()).toContain('to fill in');
    await user.click(document.querySelector('[data-field="owner"]') as HTMLElement);
    await waitFor(async () => expect(await header()).toContain('need attention'));
    expect(screen.getByText('Needs attention')).toBeTruthy();
  });
});
