import {
  ReqoreButton,
  ReqoreColumns,
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreEmptyState,
  ReqoreEntityRow,
  ReqoreInput,
  ReqorePanel,
  ReqoreSpan,
  ReqoreSpinner,
  ReqoreTextEffect,
} from '@qoretechnologies/reqore';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { TReqoreEffectColor } from '@qoretechnologies/reqore/dist/components/Effect';
import type { IReqoreEntityRowAction } from '@qoretechnologies/reqore/dist/components/EntityRow';
import type { IReqorePanelSubAction } from '@qoretechnologies/reqore/dist/components/Panel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import timeago from 'epoch-timeago';
import styled from 'styled-components';
import { formatBytes, isImage } from '../../helpers/common';
import { ImageLightbox } from '../imageLightbox';
import {
  defaultInterfaceIcon,
  IInterfaceReference,
  TTicketViewerRole,
} from '../supportTicket/meta';
import type { ITicketThreadAttachment, ITicketThreadMessage } from '../ticketThread/TicketThread';

/*
 * TicketReferences — the consolidated "everything attached to or linked from a
 * ticket" surface. It gathers, across the ticket description and every reply:
 *   • Screenshots — image attachments as a thumbnail grid → a zoom/paging lightbox.
 *     First: the visual evidence is what a reader scans for.
 *   • Linked interfaces — the {kind, name} snapshots as rows (kind as metadata),
 *     sorted by kind then name, matching the file rows below.
 *   • Files — every other attachment as a type-iconed row with provenance + download.
 * None of the mainstream desks (Zendesk/Front/Intercom/…) ship this consolidated
 * view, so it's the drawer's differentiator. Rendered as a tab in the staff drawer
 * and a panel in the customer modal; only the data + handlers differ by viewer.
 */

/** Attachment metadata as returned by the list endpoint — carries the provenance
 *  (uploader + timestamp + source message) the message-embedded metadata omits. */
export interface ITicketReferenceAttachment extends ITicketThreadAttachment {
  /** the reply this file was attached to; null/absent = ticket-level */
  message_id?: string | null;
  /** the uploader, resolved + masked like the thread's message author (a staff
   *  uploader reads as "Qorus Support" on the customer plane, never the raw identity) */
  uploaded_by?: string;
  /** the kind of party that uploaded the file — lets the viewer label it */
  uploader_type?: 'customer' | 'staff';
  /** ISO timestamp the file was attached */
  created?: string;
}

