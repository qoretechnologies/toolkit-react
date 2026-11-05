import { useReqraftLabels } from '../../helpers/reqraftLabels';
import { IReqoreModalProps, ReqoreModal } from '@qoretechnologies/reqore/dist/components/Modal';
import { memo, useCallback, useEffect, useState } from 'react';

export const FocusedEditing = memo(
  ({
    children,
    isFullscreen,
    modalOnly,
    ...rest
  }: IReqoreModalProps & {
    isFullscreen?: boolean;
    /**
     * Render ONLY the modal, not the in-place copy of `children`. For call
     * sites that already render the field themselves and just need the focused
     * overlay on top — e.g. the compact row's inline editor, which lives in the
     * row grid and must stay there. Default (`false`) renders children in place
     * as well, which is what the classic and card layouts wrap themselves in.
     */
    modalOnly?: boolean;
  }) => {
    const compWords = useReqraftLabels().components;
    const [_isFullscreen, setIsFullscreen] = useState(isFullscreen);

    const handleFullscreenToggle = useCallback(() => {
      setIsFullscreen((prev) => !prev);
    }, []);

    useEffect(() => {
      setIsFullscreen(isFullscreen);
    }, [isFullscreen]);

    return (
      <>
        {_isFullscreen && (
          <ReqoreModal
            label={compWords.focusedEditing}
            icon='FullscreenFill'
            blur={15}
            customTheme={{ main: '#111111' }}
            isOpen
            onClose={handleFullscreenToggle}
            {...rest}
          >
            {children}
          </ReqoreModal>
        )}
        {modalOnly ? null : children}
      </>
    );
  }
);
