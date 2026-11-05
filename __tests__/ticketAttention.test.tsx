// Copyright 2026 Qore Technologies, s.r.o.
// A ticket's status and priority take a color only when they need the person looking at it, decided once here.
//
// The IDE's support pages, the Qonsole ticket card and the staff portal each kept their own copy of that rule,
// while the shared vocabulary gave every value a tint of its own (New blue, Open gold, Resolved green, Bug red,
// Feature request green, Normal blue), which `TicketMetaTags` drew as tinted tags.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ticketPriorityAttention,
  ticketStatusAttention,
  TTicketAttention,
  TTicketPriority,
  TTicketStatus,
} from '../src/components/supportTicket/meta';
import { TicketMetaTags } from '../src/components/supportTicket/TicketMetaTags';
import { describeWorkspaceAccess } from '../src/components/supportTicket/WorkspaceAccessStatus';

const STATUSES: TTicketStatus[] = ['new', 'open', 'awaiting_customer', 'resolved', 'closed'];

describe("a ticket status's attention", () => {
  it('asks the customer only for the reply the ticket waits on', () => {
    expect(STATUSES.map((status) => ticketStatusAttention(status, 'customer'))).toEqual<
      TTicketAttention[]
    >(['quiet', 'quiet', 'warn', 'quiet', 'idle']);
  });

  it('asks staff to triage a new ticket; an open one is being worked, a resolved one is done', () => {
    expect(STATUSES.map((status) => ticketStatusAttention(status, 'staff'))).toEqual<
      TTicketAttention[]
    >(['warn', 'live', 'quiet', 'good', 'idle']);
  });

  it('asks nobody on a neutral surface', () => {
    expect(STATUSES.map((status) => ticketStatusAttention(status))).toEqual<TTicketAttention[]>([
      'quiet',
      'quiet',
      'quiet',
      'quiet',
      'idle',
    ]);
  });
});

describe("a ticket priority's attention", () => {
  it('is red for urgent, amber for high and quiet otherwise', () => {
    const priorities: TTicketPriority[] = ['low', 'normal', 'high', 'urgent'];
    expect(priorities.map(ticketPriorityAttention)).toEqual<TTicketAttention[]>([
      'quiet',
      'quiet',
      'warn',
      'bad',
    ]);
  });
});

const draw = (props: Partial<Parameters<typeof TicketMetaTags>[0]> = {}) =>
  render(
    <ReqoreUIProvider>
      <TicketMetaTags
        ticket={{ status: 'awaiting_customer', priority: 'urgent', category: 'bug' }}
        {...props}
      />
    </ReqoreUIProvider>
  );

const word = (container: HTMLElement, key: string) =>
  container.querySelector<HTMLElement>(`.ticket-meta-${key}`);

describe('TicketMetaTags', () => {
  it('says a ticket in words, not tinted tags, by default', () => {
    const { container } = draw({ viewerRole: 'customer' });
    expect(container.querySelector('.reqore-tag')).toBeNull();
    expect(word(container, 'status')?.textContent).toBe('Awaiting your reply');
    expect(word(container, 'priority')?.textContent).toBe('Urgent');
    expect(word(container, 'category')?.textContent).toBe('Bug');
  });

  it('colors only what needs the person looking: never the category', () => {
    const { container } = draw({ viewerRole: 'customer' });
    expect(word(container, 'status')?.dataset.attention).toBe('warn');
    expect(word(container, 'priority')?.dataset.attention).toBe('bad');
    expect(word(container, 'category')?.dataset.attention).toBe('quiet');
    // a bug is a topic, not a failure: the category reads in the same soft shade as the dot between words
    const category = getComputedStyle(word(container, 'category') as HTMLElement).color;
    const status = getComputedStyle(word(container, 'status') as HTMLElement).color;
    expect(category).not.toBe(status);
  });

  it("reads the status from staff's side when staff look", () => {
    const { container } = draw({
      viewerRole: 'staff',
      ticket: { status: 'awaiting_customer', priority: 'normal', category: 'feature' },
    });
    expect(word(container, 'status')?.textContent).toBe('Awaiting customer');
    expect(word(container, 'status')?.dataset.attention).toBe('quiet');
    expect(word(container, 'priority')?.dataset.attention).toBe('quiet');
  });

  it('leaves the category out when asked', () => {
    const { container } = draw({ hideCategory: true });
    expect(word(container, 'category')).toBeNull();
  });

  it('keeps the tinted tags in the classic look', () => {
    const { container } = draw({ appearance: 'classic' });
    expect(container.querySelectorAll('.reqore-tag').length).toBe(3);
    expect(container.querySelector('.ticket-meta-word')).toBeNull();
  });
});

describe("the workspace-access line's attention", () => {
  const NOW = Date.parse('2026-10-19T12:00:00Z');
  const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();
  const grant = (expiresInMinutes: number) => ({
    state: 'active',
    created_by_type: 'customer',
    expires_at: at(expiresInMinutes),
  });

  it('is quiet for a running grant and asks for the reader only within its last hour', () => {
    expect(describeWorkspaceAccess({ viewerRole: 'staff', now: NOW, grant: grant(2 * 24 * 60) }).attention).toBe('quiet');
    expect(describeWorkspaceAccess({ viewerRole: 'staff', now: NOW, grant: grant(40) }).attention).toBe('warn');
    expect(describeWorkspaceAccess({ viewerRole: 'staff', now: NOW, grant: grant(-5) }).attention).toBe('idle');
  });

  it("asks the customer to answer a request; support only waits for it", () => {
    const request = { requested_at: at(-45) };
    expect(describeWorkspaceAccess({ viewerRole: 'customer', now: NOW, request }).attention).toBe('warn');
    expect(describeWorkspaceAccess({ viewerRole: 'staff', now: NOW, request }).attention).toBe('quiet');
  });

  it('reads a setting of never as a choice, not a fault, and keeps the classic red for it', () => {
    const never = describeWorkspaceAccess({ viewerRole: 'staff', now: NOW, policy: 'never' });
    expect(never.attention).toBe('quiet');
    expect(never.intent).toBe('danger');
  });

  it('reads an ended grant and no access at all as over', () => {
    const revoked = { state: 'revoked', ended_at: at(-60), end_cause: 'staff_revoked' };
    expect(describeWorkspaceAccess({ viewerRole: 'staff', now: NOW, grant: revoked }).attention).toBe('idle');
    expect(describeWorkspaceAccess({ viewerRole: 'staff', now: NOW }).attention).toBe('idle');
  });
});
