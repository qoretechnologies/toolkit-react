import {
  ReqoreBubble,
  ReqoreBubbleGroup,
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreEmptyState,
  ReqoreIcon,
  ReqoreP,
  ReqoreSkeleton,
  ReqoreTimeAgo,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { rgba } from 'polished';
import { ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';
import { formatBytes, isImage } from '../../helpers/common';
import { ImageLightbox } from '../imageLightbox';
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
 * Rendered as a comment feed: an avatar beside a bordered, accent-tinted card per
 * message, each hugging its own side. Built on Reqore's `ReqoreBubble` (which
 * supplies the avatar, the bold author label, the alignment and the tint), so the
 * accent follows whatever the host app themes `custom1` to rather than a colour
 * baked in here. Interface references render via the shared
 * `InterfaceReferenceTags`; the status/priority/category vocabularies live in
 * `../supportTicket/meta`.
 *
 * Runs of consecutive messages are wrapped in a `ReqoreBubbleGroup`, which prints
 * one time under the last card of each same-side run instead of one per card — a
 * burst of replies reads as a single moment.
 *
 * The `viewerRole` decides which side "you" sit on and how staff-only internal
 * notes render: the customer view never receives internal notes (the server
 * filters them) and sees staff under a masked "Qorus Support" label; the staff
 * view puts staff on the right and paints internal notes amber so they can never
 * be mistaken for a customer-visible reply. System messages render as a centered
 * muted line, not a card.
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
  /**
   * Fetch an image attachment's bytes as an object URL, for the inline thumbnail +
   * click-to-enlarge preview. Omitted ⇒ image attachments fall back to the same
   * download chip as every other file, so the thread degrades rather than breaks
   * where a consumer hasn't wired it. Non-image attachments never use it.
   */
  fetchAttachmentUrl?: (attachmentId: string) => Promise<string>;
  /** resolve a per-kind icon for a referenced interface. Consumers with their own
   *  icon vocabulary (e.g. the qorus-ide IDE) pass one; when omitted, a built-in
   *  per-kind default is used so every surface shows consistent chips. */
  resolveInterfaceIcon?: (kind: string) => IReqoreIconName;
  /** open a referenced interface; reference chips are static when omitted (e.g. the staff
   *  view, which can't reach the customer's instance, leaves this out). */
  onInterfaceClick?: (reference: IInterfaceReference) => void;
  /** The TICKET's own references (picked when filing). Echoed as chips on the opening
   *  message so the conversation carries them too — when they lived only in the header
   *  rail + References tab, readers looked for them in the thread and concluded the
   *  ticket had none. Deduped against the opening message's own message-level refs. */
  ticketReferences?: IInterfaceReference[];
}

interface IAuthorMeta {
  icon: IReqoreIconName;
}

const AUTHOR_META: Record<TTicketMessageAuthor, IAuthorMeta> = {
  customer: { icon: 'User3Line' },
  staff: { icon: 'CustomerService2Line' },
  system: { icon: 'InformationLine' },
};

// Both sides share one accent: the side, the avatar and the author label already
// carry who is speaking, which frees colour to mean "internal note" and nothing
// else. `custom1` is a theme slot, so each host app supplies its own hue.
const ACCENT: ComponentProps<typeof ReqoreBubble>['customTheme'] = { main: 'custom1' };

/** Avatar glyph; an internal note carries the "not visible to the customer" eye. */
const authorIcon = (message: ITicketThreadMessage): IReqoreIconName =>
  message.internal ? 'EyeOffLine' : AUTHOR_META[message.author_type].icon;


/** The label above a message. The customer view masks staff identity as "Qorus
 *  Support"; the staff view shows the real author with a role prefix. Internal
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

/**
 * DOM id of a message in the rendered thread.
 *
 * Exported rather than inlined so that anything wanting to reveal a message — a
 * "show in chat" action on a reference, a deep link — derives the id from the same
 * function the thread renders with. Two copies of the same template string is exactly
 * how that contract silently breaks when one side is renamed.
 */
export const ticketMessageDomId = (messageId: string): string => `ticket-message-${messageId}`;

