// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/*
 * The Optional box is folded by default, and it opened only for a field the host asked to open. A row that stays open
 * (`alwaysExpandedOptions`) and is optional, empty and disabled with a message saying why was folded away with it, so
 * the reason was never read. A box holding such a row opens for it, whether or not the value holds the field yet.
 */
const OPTIONS = {
  name: { type: 'string', display_name: 'Name', required: true },
  mappings: {
    type: 'hash',
    ui_type: 'mappings-panel',
    display_name: 'Field mappings',
    disabled: true,
    messages: [{ intent: 'info', content: 'Nothing leads into this processor yet.' }],
  },
} as never;

const NAME = { name: { type: 'string', value: 'processor' } };

const form = (value: unknown, alwaysExpandedOptions?: string[]) => {
  const onChange = vi.fn();
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='processor'
          value={value as never}
          options={OPTIONS}
          onChange={onChange}
          alwaysExpandedOptions={alwaysExpandedOptions}
          componentOverrides={{ 'mappings-panel': () => <div>The mappings editor</div> } as never}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  return onChange;
};

describe('an always-open field inside Optional', () => {
  it('opens the box for a field the value does not hold yet, and writes nothing for it', async () => {
    const onChange = form(NAME, ['mappings']);
    expect(await screen.findByText('The mappings editor')).toBeTruthy();
    expect(screen.getByText('Nothing leads into this processor yet.')).toBeTruthy();
    // opening the row adds nothing to the value: a disabled field nobody filled in stays out of it
    for (const [, next] of onChange.mock.calls) {
      expect(next?.mappings?.value).toBeUndefined();
    }
  });

  it('opens the box for a field the value holds empty', async () => {
    form({ ...NAME, mappings: { type: 'hash', value: undefined } }, ['mappings']);
    expect(await screen.findByText('The mappings editor')).toBeTruthy();
    expect(screen.getByText('Nothing leads into this processor yet.')).toBeTruthy();
  });

  it('keeps the box folded when the field is not one that stays open', async () => {
    form(NAME);
    await waitFor(() => expect(document.querySelector('.options-readfirst-status')).toBeTruthy());
    expect(screen.queryByText('The mappings editor')).toBeNull();
    expect(screen.queryByText('Nothing leads into this processor yet.')).toBeNull();
  });
});
