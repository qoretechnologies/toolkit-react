import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { reqraftLabels } from '../../helpers/reqraftLabels';
import type { ISupportTicketLabels } from './labels';

/*
 * The single source of truth for the Qorus support-ticket presentation
 * vocabulary — how each status / priority / category / audit-action value
 * renders (label + Reqore intent + icon), plus the interface-kind icon map and
 * the small enum helpers. Shared by every Qorus surface that shows a ticket
 * (the qorus-ide customer view, the admin-portal staff queue, the Qonsole
 * renderer) so the chips read identically everywhere and can't drift apart.
 */

export type TTicketStatus = 'new' | 'open' | 'awaiting_customer' | 'resolved' | 'closed';
export type TTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TTicketCategory = 'bug' | 'question' | 'billing' | 'feature' | 'other';
export type TTicketAuditAction =
  | 'replied'
  | 'noted'
  | 'status_changed'
  | 'assigned'
  | 'updated'
  // staff reads (qorus#693 Layer 0): a ticket, its thread or its attachment list was opened,
  // or a file was downloaded — coalesced server-side per staff member and window
  | 'viewed'
  | 'attachment_downloaded'
  // delegated workspace access (qorus#693 Layers 1–3): the customer's grant lifecycle, a
  // staff read of the workspace under it, and a read-only IDE session launched from it
  | 'workspace_viewed'
  | 'access_requested'
  | 'access_granted'
  | 'access_extended'
  | 'access_revoked'
  | 'access_expired'
  | 'session_launched';

/**
 * The `system_event` a system message in a ticket thread may carry (qorus#693): the
 * delegated-access lifecycle, written by the control plane as a thread message so the
 * customer and the staff member see the same record in the conversation. A thread
 * renders a known event with its own mark; an unknown one falls back to a plain line.
 */
export type TTicketSystemEvent =
  | 'support_access.requested'
  | 'support_access.granted'
  | 'support_access.extended'
  | 'support_access.first_used'
  | 'support_access.revoked'
  | 'support_access.expired';

/** A message author. Staff identities are masked from the customer by the backend. */
export type TTicketMessageAuthor = 'customer' | 'staff' | 'system';

/** Which side "you" sit on — decides self-alignment and audience-specific labels. */
export type TTicketViewerRole = 'customer' | 'staff';

export interface ITicketEnumMeta {
  label: string;
  /** The value's tint in the classic look (`TicketMetaTags appearance='classic'`). A calm surface does not read
   *  it: a category is not a verdict, and a status or a priority takes a color only when it needs the person
   *  looking at it (`ticketStatusAttention`, `ticketPriorityAttention`). */
  intent: TReqoreIntent;
  icon: IReqoreIconName;
  /** Audience-specific label for the customer view; falls back to `label` (the
   *  staff / neutral wording). Only a few values differ by audience. */
  customerLabel?: string;
}

/**
 * A mark whose label is read from the host's words (`setReqraftLabels`) each time it is read, so a vocabulary kept
 * in a module-level map still says the words given now.
 */
const worded = (
  word: (words: ISupportTicketLabels) => string,
  intent: TReqoreIntent,
  icon: IReqoreIconName
): ITicketEnumMeta => ({
  get label() {
    return word(reqraftLabels().supportTicket);
  },
  intent,
  icon,
});

export const TICKET_STATUS_META: Record<TTicketStatus, ITicketEnumMeta> = {
  new: worded((words) => words.statuses.new, 'info', 'SparklingLine'),
  open: worded((words) => words.statuses.open, 'pending', 'Chat3Line'),
  awaiting_customer: {
    get label() {
      return reqraftLabels().supportTicket.statuses.awaiting_customer;
    },
    get customerLabel() {
      return reqraftLabels().supportTicket.awaitingYourReply;
    },
    intent: 'warning',
    icon: 'UserReceivedLine',
  },
  resolved: worded((words) => words.statuses.resolved, 'success', 'CheckLine'),
  closed: worded((words) => words.statuses.closed, 'muted', 'CloseCircleLine'),
};

export const TICKET_PRIORITY_META: Record<TTicketPriority, ITicketEnumMeta> = {
  low: worded((words) => words.priorities.low, 'muted', 'ArrowDownLine'),
  normal: worded((words) => words.priorities.normal, 'info', 'SubtractLine'),
  high: worded((words) => words.priorities.high, 'warning', 'ArrowUpLine'),
  urgent: worded((words) => words.priorities.urgent, 'danger', 'AlarmWarningLine'),
};

export const TICKET_CATEGORY_META: Record<TTicketCategory, ITicketEnumMeta> = {
  bug: worded((words) => words.categories.bug, 'danger', 'BugLine'),
  question: worded((words) => words.categories.question, 'info', 'QuestionLine'),
  billing: worded((words) => words.categories.billing, 'warning', 'BankCardLine'),
  feature: worded((words) => words.categories.feature, 'success', 'LightbulbLine'),
  other: worded((words) => words.categories.other, 'muted', 'MoreLine'),
};