const StyledThread = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;

  /*
   * A thread too short to fill its scroller sits at the BOTTOM, against the
   * composer, the way every chat surface behaves — otherwise the first reply
   * floats at the top of a tall drawer with dead space beneath it, and each new
   * message appears further from the box you just typed in.
   *
   * The auto top margin does the pushing rather than 'justify-content: flex-end':
   * with flex-end, once the thread outgrows the scroller the overflow spills past
   * the top edge and those first messages cannot be scrolled back into view. An
   * auto margin only consumes FREE space, so it collapses to zero the moment the
   * content overflows and normal scrolling is preserved.
   *
   * min-height needs a definite height on the scroll parent to resolve; where a
   * consumer doesn't provide one it simply computes to auto and the thread keeps
   * its natural top-aligned flow.
   */
  min-height: 100%;

  > *:first-child {
    margin-top: auto;
  }
`;

// The loading placeholder: pulsing skeleton "bubbles" alternating sides, so the
// wait previews the thread it's about to become rather than a bare spinner. Built
// from reqore's `ReqoreSkeleton` — the shape (avatar circle + a short label line +
// N body lines) mirrors a real message. Sizes vary so it doesn't read as a grid.
const SKELETON_BUBBLES: { self: boolean; lines: number; width: number }[] = [
  { self: false, lines: 2, width: 58 },
  { self: true, lines: 1, width: 42 },
  { self: true, lines: 3, width: 64 },
  { self: false, lines: 2, width: 50 },
  { self: false, lines: 1, width: 46 },
  { self: true, lines: 2, width: 60 },
  { self: false, lines: 3, width: 54 },
];

/*
 * The skeleton fills the height from the TOP, unlike a real thread, which sits at the
 * bottom against the composer. The bottom-pin is right for real messages — a short
 * conversation belongs next to the box you type in — but a placeholder inheriting it
 * clusters a few bubbles at the bottom under a large empty gap, which reads as a
 * broken render rather than "loading". A loading skeleton grows top-down, the
 * universal convention, so it occupies the space it's given no matter how tall.
 */
const StyledSkeletonThread = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-height: 100%;
  /* A real message carries its own bubble, so it never touches the host's edge.
     The skeleton is bare bars, and without this its avatars and lines were
     pressed flat against the border of whatever holds the thread — which reads
     as a clipped render rather than as loading. border-box so the padding comes
     out of the 100% rather than adding to it. */
  box-sizing: border-box;
  padding: 12px;
`;

const StyledSkeletonRow = styled.div<{ $self: boolean }>`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: ${({ $self }) => ($self ? 'flex-end' : 'flex-start')};
`;

// Content stays left-aligned even on a right-side row — like a real bubble, where
// the label sits top-left however the bubble is aligned; the row positions the
// whole block, this just lays the lines out within it.
const StyledSkeletonLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
`;

const ConversationSkeleton = () => (
  <StyledSkeletonThread aria-busy='true' aria-label='Loading conversation'>
    {SKELETON_BUBBLES.map((bubble, index) => {
      const avatar = <ReqoreSkeleton circle width='30px' height='30px' />;
      return (
        <StyledSkeletonRow key={index} $self={bubble.self}>
          {!bubble.self && avatar}
          <StyledSkeletonLines style={{ width: `${bubble.width}%` }}>
            <ReqoreSkeleton width='38%' height='10px' />
            {Array.from({ length: bubble.lines }).map((_, line) => (
              <ReqoreSkeleton
                key={line}
                width={line === bubble.lines - 1 ? '72%' : '100%'}
                height='8px'
              />
            ))}
          </StyledSkeletonLines>
          {bubble.self && avatar}
        </StyledSkeletonRow>
      );
    })}
  </StyledSkeletonThread>
);

// Debosses the empty state: washes the icon + title back with opacity (kept
// theme-agnostic) and adds a faint light edge below, so "No messages yet" reads
// as pressed into the surface rather than announced.
const StyledEmpty = styled.div`
  /*
   * Centre the placeholder in the space it's given rather than letting it sit at the
   * top. Like the thread, this fills its scroll parent (min-height: 100%, which needs a
   * definite height to resolve — the drawer body provides one; where a consumer doesn't,
   * it collapses to auto and the state keeps its natural top-aligned flow).
   */
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .reqore-icon {
    opacity: 0.28;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    opacity: 0.4;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.07);
  }