export interface ITicketReferencesProps {
  /** ticket-level interface references (from `ticket.referenced_interfaces`) */
  references?: IInterfaceReference[];
  /** the thread — source of message-level references and, as a fallback, attachments */
  messages?: ITicketThreadMessage[];
  /** the ticket's attachments from the list endpoint; preferred over the message-embedded
   *  ones because it carries provenance and any ticket-level files. Falls back to `messages`. */
  attachments?: ITicketReferenceAttachment[];
  viewerRole?: TTicketViewerRole;
  /** fetch an attachment's bytes as an object URL, for inline image preview + the lightbox.
   *  Omitted ⇒ screenshots show as download tiles instead of thumbnails. */
  fetchAttachmentUrl?: (attachmentId: string) => Promise<string>;
  /** trigger a browser download of an attachment */
  onDownloadAttachment?: (attachmentId: string, filename: string) => void;
  /** open a referenced interface; reference chips are static (informational) when omitted */
  onInterfaceClick?: (reference: IInterfaceReference) => void;
  /** Reveal the message a reference or file came from, in the conversation.
   *  Omitted ⇒ the action is not offered. It is also omitted per-row for anything filed
   *  against the ticket itself rather than a reply, which has no message to reveal. */
  onShowInChat?: (messageId: string) => void;
  /** resolve a per-kind icon for a referenced interface (the IDE passes its own vocabulary) */
  resolveInterfaceIcon?: (kind: string) => IReqoreIconName;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
// `epoch-timeago` — the same library reqore's `ReqoreTimeAgo` and the IDE's ticket
// list use. This is a string context (a metadata run), so a helper rather than the
// component; it stays consistent with them instead of a bespoke Intl reimplementation.
const timeAgo = (iso?: string): string => {
  if (!iso) {
    return '';
  }
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? '' : timeago(ms);
};

interface IFileType {
  icon: IReqoreIconName;
  color: TReqoreEffectColor;
  label: string;
}
// MIME → a type icon (glyph) + a category tint, Fluent-style: colour distinguishes
// the file family, the glyph its shape. Tints stay moderate for a dark surface.
const fileType = (contentType: string): IFileType => {
  const ct = contentType.toLowerCase();
  if (ct === 'application/pdf') {
    return { icon: 'FilePdf2Line', color: '#f56059', label: 'PDF' };
  }
  if (ct.includes('zip') || ct.includes('gzip')) {
    return { icon: 'FileZipLine', color: '#f2a63c', label: 'Archive' };
  }
  if (ct === 'text/csv') {
    return { icon: 'FileExcel2Line', color: '#46c96f', label: 'CSV' };
  }
  if (ct.includes('json') || ct.includes('yaml') || ct.includes('xml')) {
    return { icon: 'CodeSLine', color: '#55a0ff', label: 'Data' };
  }
  if (ct.includes('markdown')) {
    return { icon: 'MarkdownLine', color: '#55a0ff', label: 'Markdown' };
  }
  if (ct === 'text/x-log') {
    return { icon: 'FileList2Line', color: '#8b8a97', label: 'Log' };
  }
  if (ct.startsWith('text/')) {
    return { icon: 'FileTextLine', color: '#8b8a97', label: 'Text' };
  }
  return { icon: 'FileLine', color: '#8b8a97', label: 'File' };
};

// A coarse file family for the type filter. Images are their own section, so this
// only buckets the non-image "Files"; it mirrors fileType's grouping.
type TFileCategory = 'documents' | 'data' | 'logs' | 'archives';
const fileCategory = (contentType: string): TFileCategory => {
  const ct = contentType.toLowerCase();
  if (ct.includes('zip') || ct.includes('gzip')) {
    return 'archives';
  }
  if (ct === 'text/x-log') {
    return 'logs';
  }
  if (ct === 'text/csv' || ct.includes('json') || ct.includes('yaml') || ct.includes('xml')) {
    return 'data';
  }
  return 'documents';
};

// The type filter: 'all' plus one option per section / file-family. Empty families
// are hidden from the menu (a ticket with no archives never offers "Archives").
type TRefFilter = 'all' | 'links' | 'screenshots' | TFileCategory;
type TRefSort = 'newest' | 'oldest' | 'name' | 'size';

const FILTER_META: Record<TRefFilter, { label: string; icon: IReqoreIconName }> = {
  all: { label: 'All types', icon: 'Apps2Line' },
  links: { label: 'Linked interfaces', icon: 'LinksLine' },
  screenshots: { label: 'Screenshots', icon: 'ImageLine' },
  documents: { label: 'Documents', icon: 'FileTextLine' },
  data: { label: 'Data', icon: 'CodeSLine' },
  logs: { label: 'Logs', icon: 'FileList2Line' },
  archives: { label: 'Archives', icon: 'FileZipLine' },
};
// the four filter keys that live inside the "Files" section
const FILE_FILTERS: TFileCategory[] = ['documents', 'data', 'logs', 'archives'];
// menu order mirrors the section order on screen: screenshots, links, then files
const FILTER_ORDER: TRefFilter[] = ['all', 'screenshots', 'links', ...FILE_FILTERS];

const SORT_META: Record<TRefSort, { label: string; icon: IReqoreIconName }> = {
  newest: { label: 'Newest first', icon: 'SortDesc' },
  oldest: { label: 'Oldest first', icon: 'SortAsc' },
  name: { label: 'Name (A–Z)', icon: 'SortAlphabetAsc' },
  size: { label: 'Largest first', icon: 'ScalesLine' },
};
const SORT_ORDER: TRefSort[] = ['newest', 'oldest', 'name', 'size'];

const createdMs = (a: ITicketReferenceAttachment): number =>
  a.created ? new Date(a.created).getTime() || 0 : 0;

/**
 * A reference plus where it was cited.
 *
 * `message_id` is absent for a ticket-level reference — those are filed against the
 * ticket itself (`message_id IS NULL` server-side), so there is no message to reveal
 * and "show in chat" must not be offered for them.
 */
export interface IResolvedInterfaceReference extends IInterfaceReference {
  message_id?: string;
}

// dedupe a mixed run of references (ticket + every message) by identity — the same
// interface referenced ticket-level and in a reply is one entry, not two.
const dedupeRefs = (refs: IResolvedInterfaceReference[]): IResolvedInterfaceReference[] => {
  const byKey = new Map<string, IResolvedInterfaceReference>();
  for (const r of refs) {
    const key = `${r.interface_kind}:${r.interface_name}`;
    const kept = byKey.get(key);
    if (!kept) {
      byKey.set(key, r);
      continue;
    }
    // The ticket-level copy is merged first and carries no message. When the same
    // interface also appears in a reply, adopt that linkage instead of discarding it —
    // otherwise an interface that demonstrably IS in the thread offers no way to jump
    // to it, purely because it happened to be cited on the ticket as well.
    if (!kept.message_id && r.message_id) {
      byKey.set(key, { ...kept, message_id: r.message_id });
    }
  }
  return Array.from(byKey.values());
};

const META_EFFECT = { textSize: 'small', opacity: 0.55 } as const;

// ---------------------------------------------------------------------------
// image URLs — fetch every screenshot's bytes once as an object URL, cached, and
// revoked on unmount / when the set changes. Shared by the grid and the lightbox.
// ---------------------------------------------------------------------------
const useImageUrls = (
  ids: string[],
  fetchAttachmentUrl?: (attachmentId: string) => Promise<string>
): Record<string, string | null> => {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const key = ids.join(',');

  useEffect(() => {
    if (!ids.length) {
      return undefined;
    }
    // No fetcher wired means there is no preview to wait for — resolve every id
    // straight to the "no preview" state (null) so tiles fall through to the
    // filename / download fallback instead of a forever-pending "…" (undefined
    // is reserved for a wired fetcher's genuinely in-flight requests).
    if (!fetchAttachmentUrl) {
      setUrls(Object.fromEntries(ids.map((id) => [id, null])));
      return undefined;
    }
    let active = true;
    const created: string[] = [];
    Promise.allSettled(
      ids.map((id) => fetchAttachmentUrl(id).then((url) => ({ id, url })))
    ).then((results) => {
      if (!active) {
        return;
      }
      const next: Record<string, string | null> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          next[r.value.id] = r.value.url;
          created.push(r.value.url);
        } else {
          next[ids[i]] = null;
        }
      });
      setUrls(next);
    });
    return () => {
      active = false;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
    // `key` is the stable signature of `ids`; re-run when the image set changes.
  }, [key, fetchAttachmentUrl]);

  return urls;
};

