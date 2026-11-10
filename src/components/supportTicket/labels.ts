// Copyright 2026 Qore Technologies, s.r.o.
import type {
  TSupportAccessAuditAction,
  TSupportAccessDuration,
  TSupportAccessPolicy,
  TSupportAccessPolicySource,
  TSupportGrantEndCause,
  TSupportGrantState,
} from './accessMeta';
import type {
  TTicketAuditAction,
  TTicketCategory,
  TTicketPriority,
  TTicketStatus,
  TTicketSystemEvent,
} from './meta';

/**
 * The words of a support ticket: its header, thread, reply box, references, attachments and workspace access. A host that translates its interface gives its own (`setReqraftLabels`); the rest stay English.
 */
export interface ISupportTicketLabels {
  /** What the support team is called wherever a person reads it; the sentences that name the team are given it. */
  supportName: string;

  /* ── the ticket's vocabulary (`meta.ts`) ── */
  statuses: Record<TTicketStatus, string>;
  /** `awaiting_customer` as the customer reads it. */
  awaitingYourReply: string;
  priorities: Record<TTicketPriority, string>;
  categories: Record<TTicketCategory, string>;
  /** The staff audit trail's actions. */
  auditActions: Record<TTicketAuditAction, string>;
  /** An audit action with no words of its own. */
  activity: string;
  /** The delegated-access events a thread shows. */
  systemEvents: Record<TTicketSystemEvent, string>;
  /** A system message with no event, or one with no words of its own. */
  systemMessage: string;
  /** The reading name of each interface kind, by its id (`value-map`): plural, as a category to pick from. */
  interfaceKinds: Record<string, string>;
  /** The reading name of a kind with none of its own; `name` is its id as words ("Message queue"). */
  otherInterfaceKind: (name: string) => string;

  /* ── delegated workspace access (`accessMeta.ts`) ── */
  /** A value with no words of its own and nothing to read it from. */
  unknownValue: string;
  accessPolicies: Record<TSupportAccessPolicy, string>;
  /** What each setting means, given the team's name. */
  accessPolicyDescriptions: Record<TSupportAccessPolicy, (supportName: string) => string>;
  /** Where the setting came from. */
  accessPolicySources: Record<TSupportAccessPolicySource, string>;
  grantStates: Record<TSupportGrantState, string>;
  /** How a grant ended, as what follows "Access": "ended by the customer", "ran out". */
  grantEndCauses: Record<TSupportGrantEndCause, string>;
  /** A grant the customer ended, as the customer reads it. */
  endedByYou: string;
  /** A grant support ended, as the customer reads it. */
  endedBySupport: (supportName: string) => string;
  accessDurations: Record<TSupportAccessDuration, string>;
  /** The grant's own audit trail. */
  accessAuditActions: Record<TSupportAccessAuditAction, string>;
  /** An instant within the last minute, in English (other languages are worded by the browser). */
  justNow: string;
  /** The thread line of an ended grant; `how` is a `grantEndCauses` phrase (or `endedByYou`, `endedBySupport`). */
  accessEndedEvent: (supportName: string, how: string) => string;

  /* ── the workspace-access line (`WorkspaceAccessStatus`) ── */
  /** A grant whose time passed; `when` is relative ("2 hours ago"). */
  accessEndedAgo: (when: string) => string;
  grantedAutomatically: string;
  grantedByYou: string;
  grantedByCustomer: string;
  grantedBySupport: string;
  /** After a running grant, when it ends ("in 3 hours"). */
  grantEnds: (when: string) => string;
  /** A running grant's tooltip: the instant it ends, and whether resolving the ticket ends it sooner. */
  grantUntil: (instant: string, orWhenResolved: boolean) => string;
  /** A grant that ended, and how (a `grantEndCauses` phrase). */
  accessEndedBecause: (how: string) => string;
  /** A grant that ended for no known cause, by its state (a `grantStates` word). */
  accessInState: (state: string) => string;
  /** An open request, as the customer reads it; `duration` is an `accessDurations` word, when one was suggested. */
  supportAsksForAccess: (supportName: string, duration?: string) => string;
  /** An open request, as support reads it. */
  accessRequested: (duration?: string) => string;
  awaitingTheCustomer: string;
  /** The setting is "never", as the customer reads it. */
  accessOffForCustomer: string;
  /** The setting is "never", as support reads it. */
  accessNotAllowed: string;
  /** No grant, no request, nothing refused. */
  noAccess: string;

