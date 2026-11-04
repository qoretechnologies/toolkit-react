import { ReqoreControlGroup, ReqoreIcon, ReqoreSpan, ReqoreTag } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { useReqoreTheme } from '@qoretechnologies/reqore/dist/hooks/useTheme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { Fragment, useMemo } from 'react';
import { getReadableFaded, getReadableShade, getThemeSurfaces } from '../../helpers/readableColors';
import {
  TICKET_CATEGORY_META,
  TICKET_PRIORITY_META,
  TICKET_STATUS_META,
  ticketPriorityAttention,
  ticketStatusAttention,
  ticketStatusLabel,
  TTicketAttention,
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
   *  customer"), and whose attention a status asks for (`ticketStatusAttention`).
   *  Omit for the staff / neutral wording. */
  viewerRole?: TTicketViewerRole;
  size?: TSizes;
  /** Hide the category (e.g. in a dense list row). */
  hideCategory?: boolean;
  /**
   * `calm` (the default): words on one line, each with its icon, colored only when
   * it needs the person looking (amber, red) - the status and priority vocabulary
   * every Qorus surface shares. `classic`: a tag per value in its own intent.
   */
  appearance?: 'calm' | 'classic';
  /** Classic look: Reqore's subtle tag style — the intent color as text on a faint
   *  wash, instead of a solid intent fill. Defaults to `true`; pass `false` for the
   *  old solid chips. */
  minimal?: boolean;
  /** Classic look: whether the tags are borderless (Reqore's `flat`). Defaults to
   *  `false` here, so tags carry a border — a shade lighter than the fill — which
   *  keeps the `minimal` tags legible. Pass `true` for no border. */
  flat?: boolean;
}

interface ITicketWord {
  key: string;
  icon: IReqoreIconName;
  label: string;
  attention: TTicketAttention;
  /** A fact rather than a state (the category): the softest shade, never colored. */
  fact?: boolean;
}

/** The words' colors: the intent's shade that reads for what needs a person, a soft
 *  shade of the text for everything else. */
const useTicketWordInks = () => {
  const theme = useReqoreTheme();

  return useMemo(() => {
    const surfaces = getThemeSurfaces(theme);
    const text = getReadableColor(theme);

    return {
      bad: getReadableShade(theme.intents?.danger || '#c11c1c', surfaces),
      warn: getReadableShade(theme.intents?.warning || '#d17c29', surfaces),
      quiet: getReadableFaded(text, surfaces, 0.7),
      fact: getReadableFaded(text, surfaces, 0.55),
    };
  }, [theme]);
};

/**
 * The status / priority / category row for a ticket — the single place the three
 * enum vocabularies (`../supportTicket/meta`) turn into what a person reads, so the
 * customer list, the staff queue, the detail header and the Qonsole card all say
 * a ticket the same way.
 */
export const TicketMetaTags = ({
  ticket,
  viewerRole,
  size = 'small',
  hideCategory,
  appearance = 'calm',
  minimal = true,
  flat = false,
}: ITicketMetaTagsProps) => {
  const inks = useTicketWordInks();
  const status = TICKET_STATUS_META[ticket.status];
  const priority = TICKET_PRIORITY_META[ticket.priority];
  const category = TICKET_CATEGORY_META[ticket.category];

  if (appearance === 'classic') {
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
  }

  const words: ITicketWord[] = [
    {
      key: 'status',
      icon: status.icon,
      label: ticketStatusLabel(ticket.status, viewerRole),
      attention: ticketStatusAttention(ticket.status, viewerRole),
    },
    {
      key: 'priority',
      icon: priority.icon,
      label: priority.label,
      attention: ticketPriorityAttention(ticket.priority),
    },
    ...(hideCategory ?
      []
    : [{ key: 'category', icon: category.icon, label: category.label, attention: 'quiet', fact: true } as const]),
  ];

  return (
    <ReqoreSpan
      size={size}
      className='ticket-meta-words'
      style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2 }}
    >
      {words.map((word, index) => {
        const needsSomeone = word.attention === 'bad' || word.attention === 'warn';
        const color =
          word.attention === 'bad' ? inks.bad
          : word.attention === 'warn' ? inks.warn
          : word.fact ? inks.fact
          : inks.quiet;

        return (
          <Fragment key={word.key}>
            {index ?
              <ReqoreSpan size={size} aria-hidden effect={{ color: inks.fact as never }}>
                ·
              </ReqoreSpan>
            : null}
            <ReqoreSpan
              size={size}
              className={`ticket-meta-word ticket-meta-${word.key}`}
              data-attention={word.attention}
              effect={{
                color: color as never,
                weight: needsSomeone ? 'bold' : undefined,
                noWrap: true,
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ReqoreIcon icon={word.icon} size='12px' color={color as never} />
              {word.label}
            </ReqoreSpan>
          </Fragment>
        );
      })}
    </ReqoreSpan>
  );
};
