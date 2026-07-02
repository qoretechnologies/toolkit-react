import {
  ReqoreBubble,
  ReqoreBubbleGroup,
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreEmptyState,
  ReqoreIcon,
  ReqoreP,
  ReqoreSpinner,
} from '@qoretechnologies/reqore';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';
import {
  IInterfaceReference,
  InterfaceReferenceTags,
  TTicketMessageAuthor,
  TTicketViewerRole,
} from '../supportTicket';

/*
 * Shared support-ticket conversation thread, used by every Qorus surface that
 * shows a ticket: the qorus-ide customer view, the admin-portal staff queue, and
 * the Qonsole `support-ticket` renderer. Presentational — data in, callbacks out
 * — so each consumer keeps its own fetch/websocket wiring.
 *
 * Rendered as a chat transcript with Reqore's `ReqoreBubbleGroup` / `ReqoreBubble`
 * (the same bubble primitive the Qonsole chat uses): consecutive same-author
 * messages cluster into one rounded run, each carries a muted timestamp, and the
 * author label shows once at the top of each run. Interface references render via
 * the shared `InterfaceReferenceTags`; the status/priority/category vocabularies
 * live in `../supportTicket/meta`.
 *
 * The `viewerRole` decides which side "you" sit on and how staff-only internal
 * notes render: the customer view never receives internal notes (the server
 * filters them) and sees staff under a masked "Qorus Support" label; the staff
 * view puts staff on the right and paints internal notes amber + bordered under an
 * "Internal note" label so they can never be mistaken for a customer-visible reply.
 * System messages render as a centered muted line, not a bubble.
 */

export interface ITicketThreadAttachment {
  attachment_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface ITicketThreadMessage {
  message_id: string;
  author_type: TTicketMessageAuthor;
  author_id: string;
  body: string;
  internal?: boolean;
  created: string;
  attachments?: ITicketThreadAttachment[];
  /** Qorus interfaces this message references, as `{kind, name}` snapshots. */
  referenced_interfaces?: IInterfaceReference[];
}

export interface ITicketThreadProps {
  messages: ITicketThreadMessage[];
  /** which side "you" sit on + how internal notes render. */
  viewerRole?: TTicketViewerRole;
  loading?: boolean;
  /** download an attachment (the consumer wires this to its API). */
  onDownloadAttachment?: (attachmentId: string, filename: string) => void;
  /** resolve a per-kind icon for a referenced interface. Consumers with their own
   *  icon vocabulary (e.g. the qorus-ide IDE) pass one; when omitted, a built-in
   *  per-kind default is used so every surface shows consistent chips. */
  resolveInterfaceIcon?: (kind: string) => IReqoreIconName;
  /** open a referenced interface; reference chips are static when omitted (e.g. the staff
   *  view, which can't reach the customer's instance, leaves this out). */
  onInterfaceClick?: (reference: IInterfaceReference) => void;
}

interface IAuthorMeta {
  icon: IReqoreIconName;
}

const AUTHOR_META: Record<TTicketMessageAuthor, IAuthorMeta> = {
  customer: { icon: 'User3Line' },
  staff: { icon: 'CustomerService2Line' },
  system: { icon: 'InformationLine' },
};

/** Compact relative-time label from an ISO timestamp. */
const timeAgo = (iso?: string): string => {
  if (!iso) {
    return '';
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const seconds = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [unit, per] of units) {
    if (Math.abs(seconds) >= per || unit === 'second') {
      return rtf.format(Math.round(seconds / per), unit);
    }
  }
  return '';
};

/** Human-readable file size, e.g. "12.3 KB". */
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
};

/** The label shown above a run of messages. Customer view masks staff identity as
 *  "Qorus Support"; staff view shows the real author with a role prefix. Internal
 *  notes always label as "Internal note" regardless of viewer. */
const authorLabel = (message: ITicketThreadMessage, viewerRole: TTicketViewerRole): string => {
  if (message.internal) {
    return 'Internal note';
  }
  if (viewerRole === 'customer') {
    return message.author_type === 'customer' ? 'You' : 'Qorus Support';
  }
  return `${message.author_type === 'staff' ? 'Support' : 'Customer'} · ${message.author_id}`;
};

/** Per-role bubble tint: staff green, customer blue, internal notes amber. */
const bubbleIntent = (
  message: ITicketThreadMessage
): 'info' | 'success' | 'warning' => {
  if (message.internal) {
    return 'warning';
  }
  return message.author_type === 'staff' ? 'success' : 'info';
};

const StyledThread = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
`;

// System messages read as a centered muted note between bubble clusters; the
// nested rule flattens react-markdown's own <p> margins so it sits on one line.
const StyledSystemRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  opacity: 0.55;
  text-align: center;
  p {
    margin: 0;
  }
`;

interface IBubbleContentProps {
  message: ITicketThreadMessage;
  showLabel: boolean;
  viewerRole: TTicketViewerRole;
  onDownloadAttachment?: (attachmentId: string, filename: string) => void;
  resolveInterfaceIcon?: (kind: string) => IReqoreIconName;
  onInterfaceClick?: (reference: IInterfaceReference) => void;
}

