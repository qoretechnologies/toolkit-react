import { reqraftLabels } from '../../helpers/reqraftLabels';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { ITicketEnumMeta, humaniseWireValue } from './meta';
import type { TTicketViewerRole } from '../supportTicket/meta';

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
export type TSupportAccessPolicySource =
  'default' | 'signup' | 'prompt' | 'settings' | 'admin' | 'owner';

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

const UNKNOWN: ISupportAccessMeta = {
  get label() {
    return reqraftLabels().tickets.unknown;
  },
  intent: 'muted',
  icon: 'QuestionLine',
};

const lookup =
  <K extends string>(table: Record<K, ISupportAccessMeta>) =>
  (value: string | undefined): ISupportAccessMeta =>
    value === undefined ? UNKNOWN : (
      ((table as Record<string, ISupportAccessMeta>)[value] ?? {
        ...UNKNOWN,
        label: humaniseWireValue(value),
      })
    );

export const SUPPORT_ACCESS_POLICY_META: Record<TSupportAccessPolicy, ISupportAccessMeta> = {
  auto: {
    get label() {
      return reqraftLabels().tickets.grantedAutomatically;
    },
    intent: 'success',
    icon: 'ShieldCheckLine',
    get description() {
      return reqraftLabels().tickets.readOnlyAccessForQorusSupport;
    },
  },
  ask: {
    get label() {
      return reqraftLabels().tickets.askTheCustomer;
    },
    intent: 'info',
    icon: 'QuestionAnswerLine',
    get description() {
      return reqraftLabels().tickets.supportAsksOnEachTicketThe;
    },
  },
  never: {
    get label() {
      return reqraftLabels().tickets.never;
    },
    intent: 'danger',
    icon: 'ShieldCrossLine',
    get description() {
      return reqraftLabels().tickets.noWorkspaceAccessForQorusSupport;
    },
  },
};
/** The setting's mark; an unknown value still reads as words. */
export const supportAccessPolicyMeta = lookup(SUPPORT_ACCESS_POLICY_META);

export const SUPPORT_ACCESS_POLICY_SOURCE_LABEL: Record<TSupportAccessPolicySource, string> = {
  get default() {
    return reqraftLabels().tickets.theDefaultNeverChosen;
  },
  get signup() {
    return reqraftLabels().tickets.chosenAtSignUp;
  },
  get prompt() {
    return reqraftLabels().tickets.chosenWhenFirstAsked;
  },
  get settings() {
    return reqraftLabels().tickets.chosenInTheAccountSettings;
  },
  get admin() {
    return reqraftLabels().tickets.setByQorusStaff;
  },
  get owner() {
    return reqraftLabels().tickets.theWorkspaceOwnerSStricterSetting;
  },
};
export const supportAccessPolicySourceLabel = (source: string | undefined): string =>
  (source && (SUPPORT_ACCESS_POLICY_SOURCE_LABEL as Record<string, string>)[source]) ||
  humaniseWireValue(source ?? '');

export const SUPPORT_GRANT_STATE_META: Record<TSupportGrantState, ISupportAccessMeta> = {
  active: {
    get label() {
      return reqraftLabels().tickets.active;
    },
    intent: 'success',
    icon: 'ShieldCheckLine',
  },
  revoked: {
    get label() {
      return reqraftLabels().tickets.revoked;
    },
    intent: 'danger',
    icon: 'ShieldCrossLine',
  },
  expired: {
    get label() {
      return reqraftLabels().tickets.expired;
    },
    intent: 'muted',
    icon: 'HourglassLine',
  },
};
export const supportGrantStateMeta = lookup(SUPPORT_GRANT_STATE_META);

/** How a grant ended, as what follows "Access": "ended by the customer", "ran out". */
export const SUPPORT_GRANT_END_CAUSE_LABEL: Record<TSupportGrantEndCause, string> = {
  get customer_revoked() {
    return reqraftLabels().tickets.endedByTheCustomer;
  },
  get staff_revoked() {
    return reqraftLabels().tickets.endedBySupport;
  },
  get superseded() {
    return reqraftLabels().tickets.extendedIntoANewGrant;
  },
  get ticket_resolved() {
    return reqraftLabels().tickets.endedWhenTheTicketWasResolved;
  },
  get ticket_closed() {
    return reqraftLabels().tickets.endedWhenTheTicketWasClosed;
  },
  get policy_changed() {
    return reqraftLabels().tickets.endedWhenTheAccountSSetting;
  },
  get account_erased() {
    return reqraftLabels().tickets.endedWhenTheAccountWasErased;
  },
  get workspace_deleted() {
    return reqraftLabels().tickets.endedWhenTheWorkspaceWasDeleted;
  },
  get expired() {
    return reqraftLabels().tickets.ranOut;
  },
};
/**
 * The cause as the viewer reads it: the customer who ended it reads "ended by you", and
 * reads staff as "Qorus Support", as everywhere on the customer surface.
 */
