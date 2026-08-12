import {
  ReqoreControlGroup,
  ReqoreDescriptionList,
  ReqoreSpan,
} from '@qoretechnologies/reqore';
import { TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import { TReqoreEffectColor } from '@qoretechnologies/reqore/dist/components/Effect';
import { SIZE_TO_PX } from '@qoretechnologies/reqore/dist/constants/sizes';
import { ReactNode } from 'react';
import styled from 'styled-components';

/*
 * The header every ticket surface puts above its tabs: the subject, the ticket's
 * number, and a rail of labelled properties.
 *
 * Shared because it had already drifted. The staff drawer's header was redesigned
 * into this definition-list rail while the customer's kept a heading, a tag row and
 * a muted meta line — the same information, two layouts, and no way to change one
 * without hand-copying it into the other. What each surface shows differs (staff
 * edit the assignee; a customer reads who opened the ticket), so the rows are the
 * caller's; the frame, the rhythm and the alignment rules are not.
 */

/** How wide the label column is. Fits "References" — the longest label in use. */
const LABEL_WIDTH = '84px';
/** Everything in the rail runs at one scale. */
const RAIL_SIZE = 'small' as const;
/** Breathing room above and below each row's control — the rail's vertical rhythm. */
const ROW_PADDING = 4;

/**
 * The height a tab item needs to sit on the rail's rhythm.
 *
 * Exported because the tab strip below the header has to match it and there is no
 * Reqore prop for a tab's height: `size` sets it, and `padded` governs the items'
 * horizontal edges, not the strip's. The height must go on the ITEM, never on the
 * list — both of a tab's own surfaces are keyed to the item's box (the active marker
 * is an inset shadow on its bottom edge, the hover wash fills it), so padding the
 * list leaves the item floating in a taller strip: the marker lifts off the hairline
 * and reads as a doubled line, and the wash reads as a floating box.
 *
 * This belongs in Reqore as a tab-height option rather than as a CSS rule each
 * consumer re-applies. Until it exists, `TicketTabsFrame` is the single copy.
 */
export const TICKET_RAIL_ROW_HEIGHT = SIZE_TO_PX[RAIL_SIZE] + ROW_PADDING * 2;

/** The ticket number, set in mono so it reads as an identifier, not a heading. Exported
 *  so the staff drawer (which puts the number in the drawer's own title, not the rail)
 *  renders it identically rather than re-declaring the same span. */
export const TicketMonoId = styled.span`
  font-family: ui-monospace, 'SF Mono', 'Menlo', monospace;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.45);
`;

/**
 * A person: initials disc, then the name, on one baseline.
 *
 * One wrapper for every person in the rail — the assignee, the customer, the author.
 * They were visibly different before: one went through a nested control group inside
 * a button (its own gap and alignment) while another used a plain flex row, so the
 * two drifted apart every time either was touched. The only difference left is that
 * some of them are pressable.
 */
export const TicketPersonValue = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  /* the name yields before the disc does */
  > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/** Initials disc for a person. */
export const TicketAvatar = styled.span`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 650;
  color: #fff;
  background: linear-gradient(150deg, #8a4fe6, #2c1140);
  border: 1px solid rgba(255, 255, 255, 0.14);
`;

/**
 * Up to two initials from a handle ("nick.m@acme.io" → "NM"). Falls back to "?" so a
 * handle made entirely of separators still renders a disc rather than an empty circle.
 */
export const ticketInitials = (name: string): string =>
  name
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Wraps a ticket surface's tab strip so it joins the header rail's rhythm.
 *
 * See `TICKET_RAIL_ROW_HEIGHT` for why the height goes on the item and not the list.
 */
export const TicketTabsFrame = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;

  .reqore-tabs-list {
    padding-top: 0;
    padding-bottom: 0;
  }

  .reqore-tabs-list-item {
    min-height: ${TICKET_RAIL_ROW_HEIGHT}px;
  }
`;

/*
 * Centre each tab's icon + label + count.
 *
 * With `fill`, every tab is far wider than its content, and ReqoreButton defaults
 * `textAlign` to 'left' for non-square buttons — which also hands the leading icon a
 * `margin-right: auto`, pinning the group against the left edge of its tab. Setting
 * both alignments centres the group as a unit, so the strip reads as evenly spaced
 * segments rather than left-huddled labels.
 */
export const TICKET_TAB_ALIGN = {
  textAlign: 'center',
  iconsAlign: 'center',
} as const;

/**
 * A tab's count pill. The active tab's carries the accent; the rest stay neutral, so
 * the strip reads as one selected item rather than several competing chips. Returns
 * `undefined` for an empty count — a tab with nothing in it shows no badge at all.
 */
export const ticketTabBadge = (
  count: number,
  isActive: boolean,
  accent?: { color: TReqoreEffectColor; glow: TReqoreEffectColor }
): TReqoreBadge | undefined => {
  if (!count) {
    return undefined;
  }
  if (!isActive || !accent) {
    return count;
  }
  return { label: count, color: accent.glow, effect: { color: accent.color } };
};

export interface ITicketHeaderProperty {
  label: string;
  /** plain text, a chip row, or a control — the row aligns all three the same way */
  value: ReactNode;
  /** Drop the row. Lets a caller keep one list and vary it by viewer role, rather
   *  than building a different array per branch. Defaults to shown. */
  when?: boolean;
}

export interface ITicketHeaderProps {
  /** Omit when the surrounding dialog already carries the subject — the staff drawer
   *  puts it in the drawer's own label, the customer's modal puts it here. */
  subject?: string;
  /** the ticket's number, e.g. `#1001` */
  reference?: string;
  properties: ITicketHeaderProperty[];
  /** padding around the rail, matching the surface's own pane padding */
  padding?: number;
  className?: string;
}