// ---------------------------------------------------------------------------
// styled bits (reqore covers the rest)
// ---------------------------------------------------------------------------
/*
 * The search/filter/sort strip reads as part of the list it filters, not as a stray
 * row above it: it gets its own tinted, bordered surface and sticks to the top of the
 * scroll container. Free-floating, it was easy to lose track of — and scrolling the
 * sections took the search box away with them, which is exactly when you want it.
 */
const Toolbar = styled.div`
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(6px);
`;

/*
 * A screenshot tile: the image is the button, and the overflow menu is a sibling
 * layered over it — a <button> cannot legally contain another button, so the menu
 * cannot live inside Thumb. It stays hidden until the tile is hovered or something
 * inside it takes focus, so a wall of screenshots still reads as images rather than
 * a grid of controls. Hidden by opacity rather than display, so it remains reachable
 * by keyboard.
 */
const ThumbTile = styled.div`
  position: relative;
  /*
   * A single-cell grid, not flex: a grid child stretches to fill by default, so the
   * thumbnail spans the whole tile and the overlay's top-right corner IS the image's
   * top-right corner. Under flex the button sized itself from its aspect-ratio, left a
   * strip of empty tile beside it, and the menu — anchored to the tile — landed in that
   * strip instead of over the image.
   */
  display: grid;

  > .screenshot-menu {
    position: absolute;
    top: 5px;
    right: 5px;
    opacity: 0;
    transition: opacity 0.12s ease-out;
  }

  &:hover > .screenshot-menu,
  &:focus-within > .screenshot-menu {
    opacity: 1;
  }
`;