export const supportGrantEndCauseLabel = (
  cause?: string,
  viewerRole?: TTicketViewerRole
): string | undefined => {
  if (!cause) return undefined;
  if (viewerRole === 'customer' && cause === 'customer_revoked')
    return reqraftLabels().tickets.endedByYou;
  if (viewerRole === 'customer' && cause === 'staff_revoked')
    return reqraftLabels().tickets.endedByQorusSupport;
  return (
    (SUPPORT_GRANT_END_CAUSE_LABEL as Record<string, string>)[cause] ?? humaniseWireValue(cause)
  );
};

export const SUPPORT_ACCESS_DURATION_LABEL: Record<TSupportAccessDuration, string> = {
  get '24h'() {
    return reqraftLabels().tickets.t24Hours;
  },
  get '72h'() {
    return reqraftLabels().tickets.t3Days;
  },
  get '7d'() {
    return reqraftLabels().tickets.t7Days;
  },
  get until_resolved() {
    return reqraftLabels().tickets.untilTheTicketIsResolved;
  },
};
export const supportAccessDurationLabel = (duration: string | undefined): string =>
  (duration && (SUPPORT_ACCESS_DURATION_LABEL as Record<string, string>)[duration]) ||
  humaniseWireValue(duration ?? '');

/** The grant's own trail, as a customer's access log or a staff access view lists it. */
export const SUPPORT_ACCESS_AUDIT_ACTION_META: Record<
  TSupportAccessAuditAction,
  ISupportAccessMeta
> = {
  policy_set: {
    get label() {
      return reqraftLabels().tickets.settingChanged;
    },
    intent: 'info',
    icon: 'Settings3Line',
  },
  access_requested: {
    get label() {
      return reqraftLabels().tickets.accessRequested;
    },
    intent: 'pending',
    icon: 'ShieldUserLine',
  },
  granted: {
    get label() {
      return reqraftLabels().tickets.accessGranted;
    },
    intent: 'success',
    icon: 'ShieldCheckLine',
  },
  extended: {
    get label() {
      return reqraftLabels().tickets.accessExtended;
    },
    intent: 'info',
    icon: 'TimerLine',
  },
  revoked: {
    get label() {
      return reqraftLabels().tickets.accessEnded;
    },
    intent: 'danger',
    icon: 'ShieldCrossLine',
  },
  expired: {
    get label() {
      return reqraftLabels().tickets.accessExpired;
    },
    intent: 'muted',
    icon: 'HourglassLine',
  },
  used: {
    get label() {
      return reqraftLabels().tickets.workspaceRead;
    },
    intent: 'info',
    icon: 'EyeLine',
  },
  use_refused: {
    get label() {
      return reqraftLabels().tickets.readRefused;
    },
    intent: 'warning',
    icon: 'ForbidLine',
  },
  session_started: {
    get label() {
      return reqraftLabels().tickets.ideSessionStarted;
    },
    intent: 'info',
    icon: 'ExternalLinkLine',
  },
  session_ended: {
    get label() {
      return reqraftLabels().tickets.ideSessionEnded;
    },
    intent: 'muted',
    icon: 'LogoutBoxLine',
  },
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
    return locale === 'en' ?
        reqraftLabels().tickets.justNow
      : new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second');
  }
  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= secondsInUnit || unit === 'second') {
      // "tomorrow" and "yesterday" read well; "next month" does not say when a grant ends, and a week
      // is not a unit here so seven days read "in 7 days", not "next week"
      const numeric = secondsInUnit > 60 * 60 * 24 ? 'always' : 'auto';
      return new Intl.RelativeTimeFormat(locale, { numeric }).format(
        Math.round(seconds / secondsInUnit),
        unit
      );
    }
  }
  return '';
};

/** The absolute instant, for a tooltip beside a relative one. */
export const formatInstant = (iso: string | undefined, locale = 'en-GB'): string => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : (
      date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    );
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

/** The grantee, as every surface names the support team. */
const grantee = () => reqraftLabels().tickets.qorusSupport;

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
  const ended =
    message.system_event === 'support_access.revoked' ||
    message.system_event === 'support_access.expired';
  if (!ended || typeof cause !== 'string' || !(cause in SUPPORT_GRANT_END_CAUSE_LABEL))
    return message.body;
  return reqraftLabels().tickets.xSReadOnlyAccessTo(
    grantee(),
    supportGrantEndCauseLabel(cause, viewerRole)
  );
};
