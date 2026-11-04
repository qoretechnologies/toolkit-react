import { ReqoreModal } from '@qoretechnologies/reqore';
import {
  IReqorePanelAction,
  IReqorePanelProps,
} from '@qoretechnologies/reqore/dist/components/Panel';
import { rgba } from 'polished';
import { useCallback, useState } from 'react';
import styled, { css } from 'styled-components';

// The item's own flags style it as transient props (`$`): styled-components keeps those, so an item drawn
// `as` a panel never hands them on.
export const StyledExpressionItem: React.FC<
  IReqorePanelProps & { $isChild?: boolean; $isAndOr?: boolean; $index?: number }
> = styled.div`
  position: relative;
  overflow: unset;

  ${({ $isChild: isChild, $isAndOr: isAndOr, $index: index }) =>
    isChild &&
    css`
      &::before {
        content: '';
        position: absolute;
        ${index === 0 ? 'top' : 'bottom'}: ${isAndOr ? '50%' : '11px'};
        left: -10px;
        width: 10px;
        height: 1px;
        background-color: ${() => rgba('#fff', 0.3)};
      }
    `}
`;

export interface IExpressionItemProps extends IReqorePanelProps {
  isChild?: boolean;
  isAndOr?: boolean;
  index?: number;
  readOnly?: boolean;
}

export const ExpressionItem = ({
  isChild,
  isAndOr,
  index,
  readOnly,
  ...props
}: IExpressionItemProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const renderContent = (focused?: boolean) => {
    return (
      <StyledExpressionItem
        collapsible
        responsiveActions={false}
        responsiveTitle={false}
        collapseButtonProps={{ size: 'tiny' }}
        {...props}
        $isChild={isChild}
        $isAndOr={isAndOr}
        $index={index}
        actions={[
          {
            show: focused || readOnly ? false : 'hover',
            icon: 'FullscreenLine',
            tooltip: 'Focused Editing',
            className: 'expression-item-fullscreen',
            size: 'tiny',
            onClick: handleFullscreenToggle,
          },
          ...(props.actions || []).map(
            (action): IReqorePanelAction => ({ ...action, size: 'tiny' })
          ),
        ]}
      >
        {props.children}
      </StyledExpressionItem>
    );
  };

  return (
    <>
      {isFullscreen && (
        <ReqoreModal
          isOpen
          label='Focused Editing'
          icon='FullscreenFill'
          blur={15}
          customTheme={{ main: '#111111' }}
          onClose={handleFullscreenToggle}
          responsiveTitle={false}
          responsiveActions={false}
        >
          {renderContent(true)}
        </ReqoreModal>
      )}
      {renderContent()}
    </>
  );
};
