// Copyright 2026 Qore Technologies, s.r.o.
// The support-ticket vocabulary qorus#693 adds: audit actions with a fallback, interface
// reference identity across kind spellings, and the delegated-access thread events.
//
// The portal's audit tab used to index TICKET_AUDIT_ACTION_META directly, so the first
// unknown action the server wrote took the whole tab down; a reference cited as a `qog`
// and read back as the `fsm` the server stores counted as two interfaces.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TICKET_SYSTEM_EVENT_META,
  dedupeInterfaceReferences,
  IInterfaceReference,
  interfaceReferenceKey,
  normalizeInterfaceKind,
  TICKET_AUDIT_ACTION_META,
  TICKET_SYSTEM_EVENT_META,
  ticketAuditActionMeta,
  ticketSystemEventMeta,
  TTicketAuditAction,
  UNKNOWN_TICKET_AUDIT_ACTION_META,
} from '../src/components/supportTicket/meta';

describe('ticketAuditActionMeta', () => {
  it('returns the vocabulary entry for every known action', () => {
    (Object.keys(TICKET_AUDIT_ACTION_META) as TTicketAuditAction[]).forEach((action) => {
      expect(ticketAuditActionMeta(action)).toBe(TICKET_AUDIT_ACTION_META[action]);
    });
  });

  it('covers the staff-read and delegated-access actions the server writes', () => {
    const actions: TTicketAuditAction[] = [
      'viewed',
      'attachment_downloaded',
      'workspace_viewed',
      'access_requested',
      'access_granted',
      'access_extended',
      'access_revoked',
      'access_expired',
      'session_launched',
    ];
    actions.forEach((action) => {
      const meta = TICKET_AUDIT_ACTION_META[action];
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.intent).toBeTruthy();
    });
  });

  it('renders an unknown action as a muted generic row that still names it', () => {
    const meta = ticketAuditActionMeta('escalated_to_engineering');
    expect(meta.intent).toBe(UNKNOWN_TICKET_AUDIT_ACTION_META.intent);
    expect(meta.icon).toBe(UNKNOWN_TICKET_AUDIT_ACTION_META.icon);
    expect(meta.label).toBe('Escalated to engineering');
  });

  it('never throws, whatever string the server sends', () => {
    expect(() => ticketAuditActionMeta('')).not.toThrow();
    expect(ticketAuditActionMeta('').intent).toBe('muted');
  });
});

describe('normalizeInterfaceKind', () => {
  it('maps the IDE spellings onto the TypeMap keys the server stores', () => {
    expect(normalizeInterfaceKind('qog')).toBe('fsm');
    expect(normalizeInterfaceKind('workflow-step')).toBe('step');
  });

  it('leaves a TypeMap key alone and tolerates case and whitespace', () => {
    expect(normalizeInterfaceKind('fsm')).toBe('fsm');
    expect(normalizeInterfaceKind(' Workflow ')).toBe('workflow');
    expect(normalizeInterfaceKind('value-map')).toBe('value-map');
  });
});

describe('interfaceReferenceKey and dedupeInterfaceReferences', () => {
  const qog: IInterfaceReference = { interface_kind: 'qog', interface_name: 'order-sync' };
  const fsm: IInterfaceReference = { interface_kind: 'fsm', interface_name: 'order-sync', reference_id: 'r1' };
  const service: IInterfaceReference = { interface_kind: 'service', interface_name: 'order-sync' };

  it('keys a reference by its normalized kind and its name, not by its ids', () => {
    expect(interfaceReferenceKey(qog)).toBe('fsm:order-sync');
    expect(interfaceReferenceKey(fsm)).toBe('fsm:order-sync');
    expect(interfaceReferenceKey({ ...fsm, interface_id: 42, groupid: 7 })).toBe('fsm:order-sync');
    expect(interfaceReferenceKey(service)).toBe('service:order-sync');
  });

  it('treats a qog and the fsm the server stored as one interface, keeping the first', () => {
    expect(dedupeInterfaceReferences([qog, fsm, service])).toEqual([qog, service]);
  });

  it('keeps order and the extra fields of whichever copy came first', () => {
    const withId = { ...fsm, interface_id: 42 };
    expect(dedupeInterfaceReferences([withId, qog])).toEqual([withId]);
    expect(dedupeInterfaceReferences([])).toEqual([]);
  });
});

describe('ticketSystemEventMeta', () => {
  it('marks every delegated-access event', () => {
    Object.entries(TICKET_SYSTEM_EVENT_META).forEach(([event, meta]) => {
      expect(ticketSystemEventMeta(event)).toBe(meta);
      expect(meta.label).toBeTruthy();
    });
  });

  it('falls back to the plain informational line for no event or an unknown one', () => {
    expect(ticketSystemEventMeta(undefined)).toBe(DEFAULT_TICKET_SYSTEM_EVENT_META);
    expect(ticketSystemEventMeta('billing.invoice_paid')).toBe(DEFAULT_TICKET_SYSTEM_EVENT_META);
  });
});
