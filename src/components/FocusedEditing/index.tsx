import { IReqoreModalProps, ReqoreModal } from '@qoretechnologies/reqore/dist/components/Modal';
import { memo, useCallback, useEffect, useState } from 'react';

export const FocusedEditing = memo(
  ({ children, isFullscreen, ...rest }: IReqoreModalProps & { isFullscreen?: boolean }) => {
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
            label='Focused Editing'
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
        {children}
      </>
    );
  }
);
