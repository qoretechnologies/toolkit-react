import React from 'react';
import styled, { css } from 'styled-components';
import { IReqoreTheme } from '../../constants/theme';
import ReqoreThemeProvider from '../../containers/ThemeProvider';
import { changeLightness, getReadableColor } from '../../helpers/colors';

export interface IReqoreLayoutWrapperProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: any;
  withSidebar?: boolean;
}

const StyledReqoreLayoutWrapper = styled.div<{
  withSidebar: boolean;
  theme: IReqoreTheme;
}>`
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;

  ${({ withSidebar, theme }) => css`
    flex-flow: ${withSidebar ? 'row' : 'column'};
    background-color: ${changeLightness(theme.main, 0.05)};
    color: ${getReadableColor(theme.main, undefined, undefined, true)};
  `}
`;

const ReqoreLayoutWrapper = ({
  withSidebar,
  children,
  className,
  ...rest
}: IReqoreLayoutWrapperProps) => (
  <ReqoreThemeProvider>
    <StyledReqoreLayoutWrapper
      {...rest}
      className={`${className || ''} reqore-layout-wrapper`}
      withSidebar={withSidebar}
    >
      {children}
    </StyledReqoreLayoutWrapper>
  </ReqoreThemeProvider>
);

export default ReqoreLayoutWrapper;
