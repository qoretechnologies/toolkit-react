import { ReqoreControlGroup, ReqoreTag } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import {
  TICKET_CATEGORY_META,
  TICKET_PRIORITY_META,
  TICKET_STATUS_META,
  ticketStatusLabel,
  TTicketCategory,
  TTicketPriority,
  TTicketStatus,
  TTicketViewerRole,
} from './meta';

export interface ITicketMetaTagsProps {
  /** The three enum values to badge — a full ticket satisfies this structurally. */
  ticket: {
    status: TTicketStatus;
    priority: TTicketPriority;
    category: TTicketCategory;
  };
  /** Picks audience-specific labels (e.g. "Awaiting your reply" vs "Awaiting
   *  customer"). Omit for the staff / neutral wording. */
  viewerRole?: TTicketViewerRole;
  size?: TSizes;
  /** Hide the category tag (e.g. in a dense list row). */
  hideCategory?: boolean;
  /** Reqore's subtle tag style — the intent colour as text on a faint wash,
   *  instead of a solid intent fill. Defaults to `true`; pass `false` for the
   *  old solid chips. */
  minimal?: boolean;
  /** Whether the tags are borderless (Reqore's `flat`). Defaults to `false` here,
   *  so tags carry a border — a shade lighter than the fill — which keeps the
   *  `minimal` tags legible. Pass `true` for no border. */
  flat?: boolean;
}

/**
 * The status / priority / category badge row for a ticket — the single place the
 * three enum vocabularies (`../supportTicket/meta`) turn into Reqore tags, so the
 * customer list, the staff queue, the detail header and the Qonsole card all read
 * identically. Each tag's label, intent and icon come from the shared meta maps.
 */
export const TicketMetaTags = ({
  ticket,
  viewerRole,
  size = 'small',
  hideCategory,
  minimal = true,
  flat = false,
}: ITicketMetaTagsProps) => {
  const status = TICKET_STATUS_META[ticket.status];
  const priority = TICKET_PRIORITY_META[ticket.priority];
  const category = TICKET_CATEGORY_META[ticket.category];

  return (
    <ReqoreControlGroup size={size} wrap>
      <ReqoreTag
        icon={status.icon}
        intent={status.intent}
        label={ticketStatusLabel(ticket.status, viewerRole)}
        size={size}
        minimal={minimal}
        flat={flat}
        effect={{ weight: 'bold' }}
      />
      <ReqoreTag
        icon={priority.icon}
        intent={priority.intent}
        label={priority.label}
        size={size}
        minimal={minimal}
        flat={flat}
      />
      {!hideCategory && (
        <ReqoreTag
          icon={category.icon}
          label={category.label}
          size={size}
          minimal={minimal}
          flat={flat}
        />
      )}
    </ReqoreControlGroup>
  );
};
