import {
  ReqoreInput,
  ReqoreModal,
  ReqoreSpan,
  ReqoreSpinner,
  useLatestZIndex,
} from '@qoretechnologies/reqore';
import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

/*
 * The shared full-image viewer: a `ReqoreModal` holding one image at a time, with
 * click-to-zoom, keyboard/arrow paging across a set, and a download action. Both the
 * ticket thread (an image attachment on a message) and the References tab (the ticket's
 * screenshot grid) open this, so there is one lightbox rather than a Modal-backed one
 * here and a hand-rolled overlay there.
 *
 * reqore has no image-viewer primitive, so the zoom stage below is bespoke — but the
 * shell, backdrop, focus trap, Esc-to-close and header/actions are all `ReqoreModal`.
 * When reqore gains a real viewer this collapses onto it. It fetches the shown image's
 * bytes itself (caching per id), so a consumer only has to hand it `fetchAttachmentUrl`.
 */

// Compact rename row above the stage while editing — the modal's `label` slot is
// string-only, so the input can't live in the header itself.
const RenameRow = styled.div`
  margin-bottom: 8px;
`;

const Stage = styled.div<{ $zoom: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  max-height: 74vh;
  overflow: auto;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;

  img {
    display: block;
    cursor: ${({ $zoom }) => ($zoom ? 'zoom-out' : 'zoom-in')};
    ${({ $zoom }) =>
      $zoom
        ? 'max-width: none; max-height: none;'
        : 'max-width: 100%; max-height: 74vh; object-fit: contain;'}
  }
`;

export interface IImageLightboxImage {
  attachment_id: string;
  filename: string;
}

export interface IImageLightboxProps {
  /** the set the viewer pages across — one image is a set of one (no paging chrome) */
  images: IImageLightboxImage[];
  /** which image is shown */
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** resolve an image's bytes as an object URL (the consumer's authed endpoint) */
  fetchAttachmentUrl: (attachmentId: string) => Promise<string>;
  onDownload?: (attachmentId: string, filename: string) => void;
  /** Rename the shown image. Presence of the callback IS the permission — a staged
   *  (composer) set passes it, server-side attachment sets simply don't, so the
   *  thread / References viewers stay rename-free without any extra flag. */
  onRename?: (attachmentId: string, newName: string) => void;
}

export const ImageLightbox = ({
  images,
  index,
  onIndex,
  onClose,
  fetchAttachmentUrl,
  onDownload,
  onRename,
}: IImageLightboxProps) => {
  const [zoom, setZoom] = useState<boolean>(false);
  // inline rename state: editing toggles the input row; draftName is the working value
  const [editing, setEditing] = useState<boolean>(false);
  const [draftName, setDraftName] = useState<string>('');
  // url per attachment: undefined = not fetched, null = fetch failed, string = ready
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const requested = useRef<Set<string>>(new Set());
  // Render above everything currently on screen: the ticket composer that can open this
  // lightbox floats at its own climbed z-index (also useLatestZIndex), so a modal on a fixed
  // z-index ends up BEHIND it. Climbing past the current top keeps the viewer on top wherever
  // it's opened from.
  const zIndex = useLatestZIndex();

  const image = images[index];
  const id = image?.attachment_id;
  const url = id ? urls[id] : undefined;
  const multiple = images.length > 1;

  // Keep the latest fetcher in a ref so the fetch effect can depend on `id` ALONE.
  // Consumers routinely pass `fetchAttachmentUrl` as an inline arrow — a new identity
  // every render. If the effect depended on it, each parent re-render would re-run the
  // effect: the previous run's cleanup fired first, so its in-flight fetch resolved with
  // nothing to write to, and because `requested` already held the id nothing re-fetched.
  // Net result: the spinner hung forever. Depending on `id` only breaks that cycle.
  const fetchRef = useRef(fetchAttachmentUrl);
  fetchRef.current = fetchAttachmentUrl;
  // True only while mounted: a fetch that resolves after unmount is dropped, but one that
  // resolves after a benign re-render still caches — the distinction a per-run flag missed.
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // fetch the shown image's bytes once per id; `requested` guards against re-fetching a
  // page you've already visited
  useEffect(() => {
    if (!id || requested.current.has(id)) {
      return undefined;
    }
    requested.current.add(id);
    fetchRef.current(id)
      .then((resolved) => mounted.current && setUrls((current) => ({ ...current, [id]: resolved })))
      .catch(() => mounted.current && setUrls((current) => ({ ...current, [id]: null })));
    return undefined;
  }, [id]);

  const step = useCallback(
    (delta: number) => {
      setZoom(false);
      // paging abandons an in-flight rename — the draft belonged to the image left behind
      setEditing(false);
      onIndex((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndex]
  );

  useEffect(() => {
    if (!multiple || editing) {
      // while renaming, arrow keys belong to the text input, not the pager
      return undefined;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        step(1);
      } else if (event.key === 'ArrowLeft') {
        step(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, multiple, editing]);

  const startRename = useCallback(() => {
    setDraftName(images[index]?.filename ?? '');
    setEditing(true);
  }, [images, index]);

  const commitRename = useCallback(() => {
    const current = images[index];
    const name = draftName.trim();
    if (onRename && current && name && name !== current.filename) {
      onRename(current.attachment_id, name);
    }
    setEditing(false);
  }, [draftName, images, index, onRename]);

  if (!image) {
    return null;
  }

  return (
    <ReqoreModal
      isOpen
      onClose={onClose}
      customZIndex={zIndex}
      blur={3}
      icon='ImageLine'
      label={image.filename}
      badge={multiple ? `${index + 1} / ${images.length}` : undefined}
      actions={[
        { icon: 'ArrowLeftSLine', tooltip: 'Previous', onClick: () => step(-1), show: multiple },
        { icon: 'ArrowRightSLine', tooltip: 'Next', onClick: () => step(1), show: multiple },
        {
          icon: 'Edit2Line',
          tooltip: 'Rename',
          className: 'imagelightbox-rename',
          onClick: startRename,
          show: !!onRename && !editing,
        },
        {
          icon: 'DownloadLine',
          tooltip: 'Download',
          onClick: () => onDownload?.(image.attachment_id, image.filename),
          show: !!onDownload,
        },
      ]}
    >
      {editing ? (
        <RenameRow>
          <ReqoreInput
            value={draftName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setDraftName(event.target.value)
            }
            onBlur={commitRename}
            onKeyDown={(event: React.KeyboardEvent) => {
              if (event.key === 'Enter') {
                commitRename();
              } else if (event.key === 'Escape') {
                // cancel the edit only — don't let the modal's own Esc-to-close see it
                event.stopPropagation();
                setEditing(false);
              }
            }}
            size='small'
            fluid
            autoFocus
          />
        </RenameRow>
      ) : null}
      <Stage $zoom={zoom}>
        {url ? (
          <img src={url} alt={image.filename} onClick={() => setZoom((z) => !z)} />
        ) : url === null ? (
          <ReqoreSpan effect={{ opacity: 0.6 }}>Preview unavailable — use Download.</ReqoreSpan>
        ) : (
          <ReqoreSpinner iconColor='info' size='big'>
            Loading…
          </ReqoreSpinner>
        )}
      </Stage>
    </ReqoreModal>
  );
};
