import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { ITicketEnumMeta, humaniseWireValue } from './meta';

/*
 * The delegated-support-access vocabulary (qorus#692): how the account's access
 * setting, a grant's state, the reasons a grant ended, the duration presets and the
 * grant's own audit trail read on every surface that shows them — the customer's IDE
 * (the sign-up step, the account tab, the ticket drawer) and the staff portal (the
 * workspace tab, the tenant card). The wire values are the SaaS plane's
 * (`QorusSaasSupportAccessStore`, `QorusSupportSessionStore`); the words are shared so
 * the two sides describe one grant the same way. The customer-facing LEGAL wording of
 * the setting is not here: the plane versions and serves it with the choice.
 */

/** The account's support access setting, least to most restrictive. */
export type TSupportAccessPolicy = 'auto' | 'ask' | 'never';

/** Where the governing setting came from. `default` when the customer never chose;
 *  `owner` when the workspace's billing owner's stricter setting governs the ticket. */
export type TSupportAccessPolicySource = 'default' | 'signup' | 'prompt' | 'settings' | 'admin' | 'owner';

export type TSupportGrantState = 'active' | 'revoked' | 'expired';

export type TSupportGrantEndCause =
  | 'customer_revoked'
  | 'staff_revoked'
  | 'superseded'
  | 'ticket_resolved'
  | 'ticket_closed'
  | 'policy_changed'
  | 'account_erased'
  | 'workspace_deleted'
  | 'expired';

/** A duration a staff request suggests; the customer's Grant answers exactly it. */
export type TSupportAccessDuration = '24h' | '72h' | '7d' | 'until_resolved';

/** The grant's own audit trail (`…/access` `audit`, the account's access log). */
export type TSupportAccessAuditAction =
  | 'policy_set'
  | 'access_requested'
  | 'granted'
  | 'extended'
  | 'revoked'
  | 'expired'
  | 'used'
  | 'use_refused'
  | 'session_started'
  | 'session_ended';

/** A mark with a sentence: the setting's meaning is what a customer decides on. */
export interface ISupportAccessMeta extends ITicketEnumMeta {
  description?: string;
}

/** `idle_paused` → "Idle paused": a wire value as words. */

const UNKNOWN: ISupportAccessMeta = { label: 'Unknown', intent: 'muted', icon: 'QuestionLine' };

const lookup =
  <K extends string>(table: Record<K, ISupportAccessMeta>) =>
  (value: string | undefined): ISupportAccessMeta =>
    value === undefined
      ? UNKNOWN
      : ((table as Record<string, ISupportAccessMeta>)[value] ?? { ...UNKNOWN, label: humaniseWireValue(value) });

export const SUPPORT_ACCESS_POLICY_META: Record<TSupportAccessPolicy, ISupportAccessMeta> = {
  auto: {
    label: 'Granted automatically',
    intent: 'success',
    icon: 'ShieldCheckLine',
    description: 'Read-only access for Qorus Support is granted automatically on every ticket filed.',
  },
  ask: {
    label: 'Ask the customer',
    intent: 'info',
    icon: 'QuestionAnswerLine',
    description: 'Support asks on each ticket; the customer decides whether to grant access.',
  },
  never: {
    label: 'Never',
    intent: 'danger',
    icon: 'ShieldCrossLine',
    description: 'No workspace access for Qorus Support. Support asks for information in the thread instead.',
  },
};
/** The setting's mark; an unknown value still reads as words. */
export const supportAccessPolicyMeta = lookup(SUPPORT_ACCESS_POLICY_META);

export const SUPPORT_ACCESS_POLICY_SOURCE_LABEL: Record<TSupportAccessPolicySource, string> = {
  default: 'the default, never chosen',
  signup: 'chosen at sign-up',
  prompt: 'chosen when first asked',
  settings: 'chosen in the account settings',
  admin: 'set by Qorus staff',
  owner: "the workspace owner's stricter setting",
};
export const supportAccessPolicySourceLabel = (source: string | undefined): string =>
  (source && (SUPPORT_ACCESS_POLICY_SOURCE_LABEL as Record<string, string>)[source]) ||
  humaniseWireValue(source ?? '');

export const SUPPORT_GRANT_STATE_META: Record<TSupportGrantState, ISupportAccessMeta> = {
  active: { label: 'Active', intent: 'success', icon: 'ShieldCheckLine' },
  revoked: { label: 'Revoked', intent: 'danger', icon: 'ShieldCrossLine' },
  expired: { label: 'Expired', intent: 'muted', icon: 'HourglassLine' },
};
export const supportGrantStateMeta = lookup(SUPPORT_GRANT_STATE_META);

