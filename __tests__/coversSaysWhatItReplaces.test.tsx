// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { DEFAULT_REQRAFT_LABELS, setReqraftLabels } from '../src/helpers/reqraftLabels';
import { emptyFetchContext } from './support/fetchContext';

/*
 * In a group of fields of which one must be set, the field that is set carried a chip that said
 * "Covers", and the word alone did not say what it covered. It now says what the field is set
 * instead of: the other field by name, or how many others there are.
 */
const member = (display_name: string, group: string) => ({
  type: 'string',
  ui_type: 'string',
  display_name,
  required_groups: ['target'],
  preselected: true,
  group,
});

const GROUPS = {
  general: { label: 'General', sort: 0 },
  advanced: { label: 'Advanced', sort: 1 },
  other: { label: 'Other', sort: 2 },
};

const SET = { connection: { type: 'string', value: 'discord-alerts' } } as never;

const chipOf = async (field: string) => {
  const selector = `.readfirst-row[data-field="${field}"] .options-readfirst-required-group`;
  await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
  return document.querySelector(selector)!.textContent;
};

const form = (options: Record<string, ReturnType<typeof member>>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='alerts'
          value={SET}
          groups={GROUPS as never}
          options={options as never}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

afterEach(() => {
  setReqraftLabels();
});

describe('the field that covers its group says what it replaces', () => {
  it('names the one other field', async () => {
    form({ connection: member('Connection', 'general'), webhookUrl: member('Webhook URL', 'advanced') });
    expect(await chipOf('connection')).toContain('Instead of “Webhook URL”');
  });

  it('counts the others when there are more', async () => {
    form({
      connection: member('Connection', 'general'),
      webhookUrl: member('Webhook URL', 'advanced'),
      token: member('Token', 'other'),
    });
    expect(await chipOf('connection')).toContain('Instead of 2 others');
  });

  it("takes the host's words, given the name and the count", async () => {
    setReqraftLabels({
      formEngine: {
        covers: (first, count) => (count === 1 ? `Anstelle von „${first}“` : `Anstelle von ${count} anderen`),
      },
    });
    form({ connection: member('Connection', 'general'), webhookUrl: member('Webhook URL', 'advanced') });
    expect(await chipOf('connection')).toContain('Anstelle von „Webhook URL“');
  });

  it('says it in words a reader can take in', () => {
    const { covers } = DEFAULT_REQRAFT_LABELS.formEngine;
    expect(covers('Webhook URL', 1)).toBe('Instead of “Webhook URL”');
    expect(covers('Webhook URL', 3)).toBe('Instead of 3 others');
  });
});
