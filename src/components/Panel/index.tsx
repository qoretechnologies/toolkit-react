import { size } from 'lodash';
import { rgba } from 'polished';
import { forwardRef, ReactElement, useCallback, useMemo, useState } from 'react';
import { useUpdateEffect } from 'react-use';
import styled, { css } from 'styled-components';
import { RADIUS_FROM_SIZE } from '../../constants/sizes';
import { IReqoreTheme } from '../../constants/theme';
import ReqoreThemeProvider from '../../containers/ThemeProvider';
import {
  changeDarkness,
  changeLightness,
  getMainBackgroundColor,
  getReadableColor,
} from '../../helpers/colors';
import { useCombinedRefs } from '../../hooks/useCombinedRefs';
import { useReqoreTheme } from '../../hooks/useTheme';
import { useTooltip } from '../../hooks/useTooltip';
import {
  IReqoreIntent,
  IWithReqoreCustomTheme,
  IWithReqoreFlat,
  IWithReqoreSize,
  IWithReqoreTooltip,
} from '../../types/global';
import { IReqoreIconName } from '../../types/icons';
import ReqoreButton, { IReqoreButtonProps } from '../Button';
import { StyledCollectionItemContent } from '../Collection/item';
import ReqoreControlGroup from '../ControlGroup';
import ReqoreDropdown from '../Dropdown';
import { IReqoreDropdownItemProps } from '../Dropdown/item';
import ReqoreIcon from '../Icon';

export interface IReqorePanelAction extends IReqoreButtonProps, IWithReqoreTooltip, IReqoreIntent {
  label?: string | number;
  onClick?: () => void;
  actions?: IReqoreDropdownItemProps[];
  customContent?: () => string | React.ReactNode;
}

export interface IReqorePanelBottomAction extends IReqorePanelAction {
  position: 'left' | 'right';
}

export interface IReqorePanelContent {}