  /* ── attachments ── */
  attachmentDownloadFailed: string;
  attachmentLoadFailed: string;
  /** A fetched attachment that is not a picture after all. */
  notAnImage: string;
  /** A picked file that could not be read for upload. */
  fileReadFailed: (filename: string) => string;
  rename: string;
  clickToPreview: string;

  /* ── interface references (`InterfaceReferenceTags`) ── */
  /** A reference's tooltip where it opens; `kind` is the kind's id. */
  openReference: (kind: string, name: string) => string;
  /** A reference's tooltip where it does not open. */
  referenceWritten: (kind: string, name: string) => string;
  /** The same, with why it does not open. */
  referenceUnlinkable: (kind: string, name: string, reason: string) => string;
  removeReference: (kind: string, name: string) => string;

  /* ── the reference picker (`ReferencePicker`) ── */
  /** The picker's heading when it opens as a window. */
  referenceInterfaces: string;
  searchKindsAndInterfaces: string;
  /** `kind` is the kind's reading name ("Value maps"). */
  noneOfKind: (kind: string) => string;
  /** Nothing of the kind matches, and other kinds do. */
  noneOfKindMatch: (kind: string, query: string) => string;
  nothingMatches: (query: string) => string;
  couldNotLoadKind: (kind: string) => string;
  loadingKind: (kind: string) => string;
  /** A picked interface's tooltip, where it can be taken back. */
  removePicked: (name: string) => string;
  alreadyReferenced: (name: string) => string;
  referenceItem: (name: string) => string;

  /* ── the reply box (`TicketReplyBox`) ── */
  /** In place of the reply box of a closed ticket. */
  ticketClosed: string;
  writeAReply: string;
  sendReply: string;
  addInternalNote: string;

  /* ── the thread (`TicketThread`) ── */
  internalNote: string;
  /** The author of a message the viewer wrote. */
  you: string;
  /** A message's author in the staff view. */
  staffAuthor: (name: string) => string;
  customerAuthor: (name: string) => string;
  loadingConversation: string;
  noMessagesYet: string;
  messageCount: (count: number) => string;
  /** A file's download tooltip; `contentType` is its type as sent (`application/pdf`). */
  downloadFile: (contentType: string) => string;
  clickToEnlarge: (filename: string) => string;

  /* ── the references panel (`TicketReferences`) ── */
  referenceFilters: Record<
    'all' | 'links' | 'screenshots' | 'documents' | 'data' | 'logs' | 'archives',
    string
  >;
  /** A filter in its menu, with how many it holds. */
  filterWithCount: (filter: string, count: number) => string;
  referenceSorts: Record<'newest' | 'oldest' | 'name' | 'size', string>;
  referenceSections: Record<'screenshots' | 'links' | 'files', string>;
  showInChat: string;
  /** Why "Show in chat" cannot be used for something filed on the ticket itself. */
  filedOnTheTicket: string;
  moreActions: string;
  loadingReferences: string;
  noReferencesYet: string;
  noReferencesYetDescription: string;
  searchReferences: string;
  noMatchingReferences: string;
  nothingHereMatches: (query: string) => string;
  nothingMatchesFilter: string;
  clearFilters: string;
  open: string;
  download: string;
  downloadAll: string;
  /** A file's provenance: who added it ("Qorus Support", an account). */
  addedBy: (uploader: string) => string;
  addedByYou: string;

  /* ── the image viewer (`ImageLightbox`) ── */
  previous: string;
  next: string;
  previewUnavailable: string;
  loading: string;
  /** Which image of the set is shown. */
  imagePosition: (position: number, total: number) => string;
}

