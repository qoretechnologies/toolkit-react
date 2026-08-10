import type { IInterfaceReference, TTicketCategory, TTicketMessageAuthor, TTicketPriority, TTicketStatus } from './meta';

/*
 * The support-ticket wire model, shared by every surface that speaks it.
 *
 * These shapes mirror the `SupportTicket` / `SupportMessage` schemas served by
 * the SaaS plane — `/qorus-saas/support/*` for the customer (qorus-api
 * `QorusSaasSupportRestClass`) and `/qorus-saas-admin/support/*` for staff
 * (`QorusSaasAdminRestHandler`). Both planes serve the SAME ticket row; the
 * staff plane simply projects more of it.
 *
 * They live here because they were previously declared twice — once in
 * qorus-ide's `views/support/types.ts` and once in admin-portal's
 * `types/supportTickets.ts` — and had already started to drift. The enum
 * vocabularies (`meta.ts`) were shared from the start; the record shapes that
 * carry them were not, which is the wrong way round: a field added to the wire
 * schema had to be remembered in two repos, and nothing failed if it wasn't.
 *
 * The split below is deliberate. `ITicket` is what BOTH planes return;
 * `IStaffTicket` is the extra projection only the admin plane serves.
 * That keeps "customer must never see the assignee" a property of the type
 * rather than a convention, while still giving one place to add a field.
 */

/** Attachment metadata as embedded in a message (no content). */
export interface ITicketAttachment {
  attachment_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

/**
 * Attachment metadata from the ticket-level list endpoint.
 *
 * Richer than the per-message copy: it carries the provenance the embedded
 * metadata omits — who uploaded the file, when, and which reply it came from
 * (null for a file attached when the ticket was filed). A staff uploader arrives
 * already masked by the server, so this never exposes a real staff identity.
 */
export interface ITicketAttachmentDetail extends ITicketAttachment {
  message_id?: string | null;
  uploaded_by?: string;
  uploader_type?: 'customer' | 'staff';
  created?: string;
}

/** One message in a ticket thread. */
export interface ITicketMessage {
  message_id: string;
  ticket_id: string;
  author_type: TTicketMessageAuthor;
  /** author identity; staff identities are masked from the customer */
  author_id: string;
  /** message body (markdown) */
  body: string;
  /** staff-only internal note — never present in the customer thread */
  internal: boolean;
  created: string;
  /** files attached to this message */
  attachments?: ITicketAttachment[];
  /** interfaces referenced in this message, as `{kind, name}` snapshots */
  referenced_interfaces?: IInterfaceReference[];
}

/**
 * One support ticket, in the projection BOTH planes serve.
 *
 * Staff-only fields are not optional-here-required-there; they live in
 * `IStaffTicket` so a customer surface cannot read them by accident.
 */
export interface ITicket {
  /** external ticket UUID, used in URLs */
  ticket_id: string;
  /** human-visible ticket number */
  ticket_number: number;
  subject: string;
  /** initial description (markdown) */
  description: string;
  status: TTicketStatus;
  priority: TTicketPriority;
  category: TTicketCategory;
  subscription_code: string;
  /** account name (email) of the filer */
  created_by: string;
  /** parent ticket UUID, when this continues a closed ticket */
  parent_ticket_id?: string;
  /** first staff-reply timestamp */
  first_response_at?: string;
  resolved_at?: string;
  closed_at?: string;
  /** most-recent-message timestamp */
  last_message_at: string;
  created: string;
  modified?: string;
  /** interfaces this ticket references (ticket-level), as `{kind, name}` snapshots */
  referenced_interfaces?: IInterfaceReference[];
}

/** The extra projection the admin plane adds on top of {@link ITicket}. */
export interface IStaffTicket extends ITicket {
  /** owner scope key (staff view) */
  scope_key: string;
  /** organization / account */
  scope_type: string;
  account_id: number;
  groupid?: number;
  /** the staff assignee */
  assignee?: string;
}

/** The offset pagination every support list endpoint returns. */
export interface ITicketPagedResult {
  limit: number;
  offset: number;
}

/**
 * A ticket-list response. Generic over the ticket projection so the staff plane
 * gets `IStaffTicket[]` without redeclaring the envelope; each plane extends this
 * with the scope fields it actually serves.
 */
export interface ITicketListResult<T extends ITicket = ITicket> extends ITicketPagedResult {
  tickets: T[];
}

/** A message-list response for one ticket. */
export interface ITicketMessageListResult extends ITicketPagedResult {
  ticket_id: string;
  messages: ITicketMessage[];
}
