import { ReqoreButton, ReqoreIcon, ReqoreSpan } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import {
  formatInstant,
  formatRelativeTime,
  grantTimeIntent,
  millisUntil,
  supportAccessDurationLabel,
  supportGrantEndCauseLabel,
  supportGrantStateMeta,
  TSupportAccessPolicy,
  TSupportGrantState,
} from './accessMeta';
import { TTicketViewerRole } from './meta';
import { TicketPersonValue } from './TicketHeader';

/*
 * Where a ticket's workspace access stands, as one rail value: granted and for how
 * long, requested and waiting, refused by the setting, or none — with the one thing
 * the viewer may do about it beside it (the customer's Revoke, support's End access).
 * The customer's IDE and the staff portal show the same grant from opposite sides,
 * so the sentence is built here once and `viewerRole` picks the pronoun.
 *
 * The clock is the caller's (`now`): the component never reads the wall clock, so a
 * story freezes it and every surface on a page agrees on "ends in 2 days".
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
  className?: string;
}

const grantedBy = (grant: IWorkspaceAccessGrantSummary, viewerRole: TTicketViewerRole): string => {
  if (grant.created_by_type === 'system') return 'automatically';
  if (grant.created_by_type === 'customer' || !grant.created_by_type) {
    return viewerRole === 'customer' ? 'by you' : 'by the customer';
  }
  return 'by support';
};

/** The sentence, its mark and its colour for the state the props describe. */
export const describeWorkspaceAccess = (
  { grant, request, policy, viewerRole, now }: Pick<IWorkspaceAccessStatusProps, 'grant' | 'request' | 'policy' | 'viewerRole' | 'now'>
): { text: string; tooltip?: string; intent: TReqoreIntent; icon: IReqoreIconName; muted?: boolean } => {
  if (grant && grant.state === 'active') {
    const left = millisUntil(grant.expires_at, now);
    if (!Number.isNaN(left) && left <= 0) {
      return {
        text: `Access ended ${formatRelativeTime(grant.expires_at, now)}`,
        tooltip: formatInstant(grant.expires_at),
        intent: 'muted',
        icon: 'HourglassLine',
      };
    }
    const ends = grant.expires_at ? ` · ends ${formatRelativeTime(grant.expires_at, now)}` : '';
    return {
      text: `Granted ${grantedBy(grant, viewerRole)}${ends}`,
      tooltip: grant.expires_at
        ? `Until ${formatInstant(grant.expires_at)}${grant.until_resolved ? ', or when the ticket is resolved' : ''}`
        : undefined,
      intent: grantTimeIntent(grant.expires_at, now),
      icon: 'ShieldCheckLine',
    };
  }
  if (grant) {
    const meta = supportGrantStateMeta(grant.state);
    const cause = supportGrantEndCauseLabel(grant.end_cause);
    const when = formatRelativeTime(grant.ended_at ?? grant.expires_at, now);
    return {
      text: `Access ${meta.label.toLowerCase()}${cause && cause !== meta.label.toLowerCase() ? `: ${cause}` : ''}${when ? ` · ${when}` : ''}`,
      tooltip: formatInstant(grant.ended_at ?? grant.expires_at) || undefined,
      intent: meta.intent,
      icon: meta.icon,
    };
  }
  if (request) {
    const since = formatRelativeTime(request.requested_at, now);
    const duration = request.suggested_duration ? ` for ${supportAccessDurationLabel(request.suggested_duration)}` : '';
    return {
      text:
        viewerRole === 'customer'
          ? `Qorus Support asks for access${duration} · ${since}`
          : `Requested${duration} · awaiting the customer · ${since}`,
      tooltip: formatInstant(request.requested_at),
      intent: 'pending',
      icon: 'TimeLine',
    };
  }
  if (policy === 'never') {
    return {
      text: viewerRole === 'customer' ? 'Off: your setting is never' : "Not allowed: the account's setting is never",
      intent: 'danger',
      icon: 'ShieldCrossLine',
    };
  }
  return { text: 'None', intent: 'muted', icon: 'ShieldLine', muted: true };
};

export const WorkspaceAccessStatus = ({
  grant,
  request,
  policy,
  viewerRole,
  now,
  action,
  size = 'small',
  className,
}: IWorkspaceAccessStatusProps) => {
  const { text, tooltip, intent, icon, muted } = describeWorkspaceAccess({ grant, request, policy, viewerRole, now });
  return (
    <TicketPersonValue className={`reqore-workspace-access-status${className ? ` ${className}` : ''}`}>
      {/* intent as a dot, the way the rail's other state values read: the colour
          carries the state without a saturated chip in a row of reference material */}
      <ReqoreIcon icon={icon} size='tiny' color={intent as never} />
      <ReqoreSpan size={size} tooltip={tooltip} effect={muted ? { opacity: 0.5 } : undefined}>
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
