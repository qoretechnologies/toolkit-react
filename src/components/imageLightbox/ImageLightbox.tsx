import { ReqoreModal, ReqoreSpan, ReqoreSpinner, useLatestZIndex } from '@qoretechnologies/reqore';
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
}

export const ImageLightbox = ({
  images,
  index,
  onIndex,
  onClose,
  fetchAttachmentUrl,
  onDownload,
}: IImageLightboxProps) => {
  const [zoom, setZoom] = useState<boolean>(false);
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
      onIndex((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndex]
  );

  useEffect(() => {
    if (!multiple) {
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
  }, [step, multiple]);

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
          icon: 'DownloadLine',
          tooltip: 'Download',
          onClick: () => onDownload?.(image.attachment_id, image.filename),
          show: !!onDownload,
        },
      ]}
    >
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
