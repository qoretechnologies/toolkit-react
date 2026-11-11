// Copyright 2026 Qore Technologies, s.r.o.
/* What is on the page says a host's words, and says others when its language changes, with nothing else redrawing it. */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { ItemAttention } from '../src/components/form/engine/ItemAttention';
import { BooleanFormField } from '../src/components/form/fields/boolean/Boolean';
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

/* The calm look's own words (the default look) are a host's words too: the required field's amber words, the first
 * box while it only holds what is still to fill in, and the readiness line's counts. */
describe('a calm form', () => {
  const calmForm = (readOnly = false) =>
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            readOnly={readOnly}
            name='calm-words'
            value={{ choice: { type: 'bool', value: true } } as never}
            options={
              {
                title: { type: 'string', display_name: 'Title', required: true, preselected: true },
                choice: { type: 'bool', display_name: 'Choice' },
              } as never
            }
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

  it('says the English it always did when a host gives nothing', async () => {
    calmForm();
    await waitFor(() => expect(document.body.textContent).toContain('Required · add a value'));
    expect(document.body.textContent).toContain('To fill in');
    expect(document.body.textContent).toContain('1/2 set');
    expect(document.body.textContent).toContain('1 to fill in →');
  });

  it('says a host’s words for them', async () => {
    setReqraftLabels({
      formEngine: {
        calmRequired: 'Pflicht · Wert eingeben',
        boxPending: 'Auszufüllen',
        setOfTotal: (set, total) => `${set} von ${total} gesetzt`,
        toFillIn: (count) => `${count} auszufüllen →`,
      },
    });
    calmForm();
    await waitFor(() => expect(document.body.textContent).toContain('Pflicht · Wert eingeben'));
    expect(document.body.textContent).toContain('Auszufüllen');
    expect(document.body.textContent).toContain('1 von 2 gesetzt');
    expect(document.body.textContent).toContain('1 auszufüllen →');
    expect(document.body.textContent).not.toContain('Required · add a value');
    expect(document.body.textContent).not.toContain('To fill in');
  });

  it('says a host’s words for a required field nobody can fill in', async () => {
    setReqraftLabels({ formEngine: { calmRequiredRead: 'Pflicht · nicht gesetzt' } });
    calmForm(true);
    await waitFor(() => expect(document.body.textContent).toContain('Pflicht · nicht gesetzt'));
    expect(document.body.textContent).not.toContain('Required · not set');
  });
});

describe('a calm list item and a yes / no', () => {
  it('say what is left, and that a switch shows its default, in a host’s words', async () => {
    setReqraftLabels({
      formEngine: {
        needAttentionCount: (count) => `${count} à corriger`,
        toFillInCount: (count) => `${count} à remplir`,
        defaultMark: 'Par défaut',
        yes: 'Oui',
        no: 'Non',
      },
    });
    render(
      <ReqoreUIProvider>
        <ItemAttention count={3} faults={1} />
        <BooleanFormField checked isDefault onChange={vi.fn()} />
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(document.body.textContent).toContain('1 à corriger'));
    expect(document.body.textContent).toContain('2 à remplir');
    expect(document.body.textContent).toContain('Par défaut');
    expect(document.body.textContent).toContain('Oui');
    expect(document.body.textContent).not.toMatch(/need attention|to fill in|Default|Yes/);
  });
});