/** Staff-only audit trail vocabulary (used by the admin-portal staff surface).
 *  These are exactly the actions the backend writes (qorus-api
 *  `QorusSaasTicketStore::insertAudit`): a public reply, an internal note, a
 *  status change, an assignment, or `updated` (a priority/category change). */
export const TICKET_AUDIT_ACTION_META: Record<TTicketAuditAction, ITicketEnumMeta> = {
  replied: worded((words) => words.auditActions.replied, 'success', 'ReplyLine'),
  noted: worded((words) => words.auditActions.noted, 'info', 'StickyNoteLine'),
  status_changed: worded((words) => words.auditActions.status_changed, 'warning', 'ExchangeLine'),
  assigned: worded((words) => words.auditActions.assigned, 'pending', 'UserFollowLine'),
  updated: worded((words) => words.auditActions.updated, 'muted', 'Edit2Line'),
  viewed: worded((words) => words.auditActions.viewed, 'muted', 'EyeLine'),
  attachment_downloaded: worded((words) => words.auditActions.attachment_downloaded, 'muted', 'Download2Line'),
  workspace_viewed: worded((words) => words.auditActions.workspace_viewed, 'info', 'Search2Line'),
  access_requested: worded((words) => words.auditActions.access_requested, 'pending', 'ShieldUserLine'),
  access_granted: worded((words) => words.auditActions.access_granted, 'success', 'ShieldCheckLine'),
  access_extended: worded((words) => words.auditActions.access_extended, 'info', 'TimerLine'),
  access_revoked: worded((words) => words.auditActions.access_revoked, 'danger', 'ShieldCrossLine'),
  access_expired: worded((words) => words.auditActions.access_expired, 'muted', 'HourglassLine'),
  session_launched: worded((words) => words.auditActions.session_launched, 'info', 'ExternalLinkLine'),
};

/** The mark for an audit action the server writes but this vocabulary has not caught up
 *  with: a muted, generic row that still names the action. It exists because the staff
 *  audit tab used to index `TICKET_AUDIT_ACTION_META` directly, and one unknown action
 *  took the whole tab down (qorus#693). */
export const UNKNOWN_TICKET_AUDIT_ACTION_META: ITicketEnumMeta = worded(
  (words) => words.activity,
  'muted',
  'HistoryLine'
);

