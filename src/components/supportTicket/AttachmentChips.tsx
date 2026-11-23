import { ReqoreControlGroup, ReqoreInput, ReqoreTag, useReqoreTheme } from '@qoretechnologies/reqore';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { rgba } from 'polished';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useReqraftLabels } from '../../helpers/reqraftLabels';
import { ImageLightbox } from '../imageLightbox';

/*
 * Renders the files staged on a ticket composer. An image — uploaded, pasted, or captured as a
 * screenshot — is a small thumbnail card with its name under the picture, and opens the shared
 * `ImageLightbox` on click (paging across the staged images, click-to-zoom); every other file is a
 * removable chip with a paperclip and its name. The cards take a row of their own above the chips: a
 * card is several times a chip's height, and mixed in one wrapping row the chips would wrap raggedly
 * around it (as a message's attachments in the thread are laid out). When `onRename` is given, a pencil turns the chip into an
 * inline input so a captured `screenshot-<timestamp>.png` can be given a meaningful name (a
 * File's name is read-only, so the host swaps in a renamed copy).
 *
 * The thumbnail object URLs ARE the full-image URLs the lightbox shows, so they're created
 * once here and revoked when the file set changes or on unmount. Renders nothing when empty.
 */

export interface IAttachmentChipsProps {
  files: File[];
  onRemove: (index: number) => void;
  /** Rename a staged file. Omit to make chips non-renamable. The host replaces the File with a
   *  renamed copy (`new File([file], newName, { type: file.type })`). */
  onRename?: (index: number, newName: string) => void;
  disabled?: boolean;
}

const isImageFile = (file: File) => file.type.startsWith('image/');

/** A staged image: the picture over its name, in a small card with the quiet edge every card has. */
const StyledImageCard = styled.div<{ $edge: string; $wash: string }>`
  display: flex;
  flex-direction: column;
  width: 160px;
  border: 1px solid ${({ $edge }) => $edge};
  border-radius: 8px;
  overflow: hidden;
  background: ${({ $wash }) => $wash};
`;

const StyledImageCardThumb = styled.button<{ $wash: string; $ring: string }>`
  appearance: none;
  display: block;
  width: 100%;
  height: 96px;
  margin: 0;
  padding: 0;
  border: 0;
  background: ${({ $wash }) => $wash};
  cursor: zoom-in;
  line-height: 0;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:focus-visible {
    outline: 2px solid ${({ $ring }) => $ring};
    outline-offset: -2px;
  }
`;

