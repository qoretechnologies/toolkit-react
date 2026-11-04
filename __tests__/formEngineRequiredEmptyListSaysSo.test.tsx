// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';
import {
  CALM_REQUIRED_LABEL,
  TFormEngineAppearance,
} from '../src/components/form/engine/formAppearance';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const REQUIRED_MESSAGE = 'This field is required';

/** How each look says it: the classic one in a red sentence, the calm one (the default) in its words. In both, a
 *  new form's first box reads "To fill in": nothing is wrong yet, it is the next step. */
const SAYS: Record<TFormEngineAppearance, { box: string; words: string }> = {
  calm: { box: 'To fill in', words: CALM_REQUIRED_LABEL },
  classic: { box: 'To fill in', words: REQUIRED_MESSAGE },
};

/**
 * A required list holding no items says "This field is required", as any other empty required field does
 * (qorus#646).
 *
 * The form counts an empty list as not set: the row is in "Needs attention", and an optional one is not saved.
 * The row's messages counted it as a value, since an empty list is truthy, so nothing said why the row needed
 * attention. An open list used to say it only because the list field reported its list as it opened, and the
 * form took that report for a cleared field; since an untouched field reports nothing (b04b6707), it said nothing
 * open or closed. Found on qlip, in FormEngine's "Clear Value Only When There Is A Value".
 */
const SCHEMA = {
  emptied: {
    type: 'list',
    ui_type: 'list',
    element_type: 'string',
    display_name: 'Emptied',
    required: true,
  },
  optional: {
    type: 'list',
    ui_type: 'list',
    element_type: 'string',
    display_name: 'Optional list',
  },
} as never;

const messagesFor = (name: string, value: unknown) =>
  getOptionFieldMessages({
    schema: SCHEMA,
    option: { type: 'list', value } as never,
    name,
    allOptions: {} as never,
    getType: (type: string) => type,
  } as never).map((message) => message.label);

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='lists'
          value={{ emptied: { type: 'list', value: [] } } as never}
          options={SCHEMA}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const row = () => document.querySelector<HTMLElement>('[data-field="emptied"]');

describe('a required list with no items', () => {
  it('is said to be required', () => {
    expect(messagesFor('emptied', [])).toEqual([REQUIRED_MESSAGE]);
  });
});

describe.each(['calm', 'classic'] as TFormEngineAppearance[])(
  'a required list with no items, in the %s look',
  (appearance) => {
    it('says so on its row, closed', async () => {
      renderForm({ appearance });
      await waitFor(() => expect(row()).toBeTruthy());
      expect(document.body.textContent).toContain(SAYS[appearance].box);
      await waitFor(() => expect(row()?.textContent).toContain(SAYS[appearance].words));
    });

    it('says so in its editor, open', async () => {
      renderForm({ appearance, initialExpandedOptions: ['emptied'] });
      await waitFor(() => expect(row()?.textContent).toContain('Add new item for "Emptied"'));
      await waitFor(() => expect(row()?.textContent).toContain(SAYS[appearance].words));
    });
  }
);

describe('what is not an empty required list says nothing of a requirement', () => {
  it('a required list with items', () => {
    expect(messagesFor('emptied', ['alpha'])).toEqual([]);
  });

  it('an optional list with no items', () => {
    expect(messagesFor('optional', [])).toEqual([]);
  });
});