/** The inner content of a message bubble: an optional author label (shown once
 *  per same-author run), the markdown body, attachment chips, and reference chips. */
const BubbleContent = ({
  message,
  showLabel,
  viewerRole,
  onDownloadAttachment,
  resolveInterfaceIcon,
  onInterfaceClick,
}: IBubbleContentProps) => {
  const isInternal = !!message.internal;
  return (
    <>
      {showLabel ? (
        <ReqoreControlGroup verticalAlign='center' gapSize='tiny' style={{ marginBottom: 4 }}>
          <ReqoreIcon
            icon={isInternal ? 'EyeOffLine' : AUTHOR_META[message.author_type].icon}
            size='tiny'
          />
          <ReqoreP size='small' effect={{ weight: 'bold', opacity: 0.7 }}>
            {authorLabel(message, viewerRole)}
          </ReqoreP>
        </ReqoreControlGroup>
      ) : null}
      <ReactMarkdown>{message.body}</ReactMarkdown>
      {message.attachments?.length ? (
        <ReqoreControlGroup wrap gapSize='small' style={{ marginTop: 8 }}>
          {message.attachments.map((a) => (
            <ReqoreButton
              key={a.attachment_id}
              icon='Download2Line'
              size='small'
              flat
              badge={formatBytes(a.size_bytes)}
              tooltip={`${a.content_type} · download`}
              onClick={() => onDownloadAttachment?.(a.attachment_id, a.filename)}
            >
              {a.filename}
            </ReqoreButton>
          ))}
        </ReqoreControlGroup>
      ) : null}
      {message.referenced_interfaces?.length ? (
        <div style={{ marginTop: 8 }}>
          <InterfaceReferenceTags
            references={message.referenced_interfaces}
            resolveInterfaceIcon={resolveInterfaceIcon}
            onInterfaceClick={onInterfaceClick}
          />
        </div>
      ) : null}
    </>
  );
};

type TThreadSegment =
  | { kind: 'system'; message: ITicketThreadMessage }
  | { kind: 'bubbles'; messages: ITicketThreadMessage[] };

/** Split the thread into centered system lines and runs of consecutive
 *  non-system messages (each run becomes one auto-clustered bubble group). */
const toSegments = (messages: ITicketThreadMessage[]): TThreadSegment[] => {
  const segments: TThreadSegment[] = [];
  for (const message of messages) {
    if (message.author_type === 'system') {
      segments.push({ kind: 'system', message });
      continue;
    }
    const last = segments[segments.length - 1];
    if (last?.kind === 'bubbles') {
      last.messages.push(message);
    } else {
      segments.push({ kind: 'bubbles', messages: [message] });
    }
  }
  return segments;
};

export const TicketThread = ({
  messages,
  viewerRole = 'customer',
  loading,
  onDownloadAttachment,
  resolveInterfaceIcon,
  onInterfaceClick,
}: ITicketThreadProps) => {
  if (loading) {
    return (
      <ReqoreControlGroup vertical fluid horizontalAlign='center' style={{ padding: '24px 0' }}>
        <ReqoreSpinner type={5} iconColor='info' size='big'>
          Loading conversation…
        </ReqoreSpinner>
      </ReqoreControlGroup>
    );
  }

  if (!messages.length) {
    return <ReqoreEmptyState icon='Chat3Line' title='No messages yet' />;
  }

  return (
    <StyledThread>
      {toSegments(messages).map((segment, index) =>
        segment.kind === 'system' ? (
          <StyledSystemRow key={segment.message.message_id}>
            <ReqoreIcon icon='InformationLine' size='tiny' />
            <ReactMarkdown>{segment.message.body}</ReactMarkdown>
          </StyledSystemRow>
        ) : (
          <ReqoreBubbleGroup key={`group-${index}`}>
            {segment.messages.map((message, i) => {
              const previous = segment.messages[i - 1];
              // Label once per same-author run; an internal note always gets its
              // own label even from the same staff author.
              const showLabel =
                !previous ||
                previous.author_type !== message.author_type ||
                !!previous.internal !== !!message.internal;
              const isSelf = message.author_type === viewerRole;
              return (
                <ReqoreBubble
                  key={message.message_id}
                  align={isSelf ? 'right' : 'left'}
                  intent={bubbleIntent(message)}
                  minimal={!message.internal}
                  flat={!message.internal}
                  timestamp={timeAgo(message.created) || undefined}
                >
                  <BubbleContent
                    message={message}
                    showLabel={showLabel}
                    viewerRole={viewerRole}
                    onDownloadAttachment={onDownloadAttachment}
                    resolveInterfaceIcon={resolveInterfaceIcon}
                    onInterfaceClick={onInterfaceClick}
                  />
                </ReqoreBubble>
              );
            })}
          </ReqoreBubbleGroup>
        )
      )}
      <ReqoreP size='tiny' effect={{ opacity: 0.5, textAlign: 'center' }}>
        {messages.length} message{messages.length === 1 ? '' : 's'}
      </ReqoreP>
    </StyledThread>
  );
};