export const SUPPORT_GRANT_END_CAUSE_LABEL: Record<TSupportGrantEndCause, string> = {
  customer_revoked: 'ended by the customer',
  staff_revoked: 'ended by support',
  superseded: 'extended into a new grant',
  ticket_resolved: 'the ticket was resolved',
  ticket_closed: 'the ticket was closed',
  policy_changed: "the account's setting changed",
  account_erased: 'the account was erased',
  workspace_deleted: 'the workspace was deleted',
  expired: 'expired',
};
export const supportGrantEndCauseLabel = (cause: string | undefined): string | undefined =>
  cause ? ((SUPPORT_GRANT_END_CAUSE_LABEL as Record<string, string>)[cause] ?? humaniseWireValue(cause)) : undefined;

export const SUPPORT_ACCESS_DURATION_LABEL: Record<TSupportAccessDuration, string> = {
  '24h': '24 hours',
  '72h': '3 days',
  '7d': '7 days',
  until_resolved: 'until the ticket is resolved',
};
export const supportAccessDurationLabel = (duration: string | undefined): string =>
  (duration && (SUPPORT_ACCESS_DURATION_LABEL as Record<string, string>)[duration]) ||
  humaniseWireValue(duration ?? '');

/** The grant's own trail, as a customer's access log or a staff access view lists it. */
export const SUPPORT_ACCESS_AUDIT_ACTION_META: Record<TSupportAccessAuditAction, ISupportAccessMeta> = {
  policy_set: { label: 'Setting changed', intent: 'info', icon: 'Settings3Line' },
  access_requested: { label: 'Access requested', intent: 'pending', icon: 'ShieldUserLine' },
  granted: { label: 'Access granted', intent: 'success', icon: 'ShieldCheckLine' },
  extended: { label: 'Access extended', intent: 'info', icon: 'TimerLine' },
  revoked: { label: 'Access revoked', intent: 'danger', icon: 'ShieldCrossLine' },
  expired: { label: 'Access expired', intent: 'muted', icon: 'HourglassLine' },
  used: { label: 'Workspace read', intent: 'info', icon: 'EyeLine' },
  use_refused: { label: 'Read refused', intent: 'warning', icon: 'ForbidLine' },
  session_started: { label: 'IDE session started', intent: 'info', icon: 'ExternalLinkLine' },
  session_ended: { label: 'IDE session ended', intent: 'muted', icon: 'LogoutBoxLine' },
};
/** An action the plane writes that this vocabulary has not caught up with still renders. */
export const supportAccessAuditActionMeta = (action: string): ISupportAccessMeta =>
  (SUPPORT_ACCESS_AUDIT_ACTION_META as Record<string, ISupportAccessMeta>)[action] ?? {
    ...UNKNOWN,
    icon: 'HistoryLine' as IReqoreIconName,
    label: humaniseWireValue(action),
  };

/* ── time, against a clock the caller owns ───────────────────────────────────── */

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

/**
 * "in 3 hours" / "2 days ago" against a clock the caller passes, so a story freezes it
 * and two surfaces reading the same grant agree. An unparsable instant is an empty
 * string, never "NaN years ago".
 *
 * Not `epoch-timeago` (what `ReqoreTimeAgo` and `TicketReferences` use): it speaks only
 * of the past and reads the real clock, so it can neither say "in 3 hours" for a grant
 * that is still running nor hold still in a story.
 */
export const formatRelativeTime = (iso: string | undefined, now: number, locale = 'en'): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((then - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= secondsInUnit || unit === 'second') {
      return rtf.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return '';
};

/** The absolute instant, for a tooltip beside a relative one. */
export const formatInstant = (iso: string | undefined, locale = 'en-GB'): string => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
};

/** Milliseconds until an instant; negative once it passed; NaN for nothing. */
export const millisUntil = (iso: string | undefined, now: number): number =>
  iso ? new Date(iso).getTime() - now : Number.NaN;

/** The intent a grant's remaining time reads as: the state's, amber under an hour, muted once passed. */
export const EXPIRING_SOON_MS = 60 * 60 * 1000;
export const grantTimeIntent = (expiresAt: string | undefined, now: number): TReqoreIntent => {
  const left = millisUntil(expiresAt, now);
  if (Number.isNaN(left)) return 'success';
  if (left <= 0) return 'muted';
  return left < EXPIRING_SOON_MS ? 'warning' : 'success';
};
