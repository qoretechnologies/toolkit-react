import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { getReadFirstBucket, getReadFirstStatus } from '../src/components/form/engine/readFirst';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * A field with no value of its own but a declared `default_value` is not
 * unanswered: the default is what the server will use. The row said the
 * opposite, rendering an em-dash.
 *
 * The motivating case is the `author` field, which every Qorus create form
 * carries. It used to be served the current username as its VALUE so that the
 * form showed who the object would be attributed to - but a value buckets the
 * field as one the author answered, so Author occupied a row in the "Set"
 * section of every create form to say only what the server was going to do
 * anyway. Serving it as a default instead fixes the bucketing and, without
 * this change, would have made the information disappear entirely.
 *
 * So the two halves have to hold together: the default is VISIBLE, and the
 * field is still NOT SET.
 */

const DEFAULTED_FORM = {
  name: { type: 'string', display_name: 'Name', required: true },
  // the shape the server sends: default_value is UI-wrapped as {type, value}
  author: {
    type: 'string',
    display_name: 'Author',
    default_value: { type: 'string', value: 'dnichols' },
  },
  // a default that is not an envelope is equally valid
  mode: { type: 'string', display_name: 'Mode', default_value: 'simulate' },
  // no default at all: still an em-dash, which is the honest answer for it
  notes: { type: 'string', display_name: 'Notes' },
} as never;

const renderForm = (options: never, value: never = {} as never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='test'
          value={value}
          options={options}
          onChange={vi.fn()}
          // this gate is about what a rendered row SAYS, not about which box is
          // open; `compactCollapsedGroups` is a default parameter, so passing a
          // value replaces the ['optional'] default rather than adding to it
          compactCollapsedGroups={[]}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** A field the form has not added yet still renders as a browsable row in the
    Optional box, which is where the author first meets it - and where the
    default it would contribute is worth seeing. */
const waitForRow = async (container: HTMLElement, field: string) =>
  waitFor(() => expect(container.querySelector(`[data-field="${field}"]`)).toBeTruthy());

const rowText = (container: HTMLElement, field: string) =>
  container
    .querySelector(`[data-field="${field}"] .options-readfirst-valuetext`)
    ?.textContent?.trim();

describe('an unset field shows the default it will use', () => {
  it('renders the default instead of an em-dash', async () => {
    const { container } = renderForm(DEFAULTED_FORM, {
      name: { type: 'string', value: 'my-test' },
    } as never);

    await waitForRow(container, 'author');
    expect(rowText(container, 'author')).toBe('dnichols');
  });

  it('accepts a bare default as well as a {type, value} envelope', async () => {
    const { container } = renderForm(DEFAULTED_FORM, {
      name: { type: 'string', value: 'my-test' },
    } as never);

    await waitForRow(container, 'mode');
    expect(rowText(container, 'mode')).toBe('simulate');
  });

  it('still shows an em-dash for a field with no default', async () => {
    const { container } = renderForm(DEFAULTED_FORM, {
      name: { type: 'string', value: 'my-test' },
    } as never);

    await waitForRow(container, 'notes');
    expect(rowText(container, 'notes')).toBe('—');
  });

  it('a value of its own wins over the default', async () => {
    const { container } = renderForm(DEFAULTED_FORM, {
      name: { type: 'string', value: 'my-test' },
      author: { type: 'string', value: 'someone-else' },
    } as never);

    await waitFor(() => expect(container.querySelector('[data-field="author"]')).toBeTruthy());
    expect(rowText(container, 'author')).toBe('someone-else');
  });

  it('showing the default does not make the field count as set', () => {
    // The whole point of serving a default rather than a value. If this flips
    // to `set`, Author is back in the "Set" box and the change achieved nothing.
    expect(
      getReadFirstBucket(
        getReadFirstStatus({
          empty: true,
          required: false,
          covered: false,
        } as never)
      )
    ).toBe('optional');
  });
});