export const TicketHeader = ({
  subject,
  reference,
  properties,
  padding = 14,
  className,
}: ITicketHeaderProps) => (
  <ReqoreDescriptionList
    /* The rail IS a description list — Reqore's, not a private copy. `contentSize`
       is what makes it tabular with controls in it: it reserves a control's height on
       every row and insets the values that aren't controls, so a dropdown row and a
       plain-text row share both a height and a left edge. */
    contentSize={RAIL_SIZE}
    size={RAIL_SIZE}
    /* Labels are reference furniture, quieter and smaller than the values they name —
       and "References" has to fit LABEL_WIDTH on one line at this scale. */
    labelTextSize='tiny'
    /* The rail's rhythm, which the tab strip below is measured against — see
       TICKET_RAIL_ROW_HEIGHT. Reqore's comfortable default would make the rows 52px
       and the strip would no longer line up with them. */
    rowPadding='tiny'
    labelWidth={LABEL_WIDTH}
    uppercaseLabels
    flat
    transparent
    padded={false}
    contentStyle={{ padding: `${padding - 4}px ${padding}px ${padding - 6}px` }}
    className={`${className || ''} ticket-header`}
    label={
      subject ? (
        /* The label is the panel's heading, which `padded={false}` leaves flush against
           the edge — `contentStyle` only pads the rows. Pad the subject here so it lines
           up with the values below it, using the same horizontal `padding` as the rows. */
        <div style={{ padding: `${padding}px ${padding}px ${padding - 8}px`, minWidth: 0 }}>
          <ReqoreControlGroup verticalAlign='center' gapSize='small'>
            <span>{subject}</span>
            {reference ? <TicketMonoId>{reference}</TicketMonoId> : null}
          </ReqoreControlGroup>
        </div>
      ) : undefined
    }
    items={properties
      .filter((property) => property.when !== false)
      .map((property) => ({
        key: property.label,
        label: property.label,
        content: property.value,
      }))}
  />
);

/** A rail value that is plain text rather than a control — sized to match the rest. */
export const TicketHeaderText = ({
  children,
  muted,
  tooltip,
}: {
  children: ReactNode;
  /** for an absent value ("Unassigned", "None") */
  muted?: boolean;
  tooltip?: string;
}) => (
  <ReqoreSpan size={RAIL_SIZE} tooltip={tooltip} effect={muted ? { opacity: 0.5 } : undefined}>
    {children}
  </ReqoreSpan>
);
