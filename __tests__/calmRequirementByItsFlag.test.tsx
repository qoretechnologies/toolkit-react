// Copyright 2026 Qore Technologies, s.r.o.
/*
 * A calm row says an empty required field's requirement in its value column, so its reasons leave the requirement out
 * - told by the message's flag (`requirement`), never by comparing its words to the value column's. The words are the
 * host's (`setReqraftLabels`): compared, a host whose words for two different things happen to be the same lost the
 * other one too (design/IDE_INTEGRATION.md, "Code does not compare a word to decide what to do").
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';
import { FetchContext } from '../src/contexts/FetchContext';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';
import { emptyFetchContext } from './support/fetchContext';

afterEach(() => {
  setReqraftLabels();
});

const SCHEMA = {
  title: {
    type: 'string',
    display_name: 'Title',
    required: true,
    preselected: true,
    default_value_desc: 'The server names it',
  },
} as never;

const messagesOf = (calm: boolean, requirementPending = false) =>
  getOptionFieldMessages({
    schema: SCHEMA,
    option: { type: 'string' } as never,
    name: 'title',
    allOptions: {} as never,
    getType: (type: string) => type,
    calm,
    requirementPending,
  });

describe('the message that says a field is required', () => {
  it('says so by its flag, in either look, before and after the field is visited', () => {
    for (const calm of [true, false]) {
      for (const pending of [true, false]) {
        const messages = messagesOf(calm, pending);
        expect(messages).toHaveLength(1);
        expect(messages[0].requirement).toBe(true);
      }
    }
  });

  it('is the only one flagged', () => {
    const messages = getOptionFieldMessages({
      schema: {
        kind: { type: 'string', display_name: 'Kind', allowed_values: [{ value: 'a' }] },
      } as never,
      option: { type: 'string', value: 'gone' } as never,
      name: 'kind',
      allOptions: {} as never,
      getType: (type: string) => type,
      calm: true,
    });
    expect(messages.map((message) => message.label)).toEqual([
      '"gone" is not one of the choices · pick one from the list',
    ]);
    expect(messages[0].requirement).toBeFalsy();
  });
});

describe('a calm row of an empty required field', () => {
  const reasons = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.options-readfirst-reason')).map(
      (reason) => reason.textContent
    );

  const form = () =>
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            name='requirement'
            value={{} as never}
            options={SCHEMA}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

  it('says the requirement once, in its value column, and keeps its other reasons', async () => {
    const { container } = form();
    await waitFor(() => expect(container.textContent).toContain('Required · add a value'));
    expect(reasons(container)).toEqual(['Default:  — The server names it']);
  });

  it('keeps a reason a host words the same as the requirement', async () => {
    setReqraftLabels({
      formEngine: { calmRequired: 'Pflicht', defaultIs: () => 'Pflicht' },
    });
    const { container } = form();
    await waitFor(() => expect(container.textContent).toContain('Pflicht'));
    // the value column's words, and the default's note: two things, both said
    expect(reasons(container)).toEqual(['Pflicht']);
    expect(container.querySelector('.options-readfirst-valuetext')?.textContent).toBe('Pflicht');
  });
});