/** The English words, the ones a host gets when it gives none. */
export const DEFAULT_SUPPORT_TICKET_LABELS: ISupportTicketLabels = {
  supportName: 'Qorus Support',

  statuses: {
    new: 'New',
    open: 'Open',
    awaiting_customer: 'Awaiting customer',
    resolved: 'Resolved',
    closed: 'Closed',
  },
  awaitingYourReply: 'Awaiting your reply',
  priorities: { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' },
  categories: {
    bug: 'Bug',
    question: 'Question',
    billing: 'Billing',
    feature: 'Feature request',
    other: 'Other',
  },
  auditActions: {
    replied: 'Replied',
    noted: 'Internal note',
    status_changed: 'Status changed',
    assigned: 'Assigned',
    updated: 'Updated',
    viewed: 'Viewed',
    attachment_downloaded: 'Attachment downloaded',
    workspace_viewed: 'Workspace viewed',
    access_requested: 'Access requested',
    access_granted: 'Access granted',
    access_extended: 'Access extended',
    access_revoked: 'Access revoked',
    access_expired: 'Access expired',
    session_launched: 'IDE session launched',
  },
  activity: 'Activity',
  systemEvents: {
    'support_access.requested': 'Workspace access requested',
    'support_access.granted': 'Workspace access granted',
    'support_access.extended': 'Workspace access extended',
    'support_access.first_used': 'Workspace opened by support',
    'support_access.revoked': 'Workspace access revoked',
    'support_access.expired': 'Workspace access expired',
  },
  systemMessage: 'System',
  interfaceKinds: {
    workflow: 'Workflows',
    service: 'Services',
    job: 'Jobs',
    fsm: 'Qogs',
    qog: 'Qogs',
    connection: 'Connections',
    mapper: 'Mappers',
    class: 'Classes',
    'value-map': 'Value maps',
    'ai-collection': 'AI collections',
    'ai-endpoint': 'AI endpoints',
    'ai-guardrail': 'AI guardrails',
  },
  otherInterfaceKind: (name) => (name.endsWith('s') ? name : `${name}s`),

  unknownValue: 'Unknown',
  accessPolicies: { auto: 'Granted automatically', ask: 'Ask the customer', never: 'Never' },
  accessPolicyDescriptions: {
    auto: (supportName) =>
      `Read-only access for ${supportName} is granted automatically on every ticket filed.`,
    ask: () => 'Support asks on each ticket; the customer decides whether to grant access.',
    never: (supportName) =>
      `No workspace access for ${supportName}. Support asks for information in the thread instead.`,
  },
  accessPolicySources: {
    default: 'the default, never chosen',
    signup: 'chosen at sign-up',
    prompt: 'chosen when first asked',
    settings: 'chosen in the account settings',
    admin: 'set by Qorus staff',
    owner: "the workspace owner's stricter setting",
  },
  grantStates: { active: 'Active', revoked: 'Revoked', expired: 'Expired' },
  grantEndCauses: {
    customer_revoked: 'ended by the customer',
    staff_revoked: 'ended by support',
    superseded: 'extended into a new grant',
    ticket_resolved: 'ended when the ticket was resolved',
    ticket_closed: 'ended when the ticket was closed',
    policy_changed: "ended when the account's setting changed",
    account_erased: 'ended when the account was erased',
    workspace_deleted: 'ended when the workspace was deleted',
    expired: 'ran out',
  },
  endedByYou: 'ended by you',
  endedBySupport: (supportName) => `ended by ${supportName}`,
  accessDurations: {
    '24h': '24 hours',
    '72h': '3 days',
    '7d': '7 days',
    until_resolved: 'until the ticket is resolved',
  },
  accessAuditActions: {
    policy_set: 'Setting changed',
    access_requested: 'Access requested',
    granted: 'Access granted',
    extended: 'Access extended',
    revoked: 'Access ended',
    expired: 'Access expired',
    used: 'Workspace read',
    use_refused: 'Read refused',
    session_started: 'IDE session started',
    session_ended: 'IDE session ended',
  },
  justNow: 'just now',
  accessEndedEvent: (supportName, how) =>
    `${supportName}'s read-only access to this workspace ${how}.`,

  accessEndedAgo: (when) => `Access ended ${when}`,
  grantedAutomatically: 'Granted automatically',
  grantedByYou: 'Granted by you',
  grantedByCustomer: 'Granted by the customer',
  grantedBySupport: 'Granted by support',
  grantEnds: (when) => `ends ${when}`,
  grantUntil: (instant, orWhenResolved) =>
    `Until ${instant}${orWhenResolved ? ', or when the ticket is resolved' : ''}`,
  accessEndedBecause: (how) => `Access ${how}`,
  accessInState: (state) => `Access ${state.toLowerCase()}`,
  supportAsksForAccess: (supportName, duration) =>
    `${supportName} asks for access${duration ? ` for ${duration}` : ''}`,
  accessRequested: (duration) => `Requested${duration ? ` for ${duration}` : ''}`,
  awaitingTheCustomer: 'awaiting the customer',
  accessOffForCustomer: 'Off: your setting is never',
  accessNotAllowed: "Not allowed: the account's setting is never",
  noAccess: 'None',

  attachmentDownloadFailed: 'Could not download the attachment',
  attachmentLoadFailed: 'Could not load the attachment',
  notAnImage: 'The attachment is not an image that can be shown',
  fileReadFailed: (filename) => `Could not read ${filename}`,
  rename: 'Rename',
  clickToPreview: 'Click to preview',

  openReference: (kind, name) => `Open ${kind} ${name}`,
  referenceWritten: (kind, name) => `${kind}: ${name}`,
  referenceUnlinkable: (kind, name, reason) => `${kind}: ${name} — ${reason}`,
  removeReference: (kind, name) => `Remove ${kind} ${name}`,

  referenceInterfaces: 'Reference interfaces',
  searchKindsAndInterfaces: 'Search types and interfaces…',
  noneOfKind: (kind) => `No ${kind.toLowerCase()} on this instance`,
  noneOfKindMatch: (kind, query) =>
    `No ${kind.toLowerCase()} match “${query}” — other types do`,
  nothingMatches: (query) => `Nothing matches “${query}”`,
  couldNotLoadKind: (kind) => `Couldn't load ${kind.toLowerCase()}`,
  loadingKind: (kind) => `Loading ${kind.toLowerCase()}…`,
  removePicked: (name) => `Remove “${name}”`,
  alreadyReferenced: (name) => `“${name}” is already referenced`,
  referenceItem: (name) => `Reference “${name}”`,

  ticketClosed: 'This ticket is closed. Open a new ticket to continue the conversation.',
  writeAReply: 'Write a reply…',
  sendReply: 'Send reply',
  addInternalNote: 'Add internal note',

  internalNote: 'Internal note',
  you: 'You',
  staffAuthor: (name) => `Support · ${name}`,
  customerAuthor: (name) => `Customer · ${name}`,
  loadingConversation: 'Loading conversation',
  noMessagesYet: 'No messages yet',
  messageCount: (count) => `${count} message${count === 1 ? '' : 's'}`,
  downloadFile: (contentType) => `${contentType} · download`,
  clickToEnlarge: (filename) => `${filename} — click to enlarge`,

  referenceFilters: {
    all: 'All types',
    links: 'Linked interfaces',
    screenshots: 'Screenshots',
    documents: 'Documents',
    data: 'Data',
    logs: 'Logs',
    archives: 'Archives',
  },
  filterWithCount: (filter, count) => `${filter} (${count})`,
  referenceSorts: {
    newest: 'Newest first',
    oldest: 'Oldest first',
    name: 'Name (A–Z)',
    size: 'Largest first',
  },
  referenceSections: { screenshots: 'Screenshots', links: 'Linked interfaces', files: 'Files' },
  showInChat: 'Show in chat',
  filedOnTheTicket: 'Filed on the ticket, not in a reply',
  moreActions: 'More actions',
  loadingReferences: 'Loading references…',
  noReferencesYet: 'No references or files yet',
  noReferencesYetDescription:
    'Interface references and any screenshots, documents, or files attached to this ticket will appear here.',
  searchReferences: 'Search files and references…',
  noMatchingReferences: 'No matching references or files',
  nothingHereMatches: (query) => `Nothing here matches “${query}”.`,
  nothingMatchesFilter: 'Nothing matches the current filter.',
  clearFilters: 'Clear filters',
  open: 'Open',
  download: 'Download',
  downloadAll: 'Download all',
  addedBy: (uploader) => `added by ${uploader}`,
  addedByYou: 'added by you',

  previous: 'Previous',
  next: 'Next',
  previewUnavailable: 'Preview unavailable — use Download.',
  loading: 'Loading…',
  imagePosition: (position, total) => `${position} / ${total}`,
};
