import { ReqoreButton, ReqoreIcon, ReqoreSpan } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { reqraftLabels, useReqraftLabels } from '../../helpers/reqraftLabels';
import {
  formatInstant,
  formatRelativeTime,
  grantTimeAttention,
  grantTimeIntent,
  millisUntil,
  supportAccessDurationLabel,
  supportGrantEndCauseLabel,
  supportGrantStateMeta,
  TSupportAccessPolicy,
  TSupportGrantState,
} from './accessMeta';
import { TTicketAttention, TTicketViewerRole } from './meta';
import { TicketPersonValue } from './TicketHeader';
import { ticketAttentionInk, ticketAttentionNeedsSomeone, useTicketAttentionInks } from './ticketAttentionInks';

/*
 * Where a ticket's workspace access stands, as one rail value: granted and for how
 * long, requested and waiting, refused by the setting, or none — with the one thing
 * the viewer may do about it beside it (the customer's Revoke, support's End access).
 * The customer's IDE and the staff portal show the same grant from opposite sides,
 * so the sentence is built here once and `viewerRole` picks the pronoun.
 *
 * The clock is the caller's (`now`): the component never reads the wall clock, so a
 * story freezes it and every surface on a page agrees on "ends in 2 days".
 *
 * In the calm look (the default) the line takes a color only when it needs the person
 * looking, in the same amber as a ticket's words: a request the customer has to answer,
 * a grant ending within the hour. A setting of "never" is a choice, not a fault, and a
 * running grant is a fact, so both read in the soft shade. The classic look keeps the
 * vocabulary's own intent on the mark.
 */

/** What the value needs of a grant: the plane's `SupportAccessGrant`, a subset. */
export interface IWorkspaceAccessGrantSummary {
  state: TSupportGrantState | string;
  issued_at?: string;
  expires_at?: string;
  until_resolved?: boolean;
  created_by_type?: 'customer' | 'staff' | 'system' | string;
  ended_at?: string;
  end_cause?: string;
}

/** What the value needs of an open staff request. */
export interface IWorkspaceAccessRequestSummary {
  requested_at: string;
  suggested_duration?: string;
}

export interface IWorkspaceAccessStatusAction {
  label: string;
  icon?: IReqoreIconName;
  intent?: TReqoreIntent;
  onClick: () => void;
  loading?: boolean;
  tooltip?: string;
}

export interface IWorkspaceAccessStatusProps {
  /** the ticket's active grant, or the last one when none is active */
  grant?: IWorkspaceAccessGrantSummary;
  /** the open staff request, when there is one and no active grant */
  request?: IWorkspaceAccessRequestSummary;
  /** the account's setting; `never` is said when nothing else is there to say */
  policy?: TSupportAccessPolicy | string;
  /** who is reading: decides "by you" against "by the customer" */
  viewerRole: TTicketViewerRole;
  /** the clock, in ms; a story passes a fixed one */
  now: number;
  /** the one thing the viewer may do right now, rendered beside the sentence */
  action?: IWorkspaceAccessStatusAction;
  /** the rail's size by default */
  size?: TSizes;
  /**
   * `calm` (the default): colored only when it needs the person looking (`attention`).
   * `classic`: the mark in the state's own intent (green for a grant, red for never).
   */
  appearance?: 'calm' | 'classic';
  className?: string;
}

/** Who granted it, from the viewer's side: "Granted by you", "Granted automatically". */
const grantedLine = (grant: IWorkspaceAccessGrantSummary, viewerRole: TTicketViewerRole): string => {
  const words = reqraftLabels().supportTicket;
  if (grant.created_by_type === 'system') return words.grantedAutomatically;
  if (grant.created_by_type === 'customer' || !grant.created_by_type) {
    return viewerRole === 'customer' ? words.grantedByYou : words.grantedByCustomer;
  }
  return words.grantedBySupport;
};

