import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';

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
export type TTicketAuditAction = 'replied' | 'noted' | 'status_changed' | 'assigned' | 'updated';

/** A message author. Staff identities are masked from the customer by the backend. */
export type TTicketMessageAuthor = 'customer' | 'staff' | 'system';

/** Which side "you" sit on — decides self-alignment and audience-specific labels. */
export type TTicketViewerRole = 'customer' | 'staff';

export interface ITicketEnumMeta {
  label: string;
  intent: TReqoreIntent;
  icon: IReqoreIconName;
  /** Audience-specific label for the customer view; falls back to `label` (the
   *  staff / neutral wording). Only a few values differ by audience. */
  customerLabel?: string;
}

export const TICKET_STATUS_META: Record<TTicketStatus, ITicketEnumMeta> = {
  new: { label: 'New', intent: 'info', icon: 'SparklingLine' },
  open: { label: 'Open', intent: 'pending', icon: 'Chat3Line' },
  awaiting_customer: {
    label: 'Awaiting customer',
    customerLabel: 'Awaiting your reply',
    intent: 'warning',
    icon: 'UserReceivedLine',
  },
  resolved: { label: 'Resolved', intent: 'success', icon: 'CheckLine' },
  closed: { label: 'Closed', intent: 'muted', icon: 'CloseCircleLine' },
};

export const TICKET_PRIORITY_META: Record<TTicketPriority, ITicketEnumMeta> = {
  low: { label: 'Low', intent: 'muted', icon: 'ArrowDownLine' },
  normal: { label: 'Normal', intent: 'info', icon: 'SubtractLine' },
  high: { label: 'High', intent: 'warning', icon: 'ArrowUpLine' },
  urgent: { label: 'Urgent', intent: 'danger', icon: 'AlarmWarningLine' },
};

export const TICKET_CATEGORY_META: Record<TTicketCategory, ITicketEnumMeta> = {
  bug: { label: 'Bug', intent: 'danger', icon: 'BugLine' },
  question: { label: 'Question', intent: 'info', icon: 'QuestionLine' },
  billing: { label: 'Billing', intent: 'warning', icon: 'BankCardLine' },
  feature: { label: 'Feature request', intent: 'success', icon: 'LightbulbLine' },
  other: { label: 'Other', intent: 'muted', icon: 'MoreLine' },
};

/** Staff-only audit trail vocabulary (used by the admin-portal staff surface).
 *  These are exactly the actions the backend writes (qorus-api
 *  `QorusSaasTicketStore::insertAudit`): a public reply, an internal note, a
 *  status change, an assignment, or `updated` (a priority/category change). */
export const TICKET_AUDIT_ACTION_META: Record<TTicketAuditAction, ITicketEnumMeta> = {
  replied: { label: 'Replied', intent: 'success', icon: 'ReplyLine' },
  noted: { label: 'Internal note', intent: 'info', icon: 'StickyNoteLine' },
  status_changed: { label: 'Status changed', intent: 'warning', icon: 'ExchangeLine' },
  assigned: { label: 'Assigned', intent: 'pending', icon: 'UserFollowLine' },
  updated: { label: 'Updated', intent: 'muted', icon: 'Edit2Line' },
};

/** The status label for a given viewer — the customer sees "Awaiting your reply"
 *  where staff see "Awaiting customer"; all other values are audience-neutral. */
export const ticketStatusLabel = (
  status: TTicketStatus,
  viewerRole?: TTicketViewerRole
): string => {
  const meta = TICKET_STATUS_META[status];
  return viewerRole === 'customer' && meta.customerLabel ? meta.customerLabel : meta.label;
};

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
  /** interface type: workflow / service / job / fsm / qog / connection / ... */
  interface_kind: string;
  /** interface name (may include a version) */
  interface_name: string;
  /** server-assigned reference UUID (present on read, absent when submitting) */
  reference_id?: string;
  /** For an app-triggered interface (a qog): the triggering app's name. A viewer
   *  with the app catalogue (the customer's IDE) resolves it to the app's logo the
   *  same way the qogs list does — see `resolveInterfaceImage` on the tags. */
  trigger_app?: string;
  /** A pre-resolved logo/image (data-URI or URL) for the chip, e.g. the trigger
   *  app's logo. Travels with the reference so a viewer without the app catalogue
   *  (staff triage, the Qonsole card) still shows it. */
  logo?: string;
}

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
