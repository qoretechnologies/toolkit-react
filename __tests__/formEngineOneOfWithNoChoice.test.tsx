import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
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
 * The one-of affordances answer "which of these have you answered?". Where the
 * form was handed a single member of the group — the alternatives are the
 * server's API-only spellings, hidden from the form — there is no such question,
 * and a green `✓ COVERS` beside a filled-in value answers a different one: a
 * Qorus test author read it as confirmation that the service they picked was the
 * service the test is about.
 *
 * Asserted at the FORM level, not on the helper alone: the header, the chip and
 * the message are three separate renderings of the same schema fact and the
 * point of resolving it once, where the schema enters the engine, is that all
 * three stop at once.
 */
const ONE_MEMBER_GROUP = {
  service: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Service',
    required_groups: ['service-selector'],
  },
  method: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Method',
    required_groups: ['service-method-selector'],
  },
} as never;

/** Two real alternatives, so every affordance above is still expected. */
const REAL_CHOICE = {
  username: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Username',
    required_groups: ['auth'],
  },
  token: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Token',
    required_groups: ['auth'],
  },
} as never;

const renderForm = (options: never, value: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <FormEngine
          compact
          name='iface'
          value={value as never}
          options={options}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('a one-of group the form has only one member of', () => {
  it('says nothing about a choice — no header, no chip', async () => {
    renderForm(ONE_MEMBER_GROUP, {
      service: { type: 'string', value: 'qorus-saas' },
      method: { type: 'string', value: 'init' },
    });

    await waitFor(() => expect(screen.getByText('Service')).toBeTruthy());

    expect(screen.queryByText(/One of/i)).toBeNull();
    // `Covers` is the chip that started this: a green tick beside a value reads
    // as approval of the value, and the form has no opinion about the value.
    expect(screen.queryByText(/^Covers$/)).toBeNull();
    expect(screen.queryByText(/Covered by/)).toBeNull();
  });

  it('does not offer the other field as an alternative, because there is none', async () => {
    renderForm(ONE_MEMBER_GROUP);

    await waitFor(() => expect(screen.getByText('Service')).toBeTruthy());

    // The message names the group's other members. With none, it used to read
    // "This field or  is required" — a sentence with a hole in it.
    expect(screen.queryByText(/This field or/)).toBeNull();
  });
});

describe('a one-of group that does offer a choice', () => {
  it('keeps its affordances', async () => {
    renderForm(REAL_CHOICE);

    await waitFor(() => expect(screen.getByText('Username')).toBeTruthy());

    // The header is the generic one-of clustering — shared with every other
    // one-of group in the product, which is why the fix had to be in the schema
    // rather than in the affordance.
    expect(screen.getByText(/One of/i)).toBeTruthy();
  });
});