/** The sentence, its mark and its colour for the state the props describe. */
export const describeWorkspaceAccess = (
  { grant, request, policy, viewerRole, now }: Pick<IWorkspaceAccessStatusProps, 'grant' | 'request' | 'policy' | 'viewerRole' | 'now'>
): {
  text: string;
  tooltip?: string;
  /** the classic look's color for the mark */
  intent: TReqoreIntent;
  /** the calm look's: whether the line needs the person reading it */
  attention: TTicketAttention;
  icon: IReqoreIconName;
  muted?: boolean;
} => {
  const words = reqraftLabels().supportTicket;
  if (grant && grant.state === 'active') {
    const left = millisUntil(grant.expires_at, now);
    if (!Number.isNaN(left) && left <= 0) {
      return {
        text: words.accessEndedAgo(formatRelativeTime(grant.expires_at, now)),
        tooltip: formatInstant(grant.expires_at),
        intent: 'muted',
        attention: 'idle',
        icon: 'HourglassLine',
      };
    }
    const ends = grant.expires_at ? ` · ${words.grantEnds(formatRelativeTime(grant.expires_at, now))}` : '';
    return {
      text: `${grantedLine(grant, viewerRole)}${ends}`,
      tooltip: grant.expires_at
        ? words.grantUntil(formatInstant(grant.expires_at), !!grant.until_resolved)
        : undefined,
      intent: grantTimeIntent(grant.expires_at, now),
      attention: grantTimeAttention(grant.expires_at, now),
      icon: 'ShieldCheckLine',
    };
  }
  if (grant) {
    const meta = supportGrantStateMeta(grant.state);
    const cause = supportGrantEndCauseLabel(grant.end_cause, viewerRole);
    const when = formatRelativeTime(grant.ended_at ?? grant.expires_at, now);
    const ended = cause ? words.accessEndedBecause(cause) : words.accessInState(meta.label);
    return {
      text: `${ended}${when ? ` · ${when}` : ''}`,
      tooltip: formatInstant(grant.ended_at ?? grant.expires_at) || undefined,
      intent: meta.intent,
      // revoked or run out: over, whoever ended it
      attention: 'idle',
      icon: meta.icon,
    };
  }
  if (request) {
    const since = formatRelativeTime(request.requested_at, now);
    const duration = request.suggested_duration ? supportAccessDurationLabel(request.suggested_duration) : undefined;
    return {
      text:
        viewerRole === 'customer'
          ? `${words.supportAsksForAccess(words.supportName, duration)} · ${since}`
          : `${words.accessRequested(duration)} · ${words.awaitingTheCustomer} · ${since}`,
      tooltip: formatInstant(request.requested_at),
      intent: 'pending',
      // the customer has to answer it; support only waits
      attention: viewerRole === 'customer' ? 'warn' : 'quiet',
      icon: 'TimeLine',
    };
  }
  if (policy === 'never') {
    return {
      text: viewerRole === 'customer' ? words.accessOffForCustomer : words.accessNotAllowed,
      intent: 'danger',
      attention: 'quiet',
      icon: 'ShieldCrossLine',
    };
  }
  return { text: words.noAccess, intent: 'muted', attention: 'idle', icon: 'ShieldLine', muted: true };
};

export const WorkspaceAccessStatus = ({
  grant,
  request,
  policy,
  viewerRole,
  now,
  action,
  size = 'small',
  appearance = 'calm',
  className,
}: IWorkspaceAccessStatusProps) => {
  // drawn again when a host gives other words; `describeWorkspaceAccess` reads them
  useReqraftLabels();
  const inks = useTicketAttentionInks();
  const { text, tooltip, intent, attention, icon, muted } = describeWorkspaceAccess({
    grant,
    request,
    policy,
    viewerRole,
    now,
  });
  const calm = appearance !== 'classic';
  const needsSomeone = calm && ticketAttentionNeedsSomeone(attention);
  // the mark beside the sentence is a fact unless the line needs the reader
  const ink = ticketAttentionInk(inks, attention, true);

  return (
    <TicketPersonValue
      className={`reqore-workspace-access-status${className ? ` ${className}` : ''}`}
      data-attention={calm ? attention : undefined}
    >
      {/* a small mark, the way the rail's other state values read: no saturated chip
          in a row of reference material */}
      <ReqoreIcon icon={icon} size='tiny' color={(calm ? ink : intent) as never} />
      <ReqoreSpan
        size={size}
        tooltip={tooltip}
        effect={
          needsSomeone ? { color: ink as never, weight: 'bold' }
          : muted ? { opacity: 0.5 }
          : undefined
        }
      >
        {text}
      </ReqoreSpan>
      {action ? (
        <ReqoreButton
          size={size}
          minimal
          flat
          icon={action.icon}
          intent={action.intent}
          loading={action.loading}
          tooltip={action.tooltip}
          onClick={action.onClick}
          className='reqore-workspace-access-status-action'
        >
          {action.label}
        </ReqoreButton>
      ) : null}
    </TicketPersonValue>
  );
};
