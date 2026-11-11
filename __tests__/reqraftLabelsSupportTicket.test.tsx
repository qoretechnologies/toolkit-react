// Copyright 2026 Qore Technologies, s.r.o.
/* A ticket and the composer its reply box is made of say a host's words, and the English they always did without
 * any: the vocabulary kept in maps, the sentences built outside React, and what the components draw. */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render } from '@testing-library/react';
import { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Composer } from '../src/components/composer/Composer';
import { supportAccessEventText } from '../src/components/supportTicket/accessMeta';
import {
  defaultInterfaceKindLabel,
  TICKET_PRIORITY_META,
  TICKET_STATUS_META,
  ticketStatusLabel,
} from '../src/components/supportTicket/meta';
import { TicketMetaTags } from '../src/components/supportTicket/TicketMetaTags';
import { describeWorkspaceAccess } from '../src/components/supportTicket/WorkspaceAccessStatus';
import { TicketThread } from '../src/components/ticketThread/TicketThread';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';

afterEach(() => {
  setReqraftLabels();
});

const NOW = Date.parse('2026-10-19T12:00:00Z');
const REQUEST = { requested_at: '2026-10-19T10:00:00Z', suggested_duration: '72h' };
const ENDED_BY_SUPPORT = {
  system_event: 'support_access.revoked',
  system_detail: { end_cause: 'staff_revoked' },
  body: 'Access ended.',
};

const mount = (element: ReactElement) => render(<ReqoreUIProvider>{element}</ReqoreUIProvider>);

const thread = () =>
  mount(
    <TicketThread
      viewerRole='customer'
      messages={[
        {
          message_id: 'm1',
          author_type: 'staff',
          author_id: 'agent-7',
          body: 'We are on it.',
          created: '2026-10-19T10:00:00Z',
        },
      ]}
    />
  );

const metaWord = (container: HTMLElement, key: string) =>
  container.querySelector<HTMLElement>(`.ticket-meta-${key}`)?.textContent;

describe('a ticket with nothing given', () => {
  it('says the English it always did', () => {
    expect(ticketStatusLabel('awaiting_customer', 'customer')).toBe('Awaiting your reply');
    expect(TICKET_PRIORITY_META.urgent.label).toBe('Urgent');
    expect(defaultInterfaceKindLabel('value-map')).toBe('Value maps');
    expect(defaultInterfaceKindLabel('message-queue')).toBe('Message queues');
    expect(describeWorkspaceAccess({ viewerRole: 'customer', now: NOW, request: REQUEST }).text).toContain(
      'Qorus Support asks for access for 3 days · '
    );
    expect(supportAccessEventText(ENDED_BY_SUPPORT, 'customer')).toBe(
      "Qorus Support's read-only access to this workspace ended by Qorus Support."
    );

    const { container } = thread();
    expect(container.textContent).toContain('Qorus Support');
    expect(container.textContent).toContain('1 message');
  });
});

describe("a ticket in a host's words", () => {
  it('reads them from the vocabulary maps and the sentences, and keeps English for the rest', () => {
    setReqraftLabels({
      supportTicket: {
        supportName: 'Acme Help',
        statuses: { awaiting_customer: 'Wartet auf Kunden' },
        awaitingYourReply: 'Wartet auf Sie',
        interfaceKinds: { 'value-map': 'Wertetabellen' },
        accessDurations: { '72h': '3 Tage' },
      },
    });

    expect(TICKET_STATUS_META.awaiting_customer.label).toBe('Wartet auf Kunden');
    expect(ticketStatusLabel('awaiting_customer', 'customer')).toBe('Wartet auf Sie');
    // a map entry the host did not give stays English
    expect(TICKET_STATUS_META.open.label).toBe('Open');
    expect(defaultInterfaceKindLabel('value-map')).toBe('Wertetabellen');
    expect(defaultInterfaceKindLabel('workflow')).toBe('Workflows');
    // the team's name reaches every sentence that names it
    expect(describeWorkspaceAccess({ viewerRole: 'customer', now: NOW, request: REQUEST }).text).toContain(
      'Acme Help asks for access for 3 Tage · '
    );
    expect(supportAccessEventText(ENDED_BY_SUPPORT, 'customer')).toBe(
      "Acme Help's read-only access to this workspace ended by Acme Help."
    );
  });

  it('draws them in the thread', () => {
    setReqraftLabels({
      supportTicket: { supportName: 'Acme Help', messageCount: (count) => `${count} Nachricht(en)` },
    });
    const { container } = thread();
    expect(container.textContent).toContain('Acme Help');
    expect(container.textContent).toContain('1 Nachricht(en)');
    expect(container.textContent).not.toContain('Qorus Support');
  });

  it('draws them again when the language changes', () => {
    const { container } = mount(
      <TicketMetaTags
        viewerRole='customer'
        ticket={{ status: 'awaiting_customer', priority: 'urgent', category: 'bug' }}
      />
    );
    expect(metaWord(container, 'priority')).toBe('Urgent');

    act(() =>
      setReqraftLabels({
        supportTicket: { priorities: { urgent: 'Dringend' }, categories: { bug: 'Fehler' } },
      })
    );
    expect(metaWord(container, 'priority')).toBe('Dringend');
    expect(metaWord(container, 'category')).toBe('Fehler');
    expect(metaWord(container, 'status')).toBe('Awaiting your reply');
  });
});

describe('the composer', () => {
  const composer = () => mount(<Composer editor='plain' onSend={vi.fn()} />);

  it('says the English it always did when a host gives nothing', () => {
    const { container } = composer();
    expect(container.querySelector('textarea')?.getAttribute('placeholder')).toBe('Write a message…');
    expect(container.textContent).toContain('Send');
  });

  it("says a host's words", () => {
    setReqraftLabels({ composer: { placeholder: 'Nachricht schreiben…', send: 'Senden' } });
    const { container } = composer();
    expect(container.querySelector('textarea')?.getAttribute('placeholder')).toBe(
      'Nachricht schreiben…'
    );
    expect(container.textContent).toContain('Senden');
  });
});
