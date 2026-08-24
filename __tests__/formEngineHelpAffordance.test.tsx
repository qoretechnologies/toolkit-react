import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
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
 * A field's long description is reachable through the `?` beside its label.
 *
 * The rule this guards is the interaction-state one: an element keeps the
 * affordances it had at rest when it becomes active. Opening a field is exactly
 * when its explanation is wanted, so losing the route to it on the way in is
 * backwards.
 *
 * It has already been broken twice, in two different render paths. Compact rows
 * lost it when expanded (toolkit-react #81); the edit CARD never had it, and the
 * card is the path taken by every field with an `arg_schema` — so a nested form
 * like an auth profile's Context Mapping opened with its `desc` unreachable
 * while `short_desc` showed. Both paths are asserted here.
 */

/** A hash field with an `arg_schema` renders as the edit CARD, not an inline
 *  editor — the case that was missing the affordance. */
const NESTED = {
  context_mapping: {
    type: 'hash',
    ui_type: 'hash',
    display_name: 'Context Mapping',
    short_desc: 'How an authenticated principal becomes a Qorus user',
    desc: 'Decides how the identity presented by the authentication scheme is turned into the Qorus user the request then runs as.',
    arg_schema: {
      provider: { type: 'string', display_name: 'Mapping Provider' },
      mode: { type: 'string', display_name: 'Mapping Mode' },
    },
  },
} as never;

/** A plain scalar renders as a read row and, when opened, an inline editor. */
const SCALAR = {
  name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Internal Name',
    short_desc: 'The name the server stores',
    desc: 'The immutable internal name. It is what every reference to this object resolves through.',
  },
} as never;

/**
 * Every field is given a VALUE on purpose. The compact engine buckets fields
 * into Needs-attention / Set / Optional, and an unset optional field sits in a
 * collapsed group that renders no row at all — so a harness without values
 * asserts against an empty form and passes for the wrong reason.
 */
const renderForm = (options: never, value: never, expanded?: string[]) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='profile'
          value={value}
          options={options}
          initialExpandedOptions={expanded}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const NESTED_VALUE = {
  context_mapping: { type: 'hash', value: { provider: 'Qorus', mode: 'Default' } },
} as never;
const SCALAR_VALUE = { name: { type: 'string', value: 'order-sync' } } as never;

const helpIcons = (container: HTMLElement, field: string) =>
  container.querySelectorAll(`[data-field="${field}"] .options-readfirst-help`);

describe('an option keeps its help affordance when it is opened', () => {
  it('offers the ? on a nested (arg_schema) field at rest', async () => {
    const { container } = renderForm(NESTED, NESTED_VALUE);

    await waitFor(() => expect(container.querySelector('[data-field]')).toBeTruthy());
    expect(helpIcons(container, 'context_mapping').length).toBeGreaterThan(0);
  });

  it('KEEPS the ? on a nested field once expanded', async () => {
    // The regression: expanded, this renders the edit card, whose header carried
    // the label, the required asterisk and the badges but no `?` — so the only
    // route to `desc` disappeared at the moment it became useful.
    const { container } = renderForm(NESTED, NESTED_VALUE, ['context_mapping']);

    await waitFor(() => expect(container.querySelector('.options-readfirst-card')).toBeTruthy());
    expect(helpIcons(container, 'context_mapping').length).toBeGreaterThan(0);
  });

  it('keeps the ? on a scalar field once expanded', async () => {
    // The path fixed by toolkit-react #81 — asserted here so the two cannot
    // drift apart again.
    const { container } = renderForm(SCALAR, SCALAR_VALUE, ['name']);

    await waitFor(() => expect(container.querySelector('[data-field="name"]')).toBeTruthy());
    expect(helpIcons(container, 'name').length).toBeGreaterThan(0);
  });

  it('offers no ? when a field has no long description to reach', async () => {
    // The affordance has to mean something: a `?` that opens an empty dialog is
    // worse than no `?`, so it is bound to `desc` being present, not to the
    // field being expanded.
    const { container } = renderForm(
      {
        plain: {
          type: 'string',
          ui_type: 'string',
          display_name: 'Plain',
          short_desc: 'Has a short description only',
        },
      } as never,
      { plain: { type: 'string', value: 'set' } } as never,
      ['plain']
    );

    await waitFor(() => expect(container.querySelector('[data-field="plain"]')).toBeTruthy());
    expect(helpIcons(container, 'plain').length).toBe(0);
  });
});
