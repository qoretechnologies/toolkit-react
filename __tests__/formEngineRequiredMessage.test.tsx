import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
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

describe('an empty required field', () => {
  it('states the requirement on arrival, and counts as needing attention', async () => {
    renderForm();
    // The row is open — this is the state the reader actually meets.
    await waitFor(() => expect(document.querySelector('[data-field="title"]')).toBeTruthy());
    await waitFor(() =>
      expect(document.querySelector('[data-field="title"]')!.className).not.toContain(
        'readfirst-row'
      )
    );
    await waitFor(() => expect(document.body.textContent).toContain(REQUIRED_MESSAGE));
    expect(document.body.textContent).toContain('Needs attention');
  });

  it('states the error once the reader has been in it and left it empty', async () => {
    const user = userEvent.setup();
    // A filled field needs no attention, so nothing auto-opens it; the reader
    // opens it themselves, which `initialExpandedOptions` stands in for here.
    renderForm(
      { title: { type: 'string', value: 'Order intake' } },
      {
        initialExpandedOptions: ['title'],
      }
    );
    const input = await screen.findByDisplayValue('Order intake');
    await user.clear(input);
    await waitFor(() => expect(document.body.textContent).toContain(REQUIRED_MESSAGE));
  });

  it('states the requirement on a READ-ONLY form, once', async () => {
    renderForm({}, { readOnly: true, expandFirstRequired: false });
    await waitFor(() => expect(document.querySelector('[data-field="title"]')).toBeTruthy());
    const row = document.querySelector('[data-field="title"]')!;
    await waitFor(() => expect(row.textContent).toContain(REQUIRED_MESSAGE));
    // said once: the value slot keeps its plain "not set" dash
    expect(row.textContent!.split(REQUIRED_MESSAGE)).toHaveLength(2);
    expect(row.querySelector('.options-readfirst-valuetext')!.textContent).toBe('—');
  });

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
