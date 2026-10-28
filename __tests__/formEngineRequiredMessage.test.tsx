import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import {
  CALM_REQUIRED_LABEL,
  CALM_REQUIRED_READ_LABEL,
  TFormEngineAppearance,
} from '../src/components/form/engine/formAppearance';
import { getOptionFieldMessages } from '../src/components/form/engine/OptionFieldMessages';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * An empty required field says "This field is required", from the start.
 *
 * The message was once held back until the reader had touched the field, so a
 * new form opened its first required field with no word on why it needed
 * attention. The requirement is a fact about what the form holds, so it shows
 * whether the field is new or was cleared, editable or read-only. A field
 * locked by an unmet dependency is the exception: it shows what unlocks it.
 */
const REQUIRED_MESSAGE = 'This field is required';

/** How each appearance says it: the classic look in a red sentence; the calm one
 *  (the default) in an amber word, which on a read-only form only states the fact. */
const REQUIRED_WORDS: Record<TFormEngineAppearance, { edit: string; read: string }> = {
  calm: { edit: CALM_REQUIRED_LABEL, read: CALM_REQUIRED_READ_LABEL },
  classic: { edit: REQUIRED_MESSAGE, read: REQUIRED_MESSAGE },
};

const SCHEMA = {
  title: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Title',
    required: true,
  },
} as never;

const renderForm = (value: Record<string, unknown> = {}, props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='iface'
          value={value as never}
          options={SCHEMA}
          expandFirstRequired
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe.each(['calm', 'classic'] as const)('an empty required field (%s)', (appearance) => {
  const words = REQUIRED_WORDS[appearance];

  it('states the requirement on arrival, and counts as still to fill in, not as a fault', async () => {
    renderForm({}, { appearance });
    // The row is open — this is the state the reader actually meets.
    await waitFor(() => expect(document.querySelector('[data-field="title"]')).toBeTruthy());
    await waitFor(() =>
      expect(document.querySelector('[data-field="title"]')!.className).not.toContain(
        'readfirst-row'
      )
    );
    await waitFor(() => expect(document.body.textContent).toContain(words.edit));
    // A new form is not already wrong: the field is to fill in until the reader has
    // been in it and left it empty.
    expect(document.body.textContent).toContain('To fill in');
    expect(document.body.textContent).not.toContain('Needs attention');
  });

  it('states the error once the reader has been in it and left it empty', async () => {
    const user = userEvent.setup();
    // A filled field needs no attention, so nothing auto-opens it; the reader
    // opens it themselves, which `initialExpandedOptions` stands in for here.
    renderForm(
      { title: { type: 'string', value: 'Order intake' } },
      {
        appearance,
        initialExpandedOptions: ['title'],
      }
    );
    const input = await screen.findByDisplayValue('Order intake');
    await user.clear(input);
    await waitFor(() => expect(document.body.textContent).toContain(words.edit));
  });

  it('states the requirement on a READ-ONLY form, once', async () => {
    renderForm({}, { appearance, readOnly: true, expandFirstRequired: false });
    await waitFor(() => expect(document.querySelector('[data-field="title"]')).toBeTruthy());
    const row = document.querySelector('[data-field="title"]')!;
    await waitFor(() => expect(row.textContent).toContain(words.read));
    expect(row.textContent!.split(words.read)).toHaveLength(2);
    // Said once. The classic value slot keeps its plain "not set" dash beside the
    // sentence; the calm word IS the value slot, where the value would be.
    expect(row.querySelector('.options-readfirst-valuetext')!.textContent).toBe(
      appearance === 'classic' ? '—' : words.read
    );
  });
});

describe('an empty required field', () => {
  it('a read-only row shows a value that is not a choice too', async () => {
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            readOnly
            name='iface'
            value={{ kind: { type: 'string', value: 'gone' } } as never}
            options={
              {
                kind: {
                  type: 'string',
                  display_name: 'Kind',
                  allowed_values: [{ value: { type: 'string', value: 'a' } }],
                },
              } as never
            }
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain('"gone" is not one of the choices')
    );
  });
});

describe('getOptionFieldMessages and the required message', () => {
  const labels = (schema: any, value?: unknown, allOptions: any = {}) =>
    getOptionFieldMessages({
      schema,
      option: { type: 'string', value } as never,
      name: 'title',
      allOptions,
      getType: (type: string) => type,
    }).map((m) => m.label);

  it('an empty required field is required', () => {
    expect(labels({ title: { type: 'string', required: true } })).toContain(REQUIRED_MESSAGE);
    expect(labels({ title: { type: 'string', required: true } }, '')).toContain(REQUIRED_MESSAGE);
  });

  it('a filled required field and an empty optional field are not', () => {
    expect(labels({ title: { type: 'string', required: true } }, 'x')).not.toContain(
      REQUIRED_MESSAGE
    );
    expect(labels({ title: { type: 'string' } })).not.toContain(REQUIRED_MESSAGE);
  });

  it('a required field locked by its dependency shows what unlocks it instead', () => {
    const schema = {
      kind: { type: 'string', display_name: 'Kind' },
      title: { type: 'string', required: true, depends_on: ['kind'] },
    };
    // the sibling is on the form, with no value yet
    const result = labels(schema, undefined, { kind: { type: 'string', value: '' } });
    expect(result).not.toContain(REQUIRED_MESSAGE);
    expect(result.join(' ')).toContain('"Kind"');
  });
});
