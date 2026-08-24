import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * A field whose `depends_on` is not fulfilled is not offered as an addable one.
 *
 * The reported case: an auth profile's authentication scheme offers `Cookie Name`
 * and `Redirect URL`, both of which apply to the cookie scheme alone and both of
 * which carry `depends_on: ['type=cookie']`. With the scheme set to Permissive
 * they were still listed as addable — and clicking one opened a row that said
 * "This field is disabled because some dependencies are not fulfilled". The
 * affordance led nowhere, which is worse than not being there at all.
 *
 * `hasAllDependenciesFullfilled` is the same predicate on both sides, so a field
 * it will refuse to let you edit is a field it should not have offered. The gate
 * lives on `filteredOptions`, which is the single list behind all three ways a
 * field gets added — the inline addable rows, the Fields menu, and its "Select
 * all" — so the three cannot disagree about what is available.
 */

/** The scheme sub-form: one selector, two fields belonging to one of its values,
 *  and one that belongs to all of them. Modelled on `AuthProfileMetadata`. */
const SCHEME = {
  type: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Scheme Type',
    required: true,
    short_desc: 'Authentication scheme type',
  },
  cookie_name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Session Cookie Name',
    short_desc: 'Applies to the Cookie scheme alone',
    depends_on: ['type=cookie'],
  },
  redirect_url: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Redirect URL',
    short_desc: 'Applies to the Cookie scheme alone',
    depends_on: ['type=cookie'],
  },
  note: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Note',
    short_desc: 'Depends on nothing, so it is always offered',
  },
} as never;

const renderForm = (value: never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='scheme' value={value} options={SCHEME} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const withType = (type: string) => ({ type: { type: 'string', value: type } }) as never;

/** The box holding every not-yet-added field. Its header carries the count, and
 *  the count is what a reader sees before opening it — "Optional 2" was the
 *  reported symptom on a Permissive scheme. */
const optionalBox = (container: HTMLElement) =>
  [...container.querySelectorAll('.options-readfirst-group')].find((group) =>
    (group.textContent || '').startsWith('Optional')
  );

const optionalCount = (container: HTMLElement): number => {
  const box = optionalBox(container);
  if (!box) {
    // The box is not rendered at all when nothing is addable.
    return 0;
  }
  return Number(/^Optional(\d+)/.exec(box.textContent || '')?.[1] ?? 0);
};

/**
 * The Optional box starts COLLAPSED and ReqorePanel unmounts collapsed content,
 * so querying for a row without opening it finds nothing whether or not the
 * field was offered — an assertion that would pass for the wrong reason. Its
 * collapse control is the only button inside the box's header.
 */
const openOptional = async (container: HTMLElement) => {
  const box = optionalBox(container);
  expect(box).toBeTruthy();
  const toggle = box!.querySelector('button');
  expect(toggle).toBeTruthy();
  fireEvent.click(toggle!);
};

const row = (container: HTMLElement, field: string) =>
  container.querySelector(`[data-field="${field}"]`);

describe('an unfulfilled dependency withholds a field instead of offering it', () => {
  it('does not offer dependent fields while the dependency is unmet', async () => {
    const { container } = renderForm(withType('permissive'));

    await waitFor(() => expect(row(container, 'type')).toBeTruthy());

    // Only the independent field is addable. Counting rather than only checking
    // absence pins the reported symptom: the header read "Optional 2".
    expect(optionalCount(container)).toBe(1);

    await openOptional(container);
    await waitFor(() => expect(row(container, 'note')).toBeTruthy());
    expect(row(container, 'redirect_url')).toBeNull();
    expect(row(container, 'cookie_name')).toBeNull();
  });

  it('offers the same fields once the dependency holds', async () => {
    const { container } = renderForm(withType('cookie'));

    await waitFor(() => expect(row(container, 'type')).toBeTruthy());
    expect(optionalCount(container)).toBe(3);

    await openOptional(container);
    await waitFor(() => expect(row(container, 'redirect_url')).toBeTruthy());
    expect(row(container, 'cookie_name')).toBeTruthy();
  });

  it('keeps a dependent field that already has a value, so it cannot be orphaned', async () => {
    // Withholding applies to NOT-YET-ADDED fields only. A profile saved as a
    // cookie scheme and later switched to Permissive still carries the value;
    // dropping its row would hide a value that is still being submitted, with no
    // way to see or clear it. It stays listed, and renders disabled with the
    // reason — which is what the disabled treatment is for.
    const { container } = renderForm({
      type: { type: 'string', value: 'permissive' },
      redirect_url: { type: 'string', value: 'https://example.com/login' },
    } as never);

    await waitFor(() => expect(row(container, 'redirect_url')).toBeTruthy());
    expect(row(container, 'redirect_url')?.className).toContain('readfirst-row-disabled');
  });
});
