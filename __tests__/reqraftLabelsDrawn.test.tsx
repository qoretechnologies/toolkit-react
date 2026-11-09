// Copyright 2026 Qore Technologies, s.r.o.
/* What is on the page says a host's words, and says others when its language changes, with nothing else redrawing it. */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';
import { emptyFetchContext } from './support/fetchContext';

afterEach(() => {
  setReqraftLabels();
});

const form = () =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='words'
          value={{ choice: { type: 'bool', value: true } } as never}
          options={{ choice: { type: 'bool', display_name: 'Choice' } } as never}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('a form', () => {
  it('says the English it always did when a host gives nothing', async () => {
    form();
    await waitFor(() => expect(document.body.textContent).toContain('Yes'));
  });

  it('says a host’s words, and again when the language changes', async () => {
    setReqraftLabels({ formEngine: { yes: 'Ja' } });
    form();
    await waitFor(() => expect(document.body.textContent).toContain('Ja'));

    act(() => setReqraftLabels({ formEngine: { yes: 'Oui' } }));
    await waitFor(() => expect(document.body.textContent).toContain('Oui'));
    expect(document.body.textContent).not.toContain('Ja');
  });
});