const Thumb = styled.button`
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  aspect-ratio: 1 / 1;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: border-color 0.15s;
  &:hover {
    border-color: rgba(169, 116, 255, 0.6);
  }
  &:focus-visible {
    outline: 2px solid #a974ff;
    outline-offset: 2px;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;
const ThumbCaption = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 4px 6px;
  font-size: 10px;
  color: #fff;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.75), transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
`;
// ---------------------------------------------------------------------------
// screenshot thumbnail
// ---------------------------------------------------------------------------
const Screenshot = ({
  att,
  url,
  onOpen,
  menu,
}: {
  att: ITicketReferenceAttachment;
  url: string | null | undefined;
  onOpen: () => void;
  menu?: IReqorePanelSubAction[];
}) => (
  <ThumbTile>
    <Thumb type='button' title={att.filename} onClick={onOpen}>
      {url ? (
        <img src={url} alt={att.filename} />
      ) : (
        <ReqoreSpan effect={{ opacity: 0.5, textSize: 'small' }}>
          {url === null ? att.filename : '…'}
        </ReqoreSpan>
      )}
      <ThumbCaption>{att.filename}</ThumbCaption>
    </Thumb>
    {/* One action doesn't earn a menu. With a single entry the overlay IS that
        action, so a tile and a file row offer the same thing the same way instead of
        hiding a download behind a caret on one surface and not the other. */}
    {menu?.length === 1 ? (
      <ReqoreButton
        className='screenshot-menu'
        icon={menu[0].icon}
        tooltip={menu[0].label as string}
        size='small'
        flat
        minimal
        fixed
        onClick={(event: React.MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          menu[0].onClick?.(menu[0]);
        }}
      />
    ) : menu?.length ? (
      <ReqoreDropdown
        className='screenshot-menu'
        icon='More2Line'
        tooltip='More actions'
        size='small'
        flat
        minimal
        fixed
        useTargetWidth={false}
        items={menu}
        onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
      />
    ) : null}
  </ThumbTile>
);

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
export const TicketReferences = ({
  references = [],
  messages = [],
  attachments,
  viewerRole,
  fetchAttachmentUrl,
  onDownloadAttachment,
  onInterfaceClick,
  onShowInChat,
  resolveInterfaceIcon,
  loading,
}: ITicketReferencesProps) => {
  // references: ticket-level + every message's, deduped. Rendered as rows carrying
  // their kind as metadata — the same treatment as the files below — so the tab
  // reads as one consistent list rather than chips above rows.
  const allRefs = useMemo(
    () =>
      dedupeRefs([
        // ticket-level first (no message), then each message's own citations tagged
        // with the message they came from
        ...references,
        ...messages.flatMap((m) =>
          (m.referenced_interfaces ?? []).map((r) => ({ ...r, message_id: m.message_id }))
        ),
      ]),
    [references, messages]
  );
  const resolveIcon = resolveInterfaceIcon ?? defaultInterfaceIcon;

  /**
   * The trailing controls for a row: its primary action, plus a "three dots" menu when
   * there is anything else to offer. Built in one place so the interface rows and the
   * file rows can't drift into different affordances.
   *
   * The menu is omitted entirely when it would be empty — a row filed against the
   * ticket rather than a reply has no message to reveal, and an always-present menu
   * that is sometimes empty is worse than no menu.
   */
  /**
   * The reveal action. One definition, used by the reference rows, the file rows and
   * the screenshot tiles.
   *
   * Present on every row, but DISABLED for anything filed against the ticket itself
   * rather than a reply — those have no message to jump to. Showing the menu on some
   * rows and not others read as breakage rather than as a distinction, and the
   * disabled entry says why instead of leaving the reader to infer it.
   */
  const showInChatItem = (messageId?: string | null): IReqorePanelSubAction[] => {
    if (!onShowInChat) {
      return [];
    }
    return messageId
      ? [{ label: 'Show in chat', icon: 'Chat1Line', onClick: () => onShowInChat(messageId) }]
      : [
          {
            label: 'Show in chat',
            icon: 'Chat1Line',
            disabled: true,
            description: 'Filed on the ticket, not in a reply',
          },
        ];
  };

  const rowActions = (
    primary: IReqoreEntityRowAction | undefined,
    messageId?: string | null
  ): IReqoreEntityRowAction[] => {
    const menu = showInChatItem(messageId);

    return [
      ...(primary ? [primary] : []),
      ...(menu.length
        ? [
            {
              icon: 'More2Line' as IReqoreIconName,
              tooltip: 'More actions',
              flat: true,
              minimal: true,
              actions: menu,
            },
          ]
        : []),
    ];
  };

  // attachments: the list-endpoint set (with provenance) or, failing that, the
  // ones embedded per message (deriving provenance from the carrying message)
  const allAttachments = useMemo<ITicketReferenceAttachment[]>(() => {
    const source: ITicketReferenceAttachment[] =
      attachments ??
      messages.flatMap((m) =>
        (m.attachments ?? []).map((a) => ({
          ...a,
          message_id: m.message_id,
          uploaded_by: m.author_id,
          created: m.created,
        }))
      );
    const seen = new Set<string>();
    return source.filter((a) => {
      if (seen.has(a.attachment_id)) {
        return false;
      }
      seen.add(a.attachment_id);
      return true;
    });
  }, [attachments, messages]);

  const images = useMemo(
    () => allAttachments.filter((a) => isImage(a.content_type)),
    [allAttachments]
  );
  const files = useMemo(
    () => allAttachments.filter((a) => !isImage(a.content_type)),
    [allAttachments]
  );

  const imageIds = useMemo(() => images.map((a) => a.attachment_id), [images]);
  const urls = useImageUrls(imageIds, fetchAttachmentUrl);

  const [lightbox, setLightbox] = useState<number | null>(null);

  // --- search / filter / sort ------------------------------------------------
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TRefFilter>('all');
  const [sort, setSort] = useState<TRefSort>('newest');

  const query = search.trim().toLowerCase();
  const matchesText = useCallback(
    (...fields: (string | undefined)[]) =>
      !query || fields.some((f) => f?.toLowerCase().includes(query)),
    [query]
  );

  const sortAttachments = useCallback(
    (arr: ITicketReferenceAttachment[]): ITicketReferenceAttachment[] => {
      const next = [...arr];
      switch (sort) {
        case 'oldest':
          return next.sort((a, b) => createdMs(a) - createdMs(b));
        case 'name':
          return next.sort((a, b) => a.filename.localeCompare(b.filename));
        case 'size':
          return next.sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0));
        case 'newest':
        default:
          return next.sort((a, b) => createdMs(b) - createdMs(a));
      }
    },
    [sort]
  );

  // per-family counts feed the filter menu: empty families are dropped, and the
  // surviving ones carry a count badge in their label.
  const counts = useMemo(() => {
    const byCategory: Record<TFileCategory, number> = {
      documents: 0,
      data: 0,
      logs: 0,
      archives: 0,
    };
    for (const f of files) {
      byCategory[fileCategory(f.content_type)] += 1;
    }
    return {
      all: allRefs.length + allAttachments.length,
      links: allRefs.length,
      screenshots: images.length,
      ...byCategory,
    } as Record<TRefFilter, number>;
  }, [files, images.length, allRefs.length, allAttachments.length]);

  // the three sections after search + type filter are applied. References sort by
  // kind then name so like sits with like; "Name" sorts them purely by name.
  const visibleRefs = useMemo(() => {
    if (filter !== 'all' && filter !== 'links') {
      return [] as IResolvedInterfaceReference[];
    }
    return allRefs
      .filter((r) => matchesText(r.interface_name, r.interface_kind))
      .sort((a, b) =>
        sort === 'name'
          ? a.interface_name.localeCompare(b.interface_name)
          : a.interface_kind.localeCompare(b.interface_kind) ||
            a.interface_name.localeCompare(b.interface_name)
      );
  }, [allRefs, filter, matchesText, sort]);

  const visibleImages = useMemo(() => {
    if (filter !== 'all' && filter !== 'screenshots') {
      return [] as ITicketReferenceAttachment[];
    }
    return sortAttachments(images.filter((a) => matchesText(a.filename)));
  }, [images, filter, matchesText, sortAttachments]);

  const visibleFiles = useMemo(() => {
    const fileFilter = FILE_FILTERS.includes(filter as TFileCategory);
    if (filter !== 'all' && !fileFilter) {
      return [] as ITicketReferenceAttachment[];
    }
    let list = files.filter((a) => matchesText(a.filename));
    if (fileFilter) {
      list = list.filter((a) => fileCategory(a.content_type) === filter);
    }
    return sortAttachments(list);
  }, [files, filter, matchesText, sortAttachments]);

  // a filtered-out lightbox target would dangle — close it if its index falls away
  useEffect(() => {
    if (lightbox !== null && lightbox >= visibleImages.length) {
      setLightbox(null);
    }
  }, [visibleImages.length, lightbox]);

  if (loading) {
    return (
      <ReqoreControlGroup fluid horizontalAlign='center' style={{ padding: '32px 0' }}>
        <ReqoreSpinner iconColor='info' size='big'>
          Loading references…
        </ReqoreSpinner>
      </ReqoreControlGroup>
    );
  }

  if (!allRefs.length && !allAttachments.length) {
    return (
      <ReqoreEmptyState
        icon='FolderInfoLine'
        title='No references or files yet'
        description='Interface references and any screenshots, documents, or files attached to this ticket will appear here.'
        flat
        transparent
      />
    );
  }

  // A search + type-filter + sort strip, shown once a ticket carries enough to be
  // worth narrowing (any files, or 3+ linked interfaces). Empty type-families are
  // dropped from the filter menu so it only ever offers what's actually present.
  const showControls = allAttachments.length > 0 || allRefs.length > 2;
  const filterOptions = FILTER_ORDER.filter((key) => key === 'all' || counts[key] > 0);
  const nothingVisible = !visibleRefs.length && !visibleImages.length && !visibleFiles.length;

  const controlBar = showControls ? (
    <Toolbar>
      {/* the bar is a filter over the content, not content itself — at the default
          size the two dropdowns read as primary actions and crowd the search field */}
      <ReqoreControlGroup fluid wrap verticalAlign='center' gapSize='small' size='small'>
      <ReqoreInput
        icon='Search2Line'
        placeholder='Search files and references…'
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        onClearClick={() => setSearch('')}
        minimal
        fluid
      />
      <ReqoreDropdown
        icon={FILTER_META[filter].icon}
        label={FILTER_META[filter].label}
        minimal
        fixed
        flat
        items={filterOptions.map((key) => ({
          selected: filter === key,
          icon: FILTER_META[key].icon,
          label: key === 'all' ? FILTER_META.all.label : `${FILTER_META[key].label} (${counts[key]})`,
          onClick: () => setFilter(key),
        }))}
      />
      <ReqoreDropdown
        icon='ArrowUpDownLine'
        label={SORT_META[sort].label}
        minimal
        fixed
        flat
        items={SORT_ORDER.map((key) => ({
          selected: sort === key,
          icon: SORT_META[key].icon,
          label: SORT_META[key].label,
          onClick: () => setSort(key),
          }))}
        />
      </ReqoreControlGroup>
    </Toolbar>
  ) : null;

  return (
    <ReqoreControlGroup vertical fluid gapSize='big'>
      {controlBar}

      {nothingVisible ? (
        <ReqoreEmptyState
          icon='Search2Line'
          title='No matching references or files'
          description={
            query
              ? `Nothing here matches “${search.trim()}”.`
              : 'Nothing matches the current filter.'
          }
          flat
          transparent
          actions={
            <ReqoreButton
              icon='CloseLine'
              minimal
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
            >
              Clear filters
            </ReqoreButton>
          }
        />
      ) : null}

      {visibleImages.length ? (
        <ReqorePanel
          label='Screenshots'
          icon='ImageLine'
          badge={visibleImages.length}
          flat
          transparent
          size='small'
          labelSize={4}
          collapsible
        >
          <ReqoreColumns columns='auto-fill' minColumnWidth='140px' columnsGap='10px'>
            {visibleImages.map((att, i) => (
              <Screenshot
                key={att.attachment_id}
                att={att}
                url={urls[att.attachment_id]}
                onOpen={() =>
                  urls[att.attachment_id]
                    ? setLightbox(i)
                    : onDownloadAttachment?.(att.attachment_id, att.filename)
                }
                menu={[
                  ...(onDownloadAttachment
                    ? [
                        {
                          label: 'Download',
                          icon: 'DownloadLine' as IReqoreIconName,
                          onClick: () => onDownloadAttachment(att.attachment_id, att.filename),
                        },
                      ]
                    : []),
                  ...showInChatItem(att.message_id),
                ]}
              />
            ))}
          </ReqoreColumns>
        </ReqorePanel>
      ) : null}

      {visibleRefs.length ? (
        <ReqorePanel
          label='Linked interfaces'
          icon='LinksLine'
          badge={visibleRefs.length}
          flat
          transparent
          size='small'
          labelSize={4}
          collapsible
        >
          {/* small rows: a reference list is scanned, so density beats presence —
              the group's size reaches every row (ControlGroup/index.tsx:436) */}
          <ReqoreControlGroup vertical fluid gapSize='small' size='small'>
            {visibleRefs.map((reference) => {
              // an app-triggered qog carries its trigger app's logo; everything else
              // shows its kind glyph — the same vocabulary the reference chips use.
              const image = reference.logo;
              return (
                <ReqoreEntityRow
                  key={
                    reference.reference_id ??
                    `${reference.interface_kind}:${reference.interface_name}`
                  }
                  icon={image ? undefined : resolveIcon(reference.interface_kind)}
                  iconImage={image}
                  label={reference.interface_name}
                  metadata={
                    <ReqoreTextEffect effect={META_EFFECT}>
                      {reference.interface_kind}
                    </ReqoreTextEffect>
                  }
                  flat
                  tooltip={
                    onInterfaceClick
                      ? `Open ${reference.interface_kind} ${reference.interface_name}`
                      : undefined
                  }
                  actions={rowActions(
                    onInterfaceClick
                      ? {
                          icon: 'ArrowRightUpLine',
                          tooltip: 'Open',
                          onClick: () => onInterfaceClick(reference),
                        }
                      : undefined,
                    reference.message_id
                  )}
                />
              );
            })}
          </ReqoreControlGroup>
        </ReqorePanel>
      ) : null}

      {visibleFiles.length ? (
        <ReqorePanel
          label='Files'
          icon='FileList3Line'
          badge={visibleFiles.length}
          flat
          transparent
          size='small'
          labelSize={4}
          collapsible
          actions={
            visibleFiles.length > 1 && onDownloadAttachment
              ? [
                  {
                    icon: 'DownloadCloud2Line',
                    label: 'Download all',
                    onClick: () =>
                      visibleFiles.forEach((f) => onDownloadAttachment(f.attachment_id, f.filename)),
                  },
                ]
              : []
          }
        >
          {/* matches the interface rows above — the two lists read as one surface */}
          <ReqoreControlGroup vertical fluid gapSize='small' size='small'>
            {visibleFiles.map((f) => {
              const type = fileType(f.content_type);
              // a customer's own upload reads "you"; everything else shows the
              // (already server-masked) uploader — "Qorus Support" for staff replies.
              const uploader =
                viewerRole === 'customer' && f.uploader_type === 'customer' ? 'you' : f.uploaded_by;
              const provenance = [
                formatBytes(f.size_bytes),
                uploader ? `added by ${uploader}` : undefined,
                timeAgo(f.created) || undefined,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <ReqoreEntityRow
                  key={f.attachment_id}
                  icon={type.icon}
                  iconColor={type.color}
                  label={f.filename}
                  metadata={<ReqoreTextEffect effect={META_EFFECT}>{provenance}</ReqoreTextEffect>}
                  flat
                  actions={rowActions(
                    onDownloadAttachment
                      ? {
                          icon: 'DownloadLine',
                          tooltip: 'Download',
                          onClick: () => onDownloadAttachment(f.attachment_id, f.filename),
                        }
                      : undefined,
                    f.message_id
                  )}
                />
              );
            })}
          </ReqoreControlGroup>
        </ReqorePanel>
      ) : null}

      {lightbox !== null && fetchAttachmentUrl ? (
        <ImageLightbox
          images={visibleImages}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          fetchAttachmentUrl={fetchAttachmentUrl}
          onDownload={onDownloadAttachment}
        />
      ) : null}
    </ReqoreControlGroup>
  );
};
