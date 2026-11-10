import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { reqraftLabels } from '../../helpers/reqraftLabels';
import type { ISupportTicketLabels } from './labels';
import { ITicketEnumMeta, humaniseWireValue } from './meta';
import type { TTicketAttention, TTicketViewerRole } from '../supportTicket/meta';

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

/** The support-ticket words now (`setReqraftLabels`): every word here is read when it is asked for. */
const ticketWords = (): ISupportTicketLabels => reqraftLabels().supportTicket;

/**
 * A mark whose label (and sentence) is read from the host's words each time it is read, so a vocabulary kept in a
 * module-level map still says the words given now.
 */
const worded = (
  word: (words: ISupportTicketLabels) => string,
  intent: TReqoreIntent,
  icon: IReqoreIconName,
  description?: (words: ISupportTicketLabels) => string
): ISupportAccessMeta => {
  const meta: ISupportAccessMeta = {
    get label() {
      return word(ticketWords());
    },
    intent,
    icon,
  };
  if (description) {
    Object.defineProperty(meta, 'description', {
      get: () => description(ticketWords()),
      enumerable: true,
    });
  }
  return meta;
};

/** A map of words read when an entry is read; an entry it does not have is undefined, as in a plain map. */
const wordedMap = <K extends string>(
  keys: readonly K[],
  word: (words: ISupportTicketLabels, key: K) => string
): Record<K, string> => {
  const map = {} as Record<K, string>;
  keys.forEach((key) =>
    Object.defineProperty(map, key, { get: () => word(ticketWords(), key), enumerable: true })
  );
  return map;
};

/** `idle_paused` → "Idle paused": a wire value as words. */

const UNKNOWN: ISupportAccessMeta = worded((words) => words.unknownValue, 'muted', 'QuestionLine');

const lookup =
  <K extends string>(table: Record<K, ISupportAccessMeta>) =>
  (value: string | undefined): ISupportAccessMeta =>
    value === undefined
      ? UNKNOWN
      : ((table as Record<string, ISupportAccessMeta>)[value] ?? { ...UNKNOWN, label: humaniseWireValue(value) });

export const SUPPORT_ACCESS_POLICY_META: Record<TSupportAccessPolicy, ISupportAccessMeta> = {
  auto: worded(
    (words) => words.accessPolicies.auto,
    'success',
    'ShieldCheckLine',
    (words) => words.accessPolicyDescriptions.auto(words.supportName)
  ),
  ask: worded(
    (words) => words.accessPolicies.ask,
    'info',
    'QuestionAnswerLine',
    (words) => words.accessPolicyDescriptions.ask(words.supportName)
  ),
  never: worded(
    (words) => words.accessPolicies.never,
    'danger',
    'ShieldCrossLine',
    (words) => words.accessPolicyDescriptions.never(words.supportName)
  ),
};
/** The setting's mark; an unknown value still reads as words. */
export const supportAccessPolicyMeta = lookup(SUPPORT_ACCESS_POLICY_META);

export const SUPPORT_ACCESS_POLICY_SOURCE_LABEL: Record<TSupportAccessPolicySource, string> = wordedMap(
  ['default', 'signup', 'prompt', 'settings', 'admin', 'owner'],
  (words, source) => words.accessPolicySources[source]
);
export const supportAccessPolicySourceLabel = (source: string | undefined): string =>
  (source && (SUPPORT_ACCESS_POLICY_SOURCE_LABEL as Record<string, string>)[source]) ||
  humaniseWireValue(source ?? '');

export const SUPPORT_GRANT_STATE_META: Record<TSupportGrantState, ISupportAccessMeta> = {
  active: worded((words) => words.grantStates.active, 'success', 'ShieldCheckLine'),
  revoked: worded((words) => words.grantStates.revoked, 'danger', 'ShieldCrossLine'),
  expired: worded((words) => words.grantStates.expired, 'muted', 'HourglassLine'),
};
export const supportGrantStateMeta = lookup(SUPPORT_GRANT_STATE_META);

/** How a grant ended, as what follows "Access": "ended by the customer", "ran out". */
export const SUPPORT_GRANT_END_CAUSE_LABEL: Record<TSupportGrantEndCause, string> = wordedMap(
  [
    'customer_revoked',
    'staff_revoked',
    'superseded',
    'ticket_resolved',
    'ticket_closed',
    'policy_changed',
    'account_erased',
    'workspace_deleted',
    'expired',
  ],
  (words, cause) => words.grantEndCauses[cause]
);
/**
 * The cause as the viewer reads it: the customer who ended it reads "ended by you", and
 * reads staff as "Qorus Support", as everywhere on the customer surface.
 */
