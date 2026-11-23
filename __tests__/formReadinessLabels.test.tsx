// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormEngine, IFormReadinessLabels } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';
import { emptyFetchContext } from './support/fetchContext';

/*
 * A form that is one page of several says what its complete state means: the first page of an editor, all set, said
 * "Ready · 4/4 set · 100%" beside a Next that leads on to the real work, and a reader took the editor for finished.
 * A host gives the form its own words (`readinessLabels`); the app-wide labels stay the default.
 */
const OPTIONS = {
  title: { type: 'string', display_name: 'Title', required: true },
  owner: { type: 'string', display_name: 'Owner', required: true },
} as never;

const FILLED = {
  title: { type: 'string', value: 'Order intake' },
  owner: { type: 'string', value: 'Operations' },
} as never;

const HALF = { title: { type: 'string', value: 'Order intake' } } as never;

const status = async () => {
  await waitFor(() => expect(document.querySelector('.options-readfirst-status')).toBeTruthy());
  return document.querySelector('.options-readfirst-status')!.textContent;
};

const form = (value: never, readinessLabels?: IFormReadinessLabels) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='first-page'
          value={value}
          options={OPTIONS}
          onChange={vi.fn()}
          readinessLabels={readinessLabels}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

afterEach(() => {
  setReqraftLabels();
});

describe("a form's readiness line in its own words", () => {
  it('says Ready and Incomplete when the host gives no words of its own', async () => {
    form(FILLED);
    expect(await status()).toBe('Ready');
  });

  it("says the form's own word when everything is set", async () => {
    form(FILLED, { complete: 'This page is set' });
    expect(await status()).toBe('This page is set');
  });

  it("says the form's own word while something is left, and the labels' where it gives none", async () => {
    const { unmount } = form(HALF, { complete: 'This page is set', incomplete: 'This page needs more' });
    expect(await status()).toBe('This page needs more');
    unmount();
    form(HALF, { complete: 'This page is set' });
    expect(await status()).toBe('Incomplete');
  });

  it("keeps the host's app-wide words for what the form does not word", async () => {
    setReqraftLabels({ formEngine: { ready: 'Bereit', incomplete: 'Unvollständig' } });
    const { unmount } = form(FILLED, { incomplete: 'Diese Seite braucht mehr' });
    expect(await status()).toBe('Bereit');
    unmount();
    form(HALF, { incomplete: 'Diese Seite braucht mehr' });
    expect(await status()).toBe('Diese Seite braucht mehr');
  });
});