/** A wire value humanised for reading: `attachment_downloaded` → "Attachment downloaded". */
export const humaniseWireValue = (value: string): string => {
  const words = value.replace(/[._-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : value;
};

/**
 * The mark for an audit action, whatever the server sent. A known action gets its
 * entry; an unknown one gets the muted generic entry with the action's own wire value
 * humanised as the label, so a new server action renders as a readable row instead
 * of failing the surface that lists it.
 */
export const ticketAuditActionMeta = (action: string): ITicketEnumMeta =>
  (TICKET_AUDIT_ACTION_META as Record<string, ITicketEnumMeta>)[action] ?? {
    ...UNKNOWN_TICKET_AUDIT_ACTION_META,
    label: humaniseWireValue(action),
  };

/** How each delegated-access thread event renders: the mark on its system line or card. */
export const TICKET_SYSTEM_EVENT_META: Record<TTicketSystemEvent, ITicketEnumMeta> = {
  'support_access.requested': worded(
    (words) => words.systemEvents['support_access.requested'],
    'info',
    'ShieldUserLine'
  ),
  'support_access.granted': worded(
    (words) => words.systemEvents['support_access.granted'],
    'success',
    'ShieldCheckLine'
  ),
  'support_access.extended': worded((words) => words.systemEvents['support_access.extended'], 'info', 'TimerLine'),
  'support_access.first_used': worded((words) => words.systemEvents['support_access.first_used'], 'info', 'EyeLine'),
  'support_access.revoked': worded(
    (words) => words.systemEvents['support_access.revoked'],
    'danger',
    'ShieldCrossLine'
  ),
  'support_access.expired': worded(
    (words) => words.systemEvents['support_access.expired'],
    'muted',
    'HourglassLine'
  ),
};

/** The generic mark for a system message with no event, or an event this vocabulary
 *  does not know: the plain informational line every system message used to be. */
export const DEFAULT_TICKET_SYSTEM_EVENT_META: ITicketEnumMeta = worded(
  (words) => words.systemMessage,
  'muted',
  'InformationLine'
);

/** The mark for a system message's `system_event`, with the generic fallback. */
export const ticketSystemEventMeta = (event?: string): ITicketEnumMeta =>
  (event && (TICKET_SYSTEM_EVENT_META as Record<string, ITicketEnumMeta>)[event]) ||
  DEFAULT_TICKET_SYSTEM_EVENT_META;

/** The status label for a given viewer — the customer sees "Awaiting your reply"
 *  where staff see "Awaiting customer"; all other values are audience-neutral. */
export const ticketStatusLabel = (
  status: TTicketStatus,
  viewerRole?: TTicketViewerRole
): string => {
  const meta = TICKET_STATUS_META[status];
  return viewerRole === 'customer' && meta.customerLabel ? meta.customerLabel : meta.label;
};

/**
 * How much a ticket's state asks of the person looking at it, in the calm vocabulary every Qorus surface shares
 * (a status is a dot and a word, and only what needs a person is colored): `bad` and `warn` need someone (red,
 * amber), `good` is done (a little green), `live` is being worked, `idle` is closed, and `quiet` has nothing to
 * report.
 *
 * Decided here once, for the IDE's support pages, the Qonsole ticket card and the staff portal's queue, which
 * each kept their own copy, and for `TicketMetaTags`.
 */
export type TTicketAttention = 'bad' | 'warn' | 'good' | 'live' | 'quiet' | 'idle';

/**
 * A status's attention for whoever is looking. The customer is needed only when the ticket waits on their reply;
 * staff are needed by a new ticket, which waits for triage, and an open one is being worked. A closed ticket does
 * nothing any more. With no viewer (a neutral surface) only a closed ticket differs.
 */
export const ticketStatusAttention = (
  status: TTicketStatus,
  viewerRole?: TTicketViewerRole
): TTicketAttention => {
  if (status === 'closed') {
    return 'idle';
  }
  if (viewerRole === 'customer') {
    return status === 'awaiting_customer' ? 'warn' : 'quiet';
  }
  if (viewerRole === 'staff') {
    return (
      status === 'new' ? 'warn'
      : status === 'open' ? 'live'
      : status === 'resolved' ? 'good'
      : 'quiet'
    );
  }
  return 'quiet';
};

/** A priority only orders the queue, so it is a word: red for urgent, amber for high, quiet otherwise - never a
 *  dot that could read as the ticket's health. */
export const ticketPriorityAttention = (priority: TTicketPriority): TTicketAttention =>
  priority === 'urgent' ? 'bad'
  : priority === 'high' ? 'warn'
  : 'quiet';

/** A reply may be sent while a ticket is in any state except `closed`. */
export const REPLYABLE_STATUSES: TTicketStatus[] = [
  'new',
  'open',
  'awaiting_customer',
  'resolved',
];

/** Whether a ticket can still be replied to (closed ⇒ no). */
export const isTicketReplyable = (status: TTicketStatus): boolean => status !== 'closed';

/** A file to upload with a ticket or reply — raw bytes as base64, inline on the
 *  create/reply payload (the SaaS plane has no separate multipart upload). */
export interface IAttachmentUpload {
  filename: string;
  content_type: string;
  /** base64-encoded file content */
  content: string;
}

/** A reference to a Qorus interface on the subscriber's instance, stored as a
 *  `{kind, name}` snapshot (the interface itself lives on the instance, not the
 *  SaaS plane). Attaches to a ticket (at creation) or a message (in a reply). */
export interface IInterfaceReference {
  /**
   * The interface's kind. On READ this is the normalized Qorus `TypeMap` key the server
   * stores (`fsm`, never `qog`; `step`, never `workflow-step`), so two surfaces compare
   * equal; a writer may still send the spelling it has, and the server normalizes it.
   * Compare kinds through `normalizeInterfaceKind()` rather than by string.
   */
  interface_kind: string;
  /** interface name (may include a version) */
  interface_name: string;
  /** server-assigned reference UUID (present on read, absent when submitting) */
  reference_id?: string;
  /**
   * The interface's id on the subscriber's instance at the time it was referenced, when
   * the writer knew it (the IDE's picker does). A viewer that can reach the instance
   * prefers it over the name, which may have been renamed or versioned since.
   */
  interface_id?: number;
  /** The group the interface lived in when referenced — set by the server on read. */
  groupid?: number;
  /** That group's portable namespace — set by the server on read; absent for the host's
   *  DEFAULT group. What a support reader needs to find the interface after a move. */
  group_namespace?: number;
  /** For an app-triggered interface (a qog): the triggering app's name. A viewer
   *  with the app catalogue (the customer's IDE) resolves it to the app's logo the
   *  same way the qogs list does — see `resolveInterfaceImage` on the tags. */
  trigger_app?: string;
  /** A pre-resolved logo/image (data-URI or URL) for the chip, e.g. the trigger
   *  app's logo. Travels with the reference so a viewer without the app catalogue
   *  (staff triage, the Qonsole card) still shows it. */
  logo?: string;
}

// Kind spellings a writer may still send, and the normalized `TypeMap` key the server
// stores for each. The IDE's menus and older references say `qog`; the engine's type
// is `fsm`. A `workflow-step` is a `step`.
const INTERFACE_KIND_ALIASES: Record<string, string> = {
  qog: 'fsm',
  'workflow-step': 'step',
};

/**
 * The normalized `TypeMap` key for a kind, however a writer spelled it: `qog` → `fsm`,
 * `workflow-step` → `step`; anything else is returned trimmed and lower-cased. Every
 * comparison of two references' kinds goes through this, so a reference written as a
 * `qog` and one read back as an `fsm` are the same interface.
 */
export const normalizeInterfaceKind = (kind: string): string => {
  const key = kind.trim().toLowerCase();
  return INTERFACE_KIND_ALIASES[key] ?? key;
};

/**
 * A reference's identity for keys and dedupe: its normalized kind and its name. Not the
 * `reference_id` (absent when submitting) and not the `interface_id` (absent on older
 * references), so the same interface cited twice is one key whatever each copy carries.
 */
export const interfaceReferenceKey = (reference: IInterfaceReference): string =>
  `${normalizeInterfaceKind(reference.interface_kind)}:${reference.interface_name}`;

/** The references with duplicates dropped — first occurrence wins, order kept —
 *  where two references are the same interface by `interfaceReferenceKey()`. */
export const dedupeInterfaceReferences = <T extends IInterfaceReference>(references: T[]): T[] => {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = interfaceReferenceKey(reference);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

// Built-in per-kind icons for referenced interfaces, kept in step with the
// qorus-ide interface vocabulary. Used when a consumer doesn't pass its own
// `resolveInterfaceIcon`, so the staff view and the Qonsole renderer show the
// same chips as the customer view without each re-declaring the mapping.
const DEFAULT_INTERFACE_ICONS: Record<string, IReqoreIconName> = {
  workflow: 'GitBranchLine',
  service: 'ServerLine',
  job: 'CalendarLine',
  fsm: 'DashboardLine',
  // qog fallback glyph (used only when there's no trigger-app logo to show)
  qog: 'FlowChart',
  connection: 'Plug2Line',
  mapper: 'MindMap',
  class: 'CodeSLine',
  'value-map': 'BringToFront',
  'ai-collection': 'FileMarkedLine',
  'ai-endpoint': 'RobotLine',
  'ai-guardrail': 'ShieldLine',
};

/** Default per-kind icon for a referenced interface, with a generic fallback. */
export const defaultInterfaceIcon = (kind: string): IReqoreIconName =>
  DEFAULT_INTERFACE_ICONS[kind] ?? 'CodeBoxLine';

/**
 * An interface kind's mark: a font icon, and optionally an image (e.g. the green
 * Qog logo). The font icon is what shows while the image loads, and instead of it
 * when there is none or it cannot load. Same shape as qorus-ide's
 * `interfaceKindMark()`, so the IDE can return that directly.
 */
export interface IInterfaceKindMark {
  icon: IReqoreIconName;
  image?: string;
}

/** What a `resolveInterfaceIcon` may return: a font icon, or a mark with an image. */
export type TInterfaceKindIcon = IReqoreIconName | IInterfaceKindMark;

/** Resolve the icon for an interface kind (see `TInterfaceKindIcon`). */
export type TResolveInterfaceIcon = (kind: string) => TInterfaceKindIcon;

/** A resolver's answer as a mark, so callers handle one shape. */
export const toInterfaceKindMark = (icon: TInterfaceKindIcon): IInterfaceKindMark =>
  typeof icon === 'string' ? { icon } : icon;

// The reading name for each interface kind is a word of the host's (`supportTicket.interfaceKinds`). The kind id
// (`value-map`, `ai-collection`) is a wire value — it's what a host fetches with and what gets stored on the
// reference — so it must never be what the user reads. The names are plural because they name a category the user
// picks from, not a single interface. `fsm` reads "Qogs" like every other user-facing surface; the id stays `fsm`
// wherever a host still uses it.

/**
 * Default reading name for an interface kind — "Value maps" for `value-map`. An
 * unknown kind is humanised generically (separators to spaces, sentence case, a
 * plural `s`) so a kind this map hasn't caught up with still reads as a word
 * rather than an identifier. Consumers with their own vocabulary override the
 * whole thing via the picker's `resolveKindLabel`.
 */
export const defaultInterfaceKindLabel = (kind: string): string => {
  const words = reqraftLabels().supportTicket;
  const known = (words.interfaceKinds as Partial<Record<string, string>>)[kind];

  if (known) {
    return known;
  }

  return words.otherInterfaceKind(humaniseWireValue(kind));
};