`;

// System messages read as a centered muted note between cards; the nested rule
// flattens react-markdown's own <p> margins so it sits on one line.
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

interface IStyledMarkdownProps {
  $color: string;
  $emphasis: string;
  $code: string;
  $link: string;
}

// The message body, washed a step below the bright author name in the card's
// header so the two read as different things; in-body **bold** lifts back toward
// full strength as emphasis. Every colour derives from the active Reqore theme
// rather than a hardcoded hex, so the thread reads correctly on any host app.
const StyledMarkdown = styled.div<IStyledMarkdownProps>`
  color: ${({ $color }) => $color};
  word-break: break-word;

  > *:first-child {
    margin-top: 0;
  }
  > *:last-child {
    margin-bottom: 0;
  }

  p {
    margin: 0 0 6px;
  }
  strong {
    color: ${({ $emphasis }) => $emphasis};
    font-weight: 600;
  }
  ul,
  ol {
    margin: 4px 0;
    padding-left: 18px;
  }
  li {
    margin: 2px 0;
  }
  code {
    font-family: monospace;
    background: ${({ $code }) => $code};
    padding: 1px 5px;
    border-radius: 4px;
  }
  pre {
    margin: 6px 0;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.35);
    border-radius: 4px;
    overflow-x: auto;
  }
  pre code {
    background: none;
    padding: 0;
    white-space: pre;
  }
  a {
    color: ${({ $link }) => $link};
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
`;

/** A message body rendered as markdown, tinted from the active theme. */
const MessageBody = ({ children }: { children: string }) => {
  const theme = useReqoreTheme();
  const readable = getReadableColor(theme);
  const link = theme.intents?.info ?? readable;
  return (
    <StyledMarkdown
      $color={rgba(readable, 0.72)}
      $emphasis={rgba(readable, 0.95)}
      $code={rgba(readable, 0.1)}
      $link={link}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </StyledMarkdown>
  );
};

/** A file attachment as a download chip — the fallback for every non-image, and for
 *  images when no `fetchAttachmentUrl` is wired. */
const AttachmentChip = ({
  attachment,
  onDownloadAttachment,
}: {
  attachment: ITicketThreadAttachment;
  onDownloadAttachment?: (attachmentId: string, filename: string) => void;
}) => (
  <ReqoreButton
    icon='Download2Line'
    size='small'
    flat
    badge={formatBytes(attachment.size_bytes)}
    tooltip={`${attachment.content_type} · download`}
    onClick={() => onDownloadAttachment?.(attachment.attachment_id, attachment.filename)}
  >
    {attachment.filename}
  </ReqoreButton>
);

const StyledThumb = styled.button`
  appearance: none;
  padding: 0;
  border: 1px solid ${rgba('#ffffff', 0.12)};
  border-radius: 8px;
  overflow: hidden;
  background: ${rgba('#000000', 0.25)};
  cursor: zoom-in;
  line-height: 0;
  display: block;

  img {
    display: block;
    max-width: 240px;
    max-height: 200px;
    object-fit: cover;
  }
`;

/**
 * An image attachment as a thumbnail; clicking it opens the shared `ImageLightbox`
 * (owned by `AttachmentList`, which knows the whole image set for paging). The bytes
 * come from `fetchAttachmentUrl`, so until they arrive a skeleton holds the space, and
 * if the fetch fails the attachment degrades to the same download chip as any other
 * file rather than showing a broken image.
 */
const ImageThumb = ({
  attachment,
  fetchAttachmentUrl,
  onOpen,
  onDownloadAttachment,
}: {
  attachment: ITicketThreadAttachment;
  fetchAttachmentUrl: (attachmentId: string) => Promise<string>;
  onOpen: () => void;
  onDownloadAttachment?: (attachmentId: string, filename: string) => void;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    fetchAttachmentUrl(attachment.attachment_id)
      .then((resolved) => alive && setUrl(resolved))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [attachment.attachment_id]);

  if (failed) {
    return <AttachmentChip attachment={attachment} onDownloadAttachment={onDownloadAttachment} />;
  }
  if (!url) {
    return <ReqoreSkeleton width='180px' height='120px' />;
  }
  return (
    <StyledThumb type='button' title={`${attachment.filename} — click to enlarge`} onClick={onOpen}>
      <img src={url} alt={attachment.filename} />
    </StyledThumb>
  );
};

/**
 * A message's attachments, split into two rows: previewable images as a row of
 * thumbnails, and everything else as a row of download chips beneath.
 *
 * They can't share one wrapping row — a thumbnail is ~120px tall and a chip ~26px, so
 * mixed together the chips wrap raggedly around the image and the group reads as
 * broken. Grouping by kind keeps each row uniform. Images only preview when a
 * `fetchAttachmentUrl` is wired; without it they're files like any other and fall into
 * the chip row.
 */
const AttachmentList = ({
  attachments,
  fetchAttachmentUrl,
  onDownloadAttachment,
}: {
  attachments: ITicketThreadAttachment[];
  fetchAttachmentUrl?: (attachmentId: string) => Promise<string>;
  onDownloadAttachment?: (attachmentId: string, filename: string) => void;
}) => {
  const previewable = Boolean(fetchAttachmentUrl);
  const images = previewable ? attachments.filter((a) => isImage(a.content_type)) : [];
  const imageIds = new Set(images.map((a) => a.attachment_id));
  const files = attachments.filter((a) => !imageIds.has(a.attachment_id));
  // which image the shared lightbox is showing; null = closed
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <ReqoreControlGroup vertical gapSize='small' style={{ marginTop: 8 }}>
      {images.length ? (
        <ReqoreControlGroup wrap gapSize='small' verticalAlign='flex-start'>
          {images.map((attachment, index) => (
            <ImageThumb
              key={attachment.attachment_id}
              attachment={attachment}
              fetchAttachmentUrl={fetchAttachmentUrl!}
              onOpen={() => setOpenIndex(index)}
              onDownloadAttachment={onDownloadAttachment}
            />
          ))}
        </ReqoreControlGroup>
      ) : null}
      {files.length ? (
        <ReqoreControlGroup wrap gapSize='small'>
          {files.map((attachment) => (
            <AttachmentChip
              key={attachment.attachment_id}
              attachment={attachment}
              onDownloadAttachment={onDownloadAttachment}
            />
          ))}
        </ReqoreControlGroup>
      ) : null}
      {openIndex !== null && fetchAttachmentUrl ? (
        <ImageLightbox
          images={images}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          fetchAttachmentUrl={fetchAttachmentUrl}
          onDownload={onDownloadAttachment}
        />
      ) : null}
    </ReqoreControlGroup>
  );
};

type TThreadSegment =
  | { kind: 'system'; message: ITicketThreadMessage }
  | { kind: 'bubbles'; messages: ITicketThreadMessage[] };

/** Split the thread into centred system lines and runs of consecutive non-system
 *  messages — each run becomes one `ReqoreBubbleGroup`, which is what collapses a
 *  same-side burst onto a single timestamp. */
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
  fetchAttachmentUrl,
  resolveInterfaceIcon,
  onInterfaceClick,
  ticketReferences,
}: ITicketThreadProps) => {
  // Open scrolled to the newest message, and follow new arrivals down — a thread is read
  // from the bottom, like any chat. Keyed on the message COUNT so it fires on open and when
  // a reply lands, not on every re-render (which would fight a user who has scrolled up to
  // read history). Scrolls the nearest scrollable ancestor (the drawer body) straight to its
  // end rather than scrollIntoView on a sentinel — scrollIntoView also drags any outer scroll
  // container around and stops one bottom-padding short of the real end.
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Find the thread's OWN scroll container — the nearest ancestor that actually scrolls
    // (overflow-y auto/scroll), not merely the first one that currently overflows. A short
    // thread's container fits its content, so a "does it overflow?" test would walk straight
    // past it and scroll the whole page/panel to the bottom instead.
    let scroller = threadRef.current?.parentElement ?? null;
    while (scroller) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        break;
      }
      scroller = scroller.parentElement;
    }
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages.length]);

  // Segment the flat message list into system rows + author-grouped bubble runs once per
  // message change — not on every re-render (scroll, hover and resize all re-render this).
  const segments = useMemo(() => toSegments(messages), [messages]);

  // The opening (description) message — the ticket's own references echo on it, deduped
  // against any refs that message carries itself, so the intent still has ONE authoritative
  // home (the References tab) but the conversation no longer reads as reference-free.
  const openingMessageId = useMemo(
    () => messages.find((m) => m.author_type !== 'system')?.message_id,
    [messages]
  );
  const openingRefs = useMemo(() => {
    if (!ticketReferences?.length) {
      return undefined;
    }
    const opening = messages.find((m) => m.message_id === openingMessageId);
    const seen = new Set<string>();
    return [...ticketReferences, ...(opening?.referenced_interfaces ?? [])].filter((ref) => {
      const key = `${ref.interface_kind}:${ref.interface_name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [ticketReferences, messages, openingMessageId]);

  const refsFor = (message: ITicketThreadMessage): IInterfaceReference[] | undefined =>
    message.message_id === openingMessageId && openingRefs
      ? openingRefs
      : message.referenced_interfaces;

  // Only the FIRST load gets the skeleton. A refetch while messages are already on
  // screen must leave them there: every send triggers one (and, where the thread is
  // live, so does the other party sending), and blanking a conversation you are
  // reading — replacing it with pulsing placeholders — is the single worst moment to
  // do it. The new message simply appears when the refetch resolves.
  if (loading && !messages.length) {
    return <ConversationSkeleton />;
  }

  if (!messages.length) {
    return (
      <StyledEmpty>
        <ReqoreEmptyState icon='Chat3Line' title='No messages yet' flat transparent />
      </StyledEmpty>
    );
  }

  return (
    <StyledThread ref={threadRef}>
      {segments.map((segment, index) =>
        segment.kind === 'system' ? (
          <StyledSystemRow
            key={segment.message.message_id}
            id={ticketMessageDomId(segment.message.message_id)}
          >
            <ReqoreIcon icon='InformationLine' size='tiny' />
            <ReactMarkdown>{segment.message.body}</ReactMarkdown>
          </StyledSystemRow>
        ) : (
          <ReqoreBubbleGroup key={`group-${index}`}>
            {segment.messages.map((message) => (
              <ReqoreBubble
                key={message.message_id}
                // anchor for "show in chat"; ReqoreBubble forwards unknown props to
                // its DOM node, so this lands on the rendered element
                id={ticketMessageDomId(message.message_id)}
                size='small'
                maxWidth='76%'
                align={message.author_type === viewerRole ? 'right' : 'left'}
                avatar={{ icon: authorIcon(message) }}
                label={authorLabel(message, viewerRole)}
                timestamp={message.created ? <ReqoreTimeAgo time={message.created} /> : undefined}
                // Own messages read as info-blue, the other party's as the purple
                // accent — so the two sides of the conversation are told apart by
                // colour as well as by side, and "which of these did I write?" is
                // answerable at a glance. Deliberately keyed off `viewerRole`, so it
                // stays correct on the staff surface too (staff replies are the blue
                // ones there). Internal notes keep their warning intent and are not
                // re-tinted — they are neither side of the conversation.
                intent={
                  message.internal
                    ? 'warning'
                    : message.author_type === viewerRole
                      ? 'info'
                      : undefined
                }
                customTheme={
                  message.internal || message.author_type === viewerRole ? undefined : ACCENT
                }
                flat={false}
                minimal
              >
                <MessageBody>{message.body}</MessageBody>
                {message.attachments?.length ? (
                  <AttachmentList
                    attachments={message.attachments}
                    fetchAttachmentUrl={fetchAttachmentUrl}
                    onDownloadAttachment={onDownloadAttachment}
                  />
                ) : null}
                {refsFor(message)?.length ? (
                  <div style={{ marginTop: 8 }}>
                    <InterfaceReferenceTags
                      size='tiny'
                      customTheme={ACCENT}
                      references={refsFor(message)}
                      resolveInterfaceIcon={resolveInterfaceIcon}
                      onInterfaceClick={onInterfaceClick}
                    />
                  </div>
                ) : null}
              </ReqoreBubble>
            ))}
          </ReqoreBubbleGroup>
        )
      )}
      <ReqoreP size='tiny' effect={{ opacity: 0.5, textAlign: 'center' }}>
        {messages.length} message{messages.length === 1 ? '' : 's'}
      </ReqoreP>
    </StyledThread>
  );
};
