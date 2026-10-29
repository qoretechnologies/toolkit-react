import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fixOptions, FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A required field that arrives with the schema is the row the first-required scan opens, though the form
 * adds it to its value only one render after the schema (the rebuild for a new schema is an effect).
 *
 * The Qorus IDE's pipeline processor form (qorus#646): the value holds the processor, the schema arrives
 * after the form mounts and makes a field mapping required; the scan ran on the value as it was before the
 * rebuild, found nothing to open, and was spent - the mappings row stayed closed, its "Field mappings
 * required" panel never shown.
 */
const PROCESSOR = {
  type: 'string',
  display_name: 'Processor Class',
  required: true,
  allowed_values: [
    { name: 'ProcessorTypeTest', value: 'ProcessorTypeTest' },
    { name: 'qogcompatibilitytest', value: 'qogcompatibilitytest' },
  ],
  sort: 1,
};

const MAPPINGS = {
  type: 'list',
  ui_type: 'list',
  display_name: 'Field Mappings',
  required: true,
  depends_on: ['processor'],
  sort: 2,
};

const VALUE = { processor: { type: 'string', value: 'qogcompatibilitytest' } };

const Form = ({
  options,
  value = VALUE,
  onChange = vi.fn(),
}: {
  options?: Record<string, unknown>;
  value?: Record<string, unknown>;
  onChange?: (value: unknown) => void;
}) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext}>
      <FormEngine
        compact
        name='processor'
        value={value as never}
        options={options as never}
        expandFirstRequired
        onChange={onChange as never}
      />
    </FetchContext.Provider>
  </ReqoreUIProvider>
);

/**
 * The Qorus IDE's read-first options form: it waits behind the skeleton until the schema arrives, hands the
 * value through `fixOptions` (so the value already holds the schema's required fields when the schema reaches
 * the form, a render before the form takes the schema in) and asks for both the row and the caret.
 */
const HostForm = ({ schema }: { schema?: Record<string, unknown> }) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext}>
      <FormEngine
        compact
        name='processor'
        skeleton={!schema}
        value={fixOptions(VALUE as never, schema as never) as never}
        options={(schema ?? NO_SCHEMA) as never}
        autoFocusFirstRequired
        expandFirstRequired
        onChange={vi.fn()}
      />
    </FetchContext.Provider>
  </ReqoreUIProvider>
);

/** One object for "no schema yet", as a host keeps it, so a render without one does not hand the form a new one. */
const NO_SCHEMA = {};

/** An expanded row renders as an edit card; a collapsed one as a read row. */
const isExpanded = (field: string) => {
  const el = document.querySelector(`[data-field="${field}"]`);
  expect(el, `no row rendered for "${field}"`).toBeTruthy();
  return !el!.className.includes('readfirst-row');
};

describe('a required field that arrives with the schema', () => {
  it('is opened by the first-required scan, though the value holds it one render later', async () => {
    const { rerender } = render(<Form />);

    // nothing to draw yet: the schema has not arrived
    expect(document.querySelector('[data-field="processor"]')).toBeNull();

    rerender(<Form options={{ processor: PROCESSOR, mappings: MAPPINGS }} />);

    await waitFor(() => expect(document.querySelector('[data-field="mappings"]')).toBeTruthy());
    await waitFor(() => expect(isExpanded('mappings')).toBe(true));
    // the processor is set: it is not what needs an answer
    expect(isExpanded('processor')).toBe(false);
  });

  it('is opened when the schema arrives in pieces and it is in a later one', async () => {
    const { rerender } = render(<Form options={{ processor: PROCESSOR }} />);

    // the first piece needs no answer: nothing is opened
    await waitFor(() => expect(document.querySelector('[data-field="processor"]')).toBeTruthy());
    expect(isExpanded('processor')).toBe(false);
    expect(document.querySelector('[data-field="mappings"]')).toBeNull();

    rerender(<Form options={{ processor: PROCESSOR, mappings: MAPPINGS }} />);

    await waitFor(() => expect(document.querySelector('[data-field="mappings"]')).toBeTruthy());
    await waitFor(() => expect(isExpanded('mappings')).toBe(true));
  });

  it('is opened when the host adds it to the value itself and the form takes the schema in a render later', async () => {
    const { rerender } = render(<HostForm />);

    rerender(<HostForm schema={{ processor: PROCESSOR, mappings: MAPPINGS }} />);

    await waitFor(() => expect(document.querySelector('[data-field="mappings"]')).toBeTruthy());
    await waitFor(() => expect(isExpanded('mappings')).toBe(true));
  });

  it('opens nothing when the schema it arrives with needs no answer', async () => {
    const { rerender } = render(<Form />);

    rerender(
      <Form options={{ processor: PROCESSOR, mappings: { ...MAPPINGS, required: false } }} />
    );

    await waitFor(() => expect(document.querySelector('[data-field="processor"]')).toBeTruthy());
    expect(isExpanded('processor')).toBe(false);
    // an optional field is not added to the value, so it has no row
    expect(document.querySelector('[data-field="mappings"]')).toBeNull();
  });

  it('is not opened once the user has chosen where to work', async () => {
    const { rerender } = render(<Form options={{ processor: PROCESSOR }} />);

    await waitFor(() => expect(document.querySelector('[data-field="processor"]')).toBeTruthy());
    // the user opens the processor's row
    fireEvent.click(document.querySelector('[data-field="processor"]')!);
    await waitFor(() => expect(isExpanded('processor')).toBe(true));

    rerender(<Form options={{ processor: PROCESSOR, mappings: MAPPINGS }} />);

    await waitFor(() => expect(document.querySelector('[data-field="mappings"]')).toBeTruthy());
    expect(isExpanded('mappings')).toBe(false);
    expect(isExpanded('processor')).toBe(true);
  });

  it('a field already in the form that comes to need an answer is not opened', async () => {
    const options = { processor: PROCESSOR };
    const { rerender } = render(<Form options={options} />);

    await waitFor(() => expect(document.querySelector('[data-field="processor"]')).toBeTruthy());
    expect(isExpanded('processor')).toBe(false);

    // the host clears the processor: it now needs an answer, but it did not just arrive
    rerender(<Form options={options} value={{ processor: { type: 'string', value: '' } }} />);

    await waitFor(() =>
      expect(document.querySelector('[data-field="processor"]')!.textContent).not.toContain(
        'qogcompatibilitytest'
      )
    );
    expect(isExpanded('processor')).toBe(false);
  });
});