export const AttachmentChips = ({ files, onRemove, onRename, disabled }: IAttachmentChipsProps) => {
  const words = useReqraftLabels().supportTicket;
  const theme = useReqoreTheme();
  const readable = getReadableColor(theme);
  const edge = rgba(readable, 0.12);
  const wash = rgba(readable, 0.04);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  // index into the image subset that's open in the lightbox, or null when closed.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // the file index currently being renamed inline, plus its working name.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  /* Whether the input's blur closes it without committing: Escape cancels. Enter and Escape let go of the focus
     while the input is still on the page, and the blur closes it - taken off the page with the focus, it lost
     the focus in the middle of React's work, and its blur committed then: Enter committed twice, and Escape
     committed what was typed. */
  const cancelRename = useRef(false);

  useEffect(() => {
    const urls = files.map((file) => (isImageFile(file) ? URL.createObjectURL(file) : ''));
    setThumbnails(urls);
    return () => urls.forEach((url) => url && URL.revokeObjectURL(url));
  }, [files]);

  if (!files.length) {
    return null;
  }

  // The staged images in order, each with its original file index + object URL — the set the
  // lightbox pages across. Non-image files are skipped. Told by the file's type, so an image is a card
  // from its first frame, before its object URL exists.
  const imageEntries = files
    .map((file, index) => ({ file, index, url: thumbnails[index] }))
    .filter((entry) => isImageFile(entry.file));

  const startRename = (index: number) => {
    setDraftName(files[index].name);
    setEditingIndex(index);
  };
  const commitRename = () => {
    if (editingIndex === null) {
      return;
    }
    const name = draftName.trim();
    if (onRename && name && name !== files[editingIndex].name) {
      onRename(editingIndex, name);
    }
    setEditingIndex(null);
  };

  const renameInput = (index: number, fluid?: boolean) => (
    <ReqoreInput
      key={`edit-${index}`}
      value={draftName}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDraftName(event.target.value)}
      onBlur={() => {
        if (cancelRename.current) {
          cancelRename.current = false;
          setEditingIndex(null);
          return;
        }
        commitRename();
      }}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          cancelRename.current = event.key === 'Escape';
          (event.target as HTMLElement).blur();
        }
      }}
      size='small'
      fixed={!fluid}
      fluid={fluid}
      autoFocus
    />
  );

  const actionsFor = (index: number) =>
    onRename && !disabled
      ? [
          {
            icon: 'Edit2Line' as const,
            tooltip: words.rename,
            onClick: (event: React.MouseEvent<HTMLDivElement>) => {
              event.stopPropagation();
              startRename(index);
            },
          },
        ]
      : undefined;

  const otherFiles = files
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => !isImageFile(file));

  return (
    <>
      <ReqoreControlGroup vertical gapSize='small'>
        {imageEntries.length ? (
          <ReqoreControlGroup wrap gapSize='small' verticalAlign='flex-start'>
            {imageEntries.map(({ file, index, url }, imageIndex) => (
              <StyledImageCard
                key={`${file.name}-${index}`}
                className='attachment-image-card'
                $edge={edge}
                $wash={wash}
              >
                <StyledImageCardThumb
                  type='button'
                  className='attachment-image-card-thumb'
                  title={words.clickToPreview}
                  aria-label={`${words.clickToPreview}: ${file.name}`}
                  onClick={() => setPreviewIndex(imageIndex)}
                  $wash={wash}
                  $ring={readable}
                >
                  {url ? <img src={url} alt={file.name} /> : null}
                </StyledImageCardThumb>
                {editingIndex === index ? (
                  renameInput(index, true)
                ) : (
                  <ReqoreTag
                    label={file.name}
                    size='small'
                    appearance='text'
                    // capped, so a long name is cut in the middle and keeps its extension; a tag with a width
                    // wraps instead. The card's column stretches it to the card's width.
                    maxWidth='100%'
                    truncate='middle'
                    labelAlign='left'
                    actions={actionsFor(index)}
                    onClick={() => setPreviewIndex(imageIndex)}
                    onRemoveClick={disabled ? undefined : () => onRemove(index)}
                  />
                )}
              </StyledImageCard>
            ))}
          </ReqoreControlGroup>
        ) : null}
        {otherFiles.length ? (
          <ReqoreControlGroup wrap gapSize='small' verticalAlign='center'>
            {otherFiles.map(({ file, index }) =>
              editingIndex === index ? (
                renameInput(index)
              ) : (
                <ReqoreTag
                  key={`${file.name}-${index}`}
                  icon='AttachmentLine'
                  label={file.name}
                  size='small'
                  actions={actionsFor(index)}
                  onRemoveClick={disabled ? undefined : () => onRemove(index)}
                />
              )
            )}
          </ReqoreControlGroup>
        ) : null}
      </ReqoreControlGroup>
      {previewIndex !== null && imageEntries[previewIndex] ? (
        <ImageLightbox
          images={imageEntries.map((entry) => ({
            attachment_id: String(entry.index),
            filename: entry.file.name,
          }))}
          index={previewIndex}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          fetchAttachmentUrl={async (id) =>
            imageEntries.find((entry) => String(entry.index) === id)?.url ?? ''
          }
          // the lightbox ids ARE the stringified file indices, so renaming from the
          // preview funnels into the same host callback as the chip pencil
          onRename={
            onRename && !disabled ? (id, name) => onRename(Number(id), name) : undefined
          }
        />
      ) : null}
    </>
  );
};
