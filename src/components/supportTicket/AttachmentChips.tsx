import { ReqoreControlGroup, ReqoreTag } from '@qoretechnologies/reqore';
import { useEffect, useState } from 'react';

/*
 * Renders the files staged on a ticket composer as removable chips. Image files —
 * whether uploaded, pasted, or captured as a screenshot — show a thumbnail;
 * everything else shows a paperclip + filename. Thumbnail object URLs are created
 * here and revoked when the file set changes or the component unmounts. Renders
 * nothing when there are no staged files.
 */

export interface IAttachmentChipsProps {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export const AttachmentChips = ({ files, onRemove, disabled }: IAttachmentChipsProps) => {
  const [thumbnails, setThumbnails] = useState<string[]>([]);

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

  return (
    <ReqoreControlGroup wrap gapSize='small' verticalAlign='center'>
      {files.map((file, index) => {
        const thumbnail = thumbnails[index];
        return (
          <ReqoreTag
            key={`${file.name}-${index}`}
            icon={thumbnail ? undefined : 'AttachmentLine'}
            leftIconProps={thumbnail ? { image: thumbnail } : undefined}
            label={file.name}
            size='small'
            onRemoveClick={disabled ? undefined : () => onRemove(index)}
          />
        );
      })}
    </ReqoreControlGroup>
  );
};
