// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InterfaceReferenceTags } from '../src/components/supportTicket/InterfaceReferenceTags';
import { TicketThread } from '../src/components/ticketThread/TicketThread';

/**
 * A reference chip says its kind before its name. A host with its own words for the kinds passes `kindLabel`, as it
 * passes `resolveInterfaceIcon`; without it the kind is said as the reference carries it.
 */
const REFERENCES = [
  { interface_kind: 'workflow', interface_name: 'order-sync:1.2', reference_id: 'r1' },
  { interface_kind: 'data-provider', interface_name: 'orders', reference_id: 'r2' },
] as never;

describe("a reference chip's kind", () => {
  it("is said in the host's words where it gives them", () => {
    render(
      <ReqoreUIProvider>
        <InterfaceReferenceTags
          references={REFERENCES}
          kindLabel={(kind) => (kind === 'data-provider' ? 'Data provider' : 'Workflow')}
        />
      </ReqoreUIProvider>
    );

    expect(screen.getByText('Workflow')).toBeTruthy();
    expect(screen.getByText('Data provider')).toBeTruthy();
    expect(screen.queryByText('data-provider')).toBeNull();
  });

  it('is said as the reference carries it without them', () => {
    render(
      <ReqoreUIProvider>
        <InterfaceReferenceTags references={REFERENCES} />
      </ReqoreUIProvider>
    );

    expect(screen.getByText('workflow')).toBeTruthy();
    expect(screen.getByText('data-provider')).toBeTruthy();
  });
});

describe("a ticket thread's reference chips", () => {
  const MESSAGES = [
    {
      message_id: 'm1',
      author_type: 'customer',
      author_id: 'c1',
      body: 'Both of these stopped this morning.',
      created: '2026-10-19T10:00:00Z',
      referenced_interfaces: REFERENCES,
    },
  ] as never;

  it("say each kind in the host's words where it gives them", () => {
    render(
      <ReqoreUIProvider>
        <TicketThread
          messages={MESSAGES}
          kindLabel={(kind) => (kind === 'data-provider' ? 'Data provider' : 'Workflow')}
        />
      </ReqoreUIProvider>
    );

    expect(screen.getByText('Workflow')).toBeTruthy();
    expect(screen.getByText('Data provider')).toBeTruthy();
    expect(screen.queryByText('workflow')).toBeNull();
  });

  it('say each kind as the reference carries it without them', () => {
    render(
      <ReqoreUIProvider>
        <TicketThread messages={MESSAGES} />
      </ReqoreUIProvider>
    );

    expect(screen.getByText('workflow')).toBeTruthy();
  });
});
