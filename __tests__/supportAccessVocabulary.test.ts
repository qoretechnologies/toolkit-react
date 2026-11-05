// Copyright 2026 Qore Technologies, s.r.o.
// The delegated-access vocabulary (qorus#692): the setting, a grant's state and end,
// the duration presets and the grant's audit trail read the same on every surface,
// and an unknown wire value never takes a surface down.
import { describe, expect, it } from 'vitest';
import {
  formatInstant,
  formatRelativeTime,
  grantTimeIntent,
  millisUntil,
  SUPPORT_ACCESS_AUDIT_ACTION_META,
  supportAccessAuditActionMeta,
  supportAccessDurationLabel,
  supportAccessEventText,
  supportAccessPolicyMeta,
  supportAccessPolicySourceLabel,
  supportGrantEndCauseLabel,
  supportGrantStateMeta,
} from '../src/components/supportTicket/accessMeta';

const NOW = Date.parse('2026-10-19T12:00:00Z');

describe('the setting', () => {
  it('has a mark and a sentence per value, and words for an unknown one', () => {
    expect(supportAccessPolicyMeta('never')).toMatchObject({ intent: 'danger', icon: 'ShieldCrossLine' });
    expect(supportAccessPolicyMeta('auto').description).toContain('automatically');
    expect(supportAccessPolicyMeta('sometimes')).toMatchObject({ intent: 'muted', label: 'Sometimes' });
    expect(supportAccessPolicyMeta(undefined).label).toBe('Unknown');
  });

  it('says where the setting came from', () => {
    expect(supportAccessPolicySourceLabel('owner')).toBe("the workspace owner's stricter setting");
    expect(supportAccessPolicySourceLabel('default')).toBe('the default, never chosen');
    expect(supportAccessPolicySourceLabel('migration_tool')).toBe('Migration tool');
  });
});

describe('a grant', () => {
  it('reads its state, why it ended, and the duration that was asked for', () => {
    expect(supportGrantStateMeta('active').intent).toBe('success');
    expect(supportGrantStateMeta('expired').icon).toBe('HourglassLine');
    expect(supportGrantEndCauseLabel('staff_revoked')).toBe('ended by support');
    expect(supportGrantEndCauseLabel(undefined)).toBeUndefined();
    expect(supportGrantEndCauseLabel('meteor')).toBe('Meteor');
    expect(supportAccessDurationLabel('72h')).toBe('3 days');
    expect(supportAccessDurationLabel('until_resolved')).toBe('until the ticket is resolved');
  });

  it('covers every audit action the plane writes, and renders one it does not know', () => {
    const written = ['policy_set', 'access_requested', 'granted', 'extended', 'revoked', 'expired', 'used', 'use_refused', 'session_started', 'session_ended'];
    written.forEach((action) => expect(SUPPORT_ACCESS_AUDIT_ACTION_META).toHaveProperty(action));
    expect(supportAccessAuditActionMeta('used').label).toBe('Workspace read');
    expect(supportAccessAuditActionMeta('escalated')).toMatchObject({ intent: 'muted', icon: 'HistoryLine', label: 'Escalated' });
  });
});

describe('time against a given clock', () => {
  it('speaks forwards and backwards, and never NaN', () => {
    expect(formatRelativeTime('2026-10-19T15:00:00Z', NOW)).toBe('in 3 hours');
    expect(formatRelativeTime('2026-10-17T12:00:00Z', NOW)).toBe('2 days ago');
    expect(formatRelativeTime('not a date', NOW)).toBe('');
    expect(formatRelativeTime(undefined, NOW)).toBe('');
  });

  it('gives the absolute instant for a tooltip, and the millis left', () => {
    expect(formatInstant('2026-10-19T15:00:00Z')).toMatch(/19 Oct 2026/);
    expect(formatInstant('nope')).toBe('nope');
    expect(millisUntil('2026-10-19T12:00:01Z', NOW)).toBe(1000);
    expect(Number.isNaN(millisUntil(undefined, NOW))).toBe(true);
  });

  it('turns amber under an hour and muted once the expiry passed', () => {
    expect(grantTimeIntent('2026-10-21T12:00:00Z', NOW)).toBe('success');
    expect(grantTimeIntent('2026-10-19T12:40:00Z', NOW)).toBe('warning');
    expect(grantTimeIntent('2026-10-19T11:00:00Z', NOW)).toBe('muted');
    expect(grantTimeIntent(undefined, NOW)).toBe('success');
  });
});

describe('the thread line of an ended grant', () => {
  const line = (system_event: string, end_cause?: string) => ({
    system_event,
    system_detail: end_cause ? { grant_id: 'g-1', end_cause } : undefined,
    body: "Qorus Support's read-only access to this workspace was ended by the customer.",
  });

  it('reads the end from the viewer\'s side', () => {
    expect(supportAccessEventText(line('support_access.revoked', 'customer_revoked'), 'customer')).toBe(
      "Qorus Support's read-only access to this workspace ended by you."
    );
    expect(supportAccessEventText(line('support_access.revoked', 'customer_revoked'), 'staff')).toBe(
      "Qorus Support's read-only access to this workspace ended by the customer."
    );
    expect(supportAccessEventText(line('support_access.revoked', 'staff_revoked'), 'customer')).toBe(
      "Qorus Support's read-only access to this workspace ended by Qorus Support."
    );
    expect(supportAccessEventText(line('support_access.revoked', 'staff_revoked'), 'staff')).toBe(
      "Qorus Support's read-only access to this workspace ended by support."
    );
  });

  it('says an expiry ran out, and names the other causes, on both sides', () => {
    expect(supportAccessEventText(line('support_access.expired', 'expired'), 'customer')).toBe("Qorus Support's read-only access to this workspace ran out.");
    expect(supportAccessEventText(line('support_access.expired', 'expired'), 'staff')).toBe("Qorus Support's read-only access to this workspace ran out.");
    expect(supportAccessEventText(line('support_access.revoked', 'ticket_resolved'), 'customer')).toBe(
      "Qorus Support's read-only access to this workspace ended when the ticket was resolved."
    );
  });

  it('keeps the plane\'s body when the end is unexplained, the cause is unknown, or the event is another', () => {
    expect(supportAccessEventText(line('support_access.revoked'), 'customer')).toBe(
      "Qorus Support's read-only access to this workspace was ended by the customer."
    );
    expect(supportAccessEventText(line('support_access.revoked', 'something_new'), 'staff')).toBe(
      "Qorus Support's read-only access to this workspace was ended by the customer."
    );
    expect(supportAccessEventText({ ...line('support_access.granted', 'customer_revoked'), body: 'Granted until Friday.' }, 'customer')).toBe('Granted until Friday.');
    expect(supportAccessEventText({ body: 'Ticket opened.' }, 'staff')).toBe('Ticket opened.');
  });
});
