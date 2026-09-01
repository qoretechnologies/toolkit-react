import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
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
 * `preselected` means "display the option by default when a new form is loaded,
 * so it's visible to the user".
 *
 * It did not. An empty non-required field buckets to `optional` whatever its
 * schema says, and `compactCollapsedGroups` defaults to `['optional']` — so the
 * Optional box was collapsed and ReqorePanel unmounts collapsed content. A new
 * test showed neither of its two `preselected: true` subject fields.
 *
 * The gate below is deliberately about WHERE A FIELD RENDERS, not about what
 * the server sends. Every existing gate checked the payload — that `preselected`
 * survived the schema round-trip — and every one of them passed while the field
 * was invisible. A rendered row IS the assertion that its box is open, because
 * ReqorePanel unmounts what it collapses.
 */

/** A form whose only visible-by-default field is preselected, plus optionals. */
const PRESELECTED_FORM = {
  subject_iface_kind: {
    type: 'string',
    display_name: 'Subject Interface Type',
    preselected: true,
  },
  subject_iface_name: {
    type: 'string',
    display_name: 'Subject Interface',
    preselected: true,
  },
  // Not preselected, no value: a genuinely not-yet-added field, which stays
  // behind the collapse.
  tags: { type: 'list', display_name: 'Tags' },
  notes: { type: 'string', display_name: 'Notes' },
} as never;

const renderForm = (options: never, value: never = {} as never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='test' value={value} options={options} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const boxLabelled = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('.options-readfirst-group')].find((group) =>
    (group.textContent || '').startsWith(label)
  );

describe('a preselected field is visible on a new form', () => {
  it('renders the preselected rows even though their box would collapse', async () => {
    // Something is SET, so the Optional box is not the whole form and the
    // "only optional rows" escape hatch does not apply: without the preselected
    // rule this box collapses and both fields disappear.
    const { container } = renderForm(
      {
        ...(PRESELECTED_FORM as object),
        name: { type: 'string', display_name: 'Name', required: true },
      } as never,
      { name: { type: 'string', value: 'my-test' } } as never
    );

    await waitFor(() =>
      expect(container.querySelector('[data-field="subject_iface_kind"]')).toBeTruthy()
    );
    expect(container.querySelector('[data-field="subject_iface_name"]')).toBeTruthy();
  });

  it('keeps the not-yet-added fields behind the inner collapse', async () => {
    // The other half of the choice: opening the box for the preselected rows
    // must not also dump every addable optional field on the author.
    const { container } = renderForm(
      {
        ...(PRESELECTED_FORM as object),
        name: { type: 'string', display_name: 'Name', required: true },
      } as never,
      { name: { type: 'string', value: 'my-test' } } as never
    );

    await waitFor(() =>
      expect(container.querySelector('[data-field="subject_iface_kind"]')).toBeTruthy()
    );
    expect(container.querySelector('.options-readfirst-more')).toBeTruthy();
    expect(container.querySelector('[data-field="tags"]')).toBeNull();
    expect(container.querySelector('[data-field="notes"]')).toBeNull();
  });

  it('puts an empty preselected field in Optional, not in Needs attention', async () => {
    // Nothing is wrong with it and it has no value, so neither of the other two
    // boxes is honest. It is visible because it is preselected, not because it
    // is a problem.
    expect(
      getReadFirstBucket(
        getReadFirstStatus({
          empty: true,
          required: false,
          covered: false,
          invalid: false,
          warned: false,
        })
      )
    ).toBe('optional');

    const { container } = renderForm(
      {
        ...(PRESELECTED_FORM as object),
        name: { type: 'string', display_name: 'Name', required: true },
      } as never,
      { name: { type: 'string', value: 'my-test' } } as never
    );

    await waitFor(() => expect(boxLabelled(container, 'Optional')).toBeTruthy());
    expect(
      boxLabelled(container, 'Optional')!.querySelector('[data-field="subject_iface_kind"]')
    ).toBeTruthy();
    expect(
      boxLabelled(container, 'Needs attention')?.querySelector('[data-field="subject_iface_kind"]')
    ).toBeFalsy();
  });

  it('opens the inner collapse for a search so a match stays reachable', async () => {
    // Same reason the boxes themselves open on a query: a collapsed panel
    // unmounts its content, so a match inside would be unfindable.
    const { container } = renderForm(
      {
        ...(PRESELECTED_FORM as object),
        name: { type: 'string', display_name: 'Name', required: true },
      } as never,
      { name: { type: 'string', value: 'my-test' } } as never
    );

    await waitFor(() =>
      expect(container.querySelector('[data-field="subject_iface_kind"]')).toBeTruthy()
    );
    expect(container.querySelector('[data-field="notes"]')).toBeNull();

    const search = container.querySelector<HTMLInputElement>(
      'input.options-readfirst-search, .options-readfirst-search input'
    );
    expect(search).toBeTruthy();
    fireEvent.change(search!, { target: { value: 'notes' } });

    await waitFor(() => expect(container.querySelector('[data-field="notes"]')).toBeTruthy());
  });

  it('does not force OTHER boxes open for a preselected field that has a value', async () => {
    // A preselected field with a value buckets to 'set', and a consumer that
    // asked for the Set box to be collapsed meant it. The visibility rule is
    // about a field nobody can see because it is empty — not a licence to
    // override every box. Forcing the Set box open here broke two FormEngine
    // stories that collapse it deliberately.
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='test'
            compactCollapsedGroups={['set', 'optional']}
            value={{ subject_iface_kind: { type: 'string', value: 'workflow' } } as never}
            options={
              {
                subject_iface_kind: {
                  type: 'string',
                  display_name: 'Subject Interface Type',
                  preselected: true,
                },
                name: { type: 'string', display_name: 'Name', required: true },
              } as never
            }
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(boxLabelled(container, 'Set')).toBeTruthy());
    // ReqorePanel unmounts collapsed content, so an absent row IS the assertion
    // that the Set box stayed collapsed.
    expect(container.querySelector('[data-field="subject_iface_kind"]')).toBeNull();
    expect(container.querySelector('.options-readfirst-more')).toBeNull();
  });

  it('leaves a form with no preselected field collapsing exactly as before', async () => {
    // The regression guard: the inner collapse is introduced ONLY by a
    // preselected row, so a form without one is untouched.
    const { container } = renderForm(
      {
        tags: { type: 'list', display_name: 'Tags' },
        notes: { type: 'string', display_name: 'Notes' },
        name: { type: 'string', display_name: 'Name', required: true },
      } as never,
      { name: { type: 'string', value: 'my-test' } } as never
    );

    await waitFor(() => expect(container.querySelector('[data-field="name"]')).toBeTruthy());
    expect(boxLabelled(container, 'Optional')).toBeTruthy();
    expect(container.querySelector('[data-field="tags"]')).toBeNull();
    expect(container.querySelector('.options-readfirst-more')).toBeNull();
  });
});
