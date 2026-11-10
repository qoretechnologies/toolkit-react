import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { messageDrawsAttention } from '../src/components/form/engine/OptionFieldMessages';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/* A warning that informs without asking for anything (`attention: false`): a field whose choices the server could
 * not offer says why with one. The user can do nothing about it in the form, so it must not put the field under
 * "Needs attention" or make the form read "Incomplete" — unless the field is required, which no message changes. */

const REASON =
  "You can't choose from this list because your user doesn't have the permission to see the items in it.";

const form = (required: boolean, attention?: boolean) =>
  ({
    name: { type: 'string', display_name: 'Name', required: true, preselected: true },
    collections: {
      type: 'list',
      display_name: 'Collections',
      preselected: true,
      required,
      messages: [
        { intent: 'warning', content: REASON, ...(attention === undefined ? {} : { attention }) },
      ],
    },
  }) as never;

const renderForm = (options: never, appearance?: 'calm' | 'classic') =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          appearance={appearance}
          name='test'
          value={{ name: { type: 'string', value: 'Support assistant' } } as never}
          options={options}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const boxLabelled = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('.options-readfirst-group')].find((group) =>
    (group.textContent || '').startsWith(label)
  );

describe('a warning that asks for nothing', () => {
  it('is shown, but leaves an optional field out of Needs attention and the form complete', async () => {
    const { container } = renderForm(form(false, false));
    await waitFor(() => expect(container.textContent).toContain(REASON));
    expect(boxLabelled(container, 'Needs attention')).toBeUndefined();
    expect(boxLabelled(container, 'To fill in')).toBeUndefined();
    expect(container.textContent).not.toContain('Incomplete');
  });

  /* The first box holds what is left to do. On a new form it reads "To fill in" (not "Needs attention") while all it
   * holds is a required field nobody has been to yet, which is the next step and not a fault, in either look. */
  it.each(['calm', 'classic'] as const)(
    'still puts a required field in the first box (%s)',
    async (appearance) => {
      const { container } = renderForm(form(true, false), appearance);
      await waitFor(() =>
        expect(boxLabelled(container, 'To fill in')?.textContent).toContain('Collections')
      );
      expect(container.textContent).toContain('Incomplete');
    }
  );

  it('leaves an ordinary warning drawing attention, as before', async () => {
    const { container } = renderForm(form(false));
    await waitFor(() =>
      expect(boxLabelled(container, 'Needs attention')?.textContent).toContain('Collections')
    );
  });
});

describe('messageDrawsAttention', () => {
  it('is true for a warning unless it says otherwise, and never for other intents', () => {
    expect(messageDrawsAttention({ intent: 'warning' })).toBe(true);
    expect(messageDrawsAttention({ intent: 'warning', attention: true })).toBe(true);
    expect(messageDrawsAttention({ intent: 'warning', attention: false })).toBe(false);
    expect(messageDrawsAttention({ intent: 'info' })).toBe(false);
    expect(messageDrawsAttention({ intent: 'danger' })).toBe(false);
  });
});