export const supportGrantEndCauseLabel = (cause?: string, viewerRole?: TTicketViewerRole): string | undefined => {
  if (!cause) return undefined;
  const words = ticketWords();
  if (viewerRole === 'customer' && cause === 'customer_revoked') return words.endedByYou;
  if (viewerRole === 'customer' && cause === 'staff_revoked') return words.endedBySupport(words.supportName);
  return (SUPPORT_GRANT_END_CAUSE_LABEL as Record<string, string>)[cause] ?? humaniseWireValue(cause);
};

export const SUPPORT_ACCESS_DURATION_LABEL: Record<TSupportAccessDuration, string> = wordedMap(
  ['24h', '72h', '7d', 'until_resolved'],
  (words, duration) => words.accessDurations[duration]
);
export const supportAccessDurationLabel = (duration: string | undefined): string =>
  (duration && (SUPPORT_ACCESS_DURATION_LABEL as Record<string, string>)[duration]) ||
  humaniseWireValue(duration ?? '');

/** The grant's own trail, as a customer's access log or a staff access view lists it. */
export const SUPPORT_ACCESS_AUDIT_ACTION_META: Record<TSupportAccessAuditAction, ISupportAccessMeta> = {
  policy_set: worded((words) => words.accessAuditActions.policy_set, 'info', 'Settings3Line'),
  access_requested: worded((words) => words.accessAuditActions.access_requested, 'pending', 'ShieldUserLine'),
  granted: worded((words) => words.accessAuditActions.granted, 'success', 'ShieldCheckLine'),
  extended: worded((words) => words.accessAuditActions.extended, 'info', 'TimerLine'),
  revoked: worded((words) => words.accessAuditActions.revoked, 'danger', 'ShieldCrossLine'),
  expired: worded((words) => words.accessAuditActions.expired, 'muted', 'HourglassLine'),
  used: worded((words) => words.accessAuditActions.used, 'info', 'EyeLine'),
  use_refused: worded((words) => words.accessAuditActions.use_refused, 'warning', 'ForbidLine'),
  session_started: worded((words) => words.accessAuditActions.session_started, 'info', 'ExternalLinkLine'),
  session_ended: worded((words) => words.accessAuditActions.session_ended, 'muted', 'LogoutBoxLine'),
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
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

/**
 * The callers' clock (`useNow`) ticks once a minute while the plane stamps an event the
 * moment it happens, so a fresh event sits up to a minute ahead of that clock. The gap is
 * the present, not the future: "asked in 8 seconds" is the artifact this closes.
 */
const CLOCK_TICK_SECONDS = 60;

/**
 * "in 3 hours" / "2 days ago" against a clock the caller passes, so a story freezes it
 * and two surfaces reading the same grant agree. An unparsable instant is an empty
 * string, never "NaN years ago"; an instant inside the clock's tick is "just now".
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
  if (seconds >= 0 && seconds < CLOCK_TICK_SECONDS) {
    return locale === 'en'
      ? ticketWords().justNow
      : new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second');
  }
  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= secondsInUnit || unit === 'second') {
      // "tomorrow" and "yesterday" read well; "next month" does not say when a grant ends, and a week
      // is not a unit here so seven days read "in 7 days", not "next week"
      const numeric = secondsInUnit > 60 * 60 * 24 ? 'always' : 'auto';
      return new Intl.RelativeTimeFormat(locale, { numeric }).format(Math.round(seconds / secondsInUnit), unit);
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

/**
 * The calm look's reading of the same clock: a grant that runs is a fact nobody has to act
 * on, one ending within the hour needs the person looking, one whose time passed is over.
 */
export const grantTimeAttention = (expiresAt: string | undefined, now: number): TTicketAttention => {
  const left = millisUntil(expiresAt, now);
  if (Number.isNaN(left)) return 'quiet';
  if (left <= 0) return 'idle';
  return left < EXPIRING_SOON_MS ? 'warn' : 'quiet';
};

/**
 * The line of a delegated-access event in a thread, read from the viewer's side. The plane records
 * what happened (`system_event` + `system_detail`) with a third-person body as the fallback; the
 * end of a grant is re-read here so the customer who ended it reads "ended by you", staff read
 * "ended by the customer", and an expiry reads "ran out" on both sides — the one vocabulary
 * (`supportGrantEndCauseLabel`) the rail and the access log already speak. Any other event, an end
 * the plane did not explain, or a cause this vocabulary does not know, keeps the plane's body: a
 * humanised wire value glued into the sentence would read as a phrase nobody wrote.
 */
export const supportAccessEventText = (
  message: { system_event?: string; system_detail?: Record<string, unknown>; body: string },
  viewerRole?: TTicketViewerRole
): string => {
  const cause = message.system_detail?.end_cause;
  const ended = message.system_event === 'support_access.revoked' || message.system_event === 'support_access.expired';
  if (!ended || typeof cause !== 'string' || !(cause in SUPPORT_GRANT_END_CAUSE_LABEL)) return message.body;
  const words = ticketWords();
  // the grantee, as every surface names the support team
  return words.accessEndedEvent(words.supportName, supportGrantEndCauseLabel(cause, viewerRole) ?? '');
};
