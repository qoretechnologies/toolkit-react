import { ReqoreControlGroup, ReqoreInput, ReqoreTag } from '@qoretechnologies/reqore';
import { useEffect, useState } from 'react';
import { ImageLightbox } from '../imageLightbox';

/*
 * Renders the files staged on a ticket composer as removable chips. Image files — whether
 * uploaded, pasted, or captured as a screenshot — show a thumbnail and open the shared
 * `ImageLightbox` on click (paging across the staged images, click-to-zoom); everything else
 * shows a paperclip + filename. When `onRename` is given, a pencil turns the chip into an
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

export const AttachmentChips = ({ files, onRemove, onRename, disabled }: IAttachmentChipsProps) => {
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  // index into the image subset that's open in the lightbox, or null when closed.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // the file index currently being renamed inline, plus its working name.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState<string>('');

  useEffect(() => {
    const urls = files.map((file) =>
      file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    );
    setThumbnails(urls);
    return () => urls.forEach((url) => url && URL.revokeObjectURL(url));
  }, [files]);

  if (!files.length) {
    return null;
  }

  // The staged images in order, each with its original file index + object URL — the set the
  // lightbox pages across. Non-image files are skipped.
  const imageEntries = files
    .map((file, index) => ({ file, index, url: thumbnails[index] }))
    .filter((entry) => entry.url);

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

  return (
    <>
      <ReqoreControlGroup wrap gapSize='small' verticalAlign='center'>
        {files.map((file, index) => {
          if (editingIndex === index) {
            return (
              <ReqoreInput
                key={`edit-${index}`}
                value={draftName}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setDraftName(event.target.value)
                }
                onBlur={commitRename}
                onKeyDown={(event: React.KeyboardEvent) => {
                  if (event.key === 'Enter') {
                    commitRename();
                  } else if (event.key === 'Escape') {
                    setEditingIndex(null);
                  }
                }}
                size='small'
                fixed
                autoFocus
              />
            );
          }

          const thumbnail = thumbnails[index];
          const imageIndex = thumbnail
            ? imageEntries.findIndex((entry) => entry.index === index)
            : -1;
          const actions =
            onRename && !disabled
              ? [
                  {
                    icon: 'Edit2Line' as const,
                    tooltip: 'Rename',
                    onClick: (event: React.MouseEvent<HTMLDivElement>) => {
                      event.stopPropagation();
                      startRename(index);
                    },
                  },
                ]
              : undefined;
          return (
            <ReqoreTag
              key={`${file.name}-${index}`}
              icon={thumbnail ? undefined : 'AttachmentLine'}
              leftIconProps={thumbnail ? { image: thumbnail } : undefined}
              label={file.name}
              size='small'
              tooltip={thumbnail ? 'Click to preview' : undefined}
              actions={actions}
              onClick={thumbnail ? () => setPreviewIndex(imageIndex) : undefined}
              onRemoveClick={disabled ? undefined : () => onRemove(index)}
            />
          );
        })}
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
