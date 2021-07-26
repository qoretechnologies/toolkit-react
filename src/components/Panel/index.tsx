import { preview } from '@reactpreview/types';
import { size } from 'lodash';
import { forwardRef, useMemo, useState } from 'react';
import { useUpdateEffect } from 'react-use';
import styled from 'styled-components';
import { IReqoreIntent, IReqoreTheme } from '../../constants/theme';
import ReqoreThemeProvider from '../../containers/ThemeProvider';
import { changeLightness, getReadableColor } from '../../helpers/colors';
import { useReqoreTheme } from '../../hooks/useTheme';
import { IReqoreIconName } from '../../types/icons';
import ReqoreButton from '../Button';
import ReqoreControlGroup from '../ControlGroup';
import ReqoreDropdown from '../Dropdown';
import { IReqoreDropdownItemProps } from '../Dropdown/item';
import ReqoreIcon from '../Icon';

export interface IReqorePanelAction {
  icon?: IReqoreIconName;
  label?: string;
  onClick?: () => void;
  actions?: IReqoreDropdownItemProps[];
}

export interface IReqorePanelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: any;
  icon?: IReqoreIconName;
  title?: string;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  rounded?: boolean;
  actions?: IReqorePanelAction[];
  customTheme?: IReqoreTheme;
  intent?: IReqoreIntent;
}

export interface IStyledPanel extends IReqorePanelProps {
  theme: IReqoreTheme;
}

export const StyledPanel = styled.div<IStyledPanel>`
  background-color: ${({ theme }: IStyledPanel) => theme.main};
  border-radius: ${({ rounded }) => (rounded ? 5 : 0)}px;
  border: ${({ theme }) => `1px solid ${changeLightness(theme.main, 0.2)}`};
  color: ${({ theme }) => getReadableColor(theme, undefined, undefined, true)};
`;

export const StyledPanelTitle = styled.div<IStyledPanel>`
  display: flex;
  background-color: ${({ theme }: IStyledPanel) =>
    changeLightness(theme.main, 0.07)};
  justify-content: space-between;
  height: 40px;
  align-items: center;
  padding: 0 5px 0 15px;
  border-bottom: ${({ theme, isCollapsed }) =>
    !isCollapsed ? `1px solid ${changeLightness(theme.main, 0.2)}` : null};
`;
export const StyledPanelTitleActions = styled.div``;
export const StyledPanelTitleHeader = styled.div``;

export const ReqorePanel = forwardRef(
  (
    {
      children,
      title,
      collapsible,
      onClose,
      rounded,
      actions = [],
      isCollapsed,
      customTheme,
      icon,
      intent,
      className,
      ...rest
    }: IReqorePanelProps,
    ref
  ) => {
    const [_isCollapsed, setIsCollapsed] = useState(isCollapsed || false);
    const theme = useReqoreTheme('main', customTheme, intent);

    useUpdateEffect(() => {
      setIsCollapsed(isCollapsed);
    }, [isCollapsed]);

    const hasTitleBar: boolean = useMemo(
      () => !!title || collapsible || !!onClose || !!size(actions),
      [title, collapsible, onClose, actions]
    );

    return (
      <ReqoreThemeProvider theme={theme}>
        <StyledPanel
          ref={ref as any}
          rounded={rounded}
          {...rest}
          className={`${className || ''} reqore-panel`}
        >
          {hasTitleBar && (
            <StyledPanelTitle
              isCollapsed={_isCollapsed}
              className='reqore-panel-title'
            >
              <StyledPanelTitleHeader>
                {icon && <ReqoreIcon icon={icon} margin='right' />}
                {title}
              </StyledPanelTitleHeader>
              <ReqoreControlGroup minimal>
                {actions.map(({ label, actions, ...rest }) =>
                  size(actions) ? (
                    <ReqoreDropdown
                      {...rest}
                      label={label}
                      componentProps={{
                        minimal: true,
                      }}
                      items={actions}
                    />
                  ) : (
                    <ReqoreButton {...rest}>{label}</ReqoreButton>
                  )
                )}
                {collapsible && (
                  <ReqoreButton
                    icon={_isCollapsed ? 'ArrowDownSLine' : 'ArrowUpSLine'}
                    onClick={() => setIsCollapsed(!_isCollapsed)}
                    tooltip={_isCollapsed ? 'Expand' : 'Collapse'}
                  />
                )}
                {onClose && <ReqoreButton icon='CloseLine' onClick={onClose} />}
              </ReqoreControlGroup>
            </StyledPanelTitle>
          )}
          {!_isCollapsed && (
            <div className='reqore-panel-content'>{children}</div>
          )}
        </StyledPanel>
      </ReqoreThemeProvider>
    );
  }
);

preview(
  ReqorePanel,
  {
    base: {
      title: 'helloo',
      intent: 'info',
      children: (
        <div style={{ padding: '15px' }}>
          This is a test This is a test This is a test This is a test
        </div>
      ),
    },
    Collapsible: {
      collapsible: true,
    },
    Danger: {
      intent: 'danger',
      collapsible: true,
    },
    Success: {
      rounded: true,
      intent: 'success',
    },
    Warning: {
      intent: 'warning',
    },
    DefaultCollapsed: {
      isCollapsed: true,
    },
  },
  {
    layout: 'tabbed',
  }
);