export interface IReqorePanelProps
  extends IWithReqoreSize,
    IWithReqoreCustomTheme,
    IWithReqoreFlat,
    IReqoreIntent,
    IWithReqoreTooltip,
    React.HTMLAttributes<HTMLDivElement> {
  as?: any;
  children?: any;
  icon?: IReqoreIconName;
  label?: string | ReactElement<any>;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  rounded?: boolean;
  actions?: (IReqorePanelAction | IReqorePanelAction[])[];
  bottomActions?: IReqorePanelBottomAction[];
  unMountContentOnCollapse?: boolean;
  onCollapseChange?: (isCollapsed?: boolean) => void;
  fill?: boolean;
  padded?: boolean;
  contentStyle?: React.CSSProperties;
  opacity?: number;
  blur?: number;
  minimal?: boolean;
  headerSize?: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface IStyledPanel extends IReqorePanelProps {
  theme: IReqoreTheme;
}

export const StyledPanel = styled.div<IStyledPanel>`
  background-color: ${({ theme, opacity = 1 }: IStyledPanel) =>
    rgba(changeDarkness(getMainBackgroundColor(theme), 0.03), opacity)};
  border-radius: ${({ rounded }) => (rounded ? RADIUS_FROM_SIZE.normal : 0)}px;
  border: ${({ theme, flat, opacity = 1 }) =>
    flat
      ? undefined
      : `1px solid ${rgba(changeLightness(getMainBackgroundColor(theme), 0.2), opacity)}`};
  color: ${({ theme }) => getReadableColor(theme, undefined, undefined, true)};
  overflow: hidden;
  display: flex;
  flex-flow: column;
  position: relative;
  z-index: 1;
  backdrop-filter: ${({ blur, opacity }) => (blur && opacity < 1 ? `blur(${blur}px)` : undefined)};
  transition: 0.3s ease-in-out;

  ${({ interactive, theme, opacity = 1 }) =>
    interactive
      ? css`
          cursor: pointer;

          &:hover {
            background-color: ${rgba(changeDarkness(getMainBackgroundColor(theme), 0.06), opacity)};

            ${StyledCollectionItemContent}:after {
              background: linear-gradient(
                to top,
                ${rgba(changeDarkness(getMainBackgroundColor(theme), 0.06), opacity)} 0%,
                transparent 100%
              );
            }
          }
        `
      : undefined}

  ${({ fill, isCollapsed }) =>
    !isCollapsed && fill
      ? css`
          height: 100%;
          flex: 1;
        `
      : undefined}
`;

export const StyledPanelTitle = styled.div<IStyledPanel>`
  display: flex;
  background-color: ${({ theme, opacity = 1 }: IStyledPanel) =>
    rgba(changeLightness(getMainBackgroundColor(theme), 0.07), opacity)};
  justify-content: space-between;
  height: 40px;
  align-items: center;
  padding: 0 5px 0 15px;
  border-bottom: ${({ theme, isCollapsed, flat, opacity = 1 }) =>
    !isCollapsed && !flat
      ? `1px solid ${rgba(changeLightness(getMainBackgroundColor(theme), 0.2), opacity)}`
      : null};
  transition: background-color 0.2s ease-out;
  overflow: hidden;
  flex: 0 0 auto;

  ${({ collapsible }) =>
    collapsible &&
    css`
      cursor: pointer;
      &:hover {
        background-color: ${({ theme, opacity = 1 }: IStyledPanel) =>
          rgba(changeLightness(getMainBackgroundColor(theme), 0.1), opacity)};
      }
    `}
`;

export const StyledPanelBottomActions = styled(StyledPanelTitle)`
  padding-left: 5px;
  border-bottom: 0;
  border-top: ${({ theme, flat, opacity = 1 }) =>
    !flat
      ? `1px solid ${rgba(changeLightness(getMainBackgroundColor(theme), 0.2), opacity)}`
      : null};
`;

export const StyledPanelContent = styled.div<IStyledPanel>`
  display: ${({ isCollapsed }) => (isCollapsed ? 'none' : undefined)};
  min-height: ${({ isCollapsed }) => (isCollapsed ? undefined : '40px')};
  padding: ${({ padded }) => (!padded ? undefined : '15px')};
  // The padding is not needed when the panel is minimal and has title, since
  // the title already has padding and is transparent
  padding-top: ${({ minimal, hasLabel }) => (minimal && hasLabel ? '0px' : undefined)};
  flex: 1;
  overflow: auto;
`;

export const StyledPanelTitleLabel = styled.span`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  margin: 0;
`;

export const StyledPanelTitleHeader = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  padding-right: 5px;

  ${StyledPanelTitleLabel} {
    font-weight: 600;
  }
`;

export const ReqorePanel = forwardRef(
  (
    {
      children,
      label,
      collapsible,
      onClose,
      rounded = true,
      actions = [],
      bottomActions = [],
      isCollapsed,
      customTheme,
      icon,
      intent,
      className,
      flat,
      unMountContentOnCollapse = true,
      onCollapseChange,
      padded = true,
      contentStyle,
      headerSize = 4,
      minimal,
      tooltip,
      ...rest
    }: IReqorePanelProps,
    ref
  ) => {
    const [_isCollapsed, setIsCollapsed] = useState(isCollapsed || false);
    const theme = useReqoreTheme('main', customTheme, intent);
    const { targetRef } = useCombinedRefs(ref);

    useTooltip(targetRef.current, tooltip);

    useUpdateEffect(() => {
      setIsCollapsed(!!isCollapsed);
    }, [isCollapsed]);

    const hasTitleBar: boolean = useMemo(
      () => !!label || collapsible || !!onClose || !!size(actions),
      [label, collapsible, onClose, actions]
    );

    const handleCollapseClick = useCallback(() => {
      if (collapsible) {
        setIsCollapsed(!_isCollapsed);
        onCollapseChange?.(!_isCollapsed);
      }
    }, [collapsible, _isCollapsed, onCollapseChange]);

    const leftBottomActions: IReqorePanelBottomAction[] = useMemo(
      () => bottomActions.filter(({ position }) => position === 'left'),
      [bottomActions]
    );

    const rightBottomActions: IReqorePanelBottomAction[] = useMemo(
      () => bottomActions.filter(({ position }) => position === 'right'),
      [bottomActions]
    );

    const hasBottomActions: boolean = useMemo(
      () => !!(size(leftBottomActions) || size(rightBottomActions)),
      [leftBottomActions, rightBottomActions]
    );

    const renderActions = (
      actionOrActions: IReqorePanelAction | IReqorePanelAction[],
      index: number
    ) => {
      if (Array.isArray(actionOrActions)) {
        return (
          <ReqoreControlGroup stack minimal>
            {actionOrActions.map(renderActions)}
          </ReqoreControlGroup>
        );
      }

      const { id, actions, label, intent, className, customContent, ...rest }: IReqorePanelAction =
        actionOrActions;

      if (size(actions)) {
        return (
          <ReqoreDropdown
            {...rest}
            key={index}
            label={label}
            componentProps={{
              intent,
              id,
              minimal: true,
              className,
              onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
              },
            }}
            items={actions}
          />
        );
      }

      if (customContent) {
        return customContent();
      }

      return (
        <ReqoreButton
          {...rest}
          id={id}
          key={index}
          className={className}
          customTheme={theme}
          intent={intent}
          onClick={
            rest.onClick
              ? (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  rest.onClick?.();
                }
              : undefined
          }
        >
          {label}
        </ReqoreButton>
      );
    };

    const HTMLheaderElement = useMemo(() => {
      return `h${headerSize}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    }, [headerSize]);

    const interactive: boolean = !!(
      rest.onClick ||
      rest.onMouseOver ||
      rest.onMouseEnter ||
      rest.onDoubleClick ||
      rest.onContextMenu
    );

    return (
      <ReqoreThemeProvider theme={theme}>
        <StyledPanel
          {...rest}
          as={rest.as || 'div'}
          ref={targetRef}
          isCollapsed={_isCollapsed}
          rounded={rounded}
          flat={flat}
          className={`${className || ''} reqore-panel`}
          interactive={interactive}
        >
          {hasTitleBar && (
            <StyledPanelTitle
              flat={flat}
              isCollapsed={_isCollapsed}
              collapsible={collapsible}
              className='reqore-panel-title'
              onClick={handleCollapseClick}
              theme={theme}
              opacity={rest.opacity ?? (minimal ? 0 : 1)}
            >
              <StyledPanelTitleHeader>
                {icon && <ReqoreIcon icon={icon} margin='right' />}
                {typeof label === 'string' ? (
                  <StyledPanelTitleLabel as={HTMLheaderElement}>{label}</StyledPanelTitleLabel>
                ) : (
                  label
                )}
              </StyledPanelTitleHeader>
              <ReqoreControlGroup minimal>
                {actions.map(renderActions)}
                {collapsible && (
                  <ReqoreButton
                    customTheme={theme}
                    icon={_isCollapsed ? 'ArrowDownSLine' : 'ArrowUpSLine'}
                    onClick={handleCollapseClick}
                    tooltip={_isCollapsed ? 'Expand' : 'Collapse'}
                  />
                )}
                {onClose && (
                  <ReqoreButton
                    customTheme={theme}
                    icon='CloseLine'
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      onClose?.();
                    }}
                  />
                )}
              </ReqoreControlGroup>
            </StyledPanelTitle>
          )}
          {!_isCollapsed || (_isCollapsed && !unMountContentOnCollapse) ? (
            <StyledPanelContent
              className='reqore-panel-content'
              hasLabel={!!label}
              isCollapsed={_isCollapsed}
              style={contentStyle}
              padded={padded}
              minimal={minimal}
            >
              {children}
            </StyledPanelContent>
          ) : null}
          {hasBottomActions && !_isCollapsed ? (
            <StyledPanelBottomActions
              flat={flat}
              className='reqore-panel-bottom-actions'
              theme={theme}
              opacity={rest.opacity ?? (minimal ? 0 : 1)}
            >
              <ReqoreControlGroup minimal>
                {leftBottomActions.map(renderActions)}
              </ReqoreControlGroup>
              <ReqoreControlGroup minimal>
                {rightBottomActions.map(renderActions)}
              </ReqoreControlGroup>
            </StyledPanelBottomActions>
          ) : null}
        </StyledPanel>
      </ReqoreThemeProvider>
    );
  }
);
