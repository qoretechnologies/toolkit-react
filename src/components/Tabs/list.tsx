import { isArray } from 'lodash';
import React from 'react';
import { useMeasure } from 'react-use';
import styled, { css } from 'styled-components';
import { IReqoreTabsListItem, IReqoreTabsProps } from '.';
import { ReqorePopover } from '../..';
import {
  ICON_FROM_SIZE,
  PADDING_FROM_SIZE,
  TABS_PADDING_TO_PX,
  TEXT_FROM_SIZE,
  TSizes,
} from '../../constants/sizes';
import { IReqoreBreadcrumbsTheme, IReqoreCustomTheme, IReqoreTheme } from '../../constants/theme';
import ReqoreThemeProvider from '../../containers/ThemeProvider';
import {
  changeLightness,
  getColorFromMaybeString,
  getNthGradientColor,
} from '../../helpers/colors';
import { calculateStringSizeInPixels } from '../../helpers/utils';
import { useReqoreTheme } from '../../hooks/useTheme';
import { TReqoreHexColor } from '../Effect';
import ReqoreMenu from '../Menu';
import ReqoreMenuItem, { IReqoreMenuItemProps } from '../Menu/item';
import { StyledPopover } from '../Popover';
import ReqoreTabsListItem, { IReqoreTabListItemProps, StyledTabListItem } from './item';

export interface IReqoreTabsListProps
  extends IReqoreTabsProps,
    React.HTMLAttributes<HTMLDivElement> {
  onTabChange?: (tabId: string | number) => any;
  children?: any;
  customTheme?: IReqoreCustomTheme | IReqoreBreadcrumbsTheme;
}

export interface IReqoreTabsListStyle extends Omit<IReqoreTabsListProps, 'tabs'> {
  theme: IReqoreTheme;
}

export const StyledReqoreTabsList = styled.div<IReqoreTabsListStyle>`
  ${({ fill, vertical, currentTabColor, width }) => css`
    height: ${vertical ? '100%' : undefined};
    width: ${vertical ? width || '200px' : '100%'};
    flex-flow: ${vertical ? 'column' : 'row'};
    display: flex;
    align-items: center;
    border-${vertical ? 'right' : 'bottom'}: 1px solid ${changeLightness(currentTabColor, 0.175)};

    ${
      fill &&
      css`
        justify-content: space-around;
      `
    }

    ${StyledPopover} {
      > ${StyledTabListItem} {
        height: 100%;
      }
    }
  `}
`;

const isTabHidden = (items: IReqoreTabsListItem[], activeTab?: string | number) =>
  items.find((item) => item?.id === activeTab);

const getMoreLabel = (items: IReqoreTabsListItem[], activeTab?: string | number) => {
  if (isTabHidden(items, activeTab)) {
    return isTabHidden(items, activeTab)?.label;
  }

  return 'More';
};

const getLabel = (
  item: IReqoreTabsListItem | IReqoreTabsListItem[],
  activeTab?: string | number,
  tabsSize: TSizes = 'normal'
) => {
  if (!item) {
    return 0;
  }

  const label: string = isArray(item) ? getMoreLabel(item, activeTab) : item.label;
  const icon: number = isArray(item) || item.icon ? ICON_FROM_SIZE[tabsSize] : 0;
  const closeIconSize = isArray(item) || !item.onCloseClick ? 0 : ICON_FROM_SIZE[tabsSize] * 2;

  return calculateStringSizeInPixels(label, TEXT_FROM_SIZE[tabsSize]) + icon + closeIconSize;
};

/**
 * This function returns the total width or height of the tabs.
 * @param items the items that will be rendered in the tabs
 * @param type the type of calculation, either width or height
 * @param activeTab the currently active tab
 * @param tabsSize the size of the tabs
 * @returns the total width or height of the tabs
 */
export const getTabsLength = (
  items: (IReqoreTabsListItem | IReqoreTabsListItem[])[],
  type: 'width' | 'height' = 'width',
  activeTab?: string | number,
  tabsSize?: TSizes
): number =>
  items.reduce((len, item) => {
    if (type === 'height') {
      const rows = getLabel(item, activeTab, tabsSize) / 4 || 1;

      return len + rows * 15 + 10;
    }

    const labelLength: number =
      PADDING_FROM_SIZE[tabsSize] * 3 +
      TABS_PADDING_TO_PX[tabsSize] * 2 +
      getLabel(item, activeTab, tabsSize);

    return len + labelLength;
  }, 0);

const getTransformedItems = (
  items: (IReqoreTabsListItem | IReqoreTabsListItem[])[],
  size: number,
  type: 'width' | 'height' = 'width',
  activeTab?: string | number,
  tabsSize?: TSizes
): (IReqoreTabsListItem | IReqoreTabsListItem[])[] => {
  if (!size) {
    return items;
  }
  let newItems = [...items];

  while (getTabsLength(newItems, type, activeTab, tabsSize) > size && newItems.length > 1) {
    if (isArray(newItems[newItems.length - 1])) {
      (newItems[newItems.length - 1] as IReqoreTabsListItem[]).unshift(
        newItems[newItems.length - 2] as IReqoreTabsListItem
      );
      newItems[newItems.length - 2] = undefined!;
    } else {
      const lastItem = newItems[newItems.length - 1];
      (newItems[newItems.length - 1] as IReqoreTabsListItem[]) = [
        lastItem,
      ] as IReqoreTabsListItem[];
    }

    newItems = newItems.filter((i) => i);
  }

  return newItems.filter((i) => i);
};

const ReqoreTabsList = ({
  tabs,
  onTabChange,
  activeTab,
  _testWidth,
  fill,
  vertical,
  activeTabIntent,
  customTheme,
  wrapTabNames,
  flat,
  size,
  intent,
  padded,
  ...rest
}: IReqoreTabsListProps) => {
  const [ref, { width }] = useMeasure();
  const theme = useReqoreTheme('main', customTheme, intent);
  const activeTabData = tabs.find((tab) => tab.id === activeTab);
  const currentTabColor: TReqoreHexColor =
    activeTabIntent || activeTabData?.intent
      ? theme.intents[activeTabIntent || activeTabData.intent]
      : getNthGradientColor(theme, activeTabData?.effect?.gradient?.colors) ||
        getColorFromMaybeString(theme, activeTabData?.customTheme?.main || theme.main);

  const transformedItems = vertical
    ? tabs
    : getTransformedItems(tabs, _testWidth || width, 'width', activeTab, size);

  return (
    <ReqoreThemeProvider theme={theme}>
      <StyledReqoreTabsList
        {...rest}
        size={size}
        fill={fill}
        vertical={vertical}
        className={`${rest.className || ''} reqore-tabs-list`}
        ref={ref}
        flat={flat}
        theme={theme}
        currentTabColor={currentTabColor}
      >
        {transformedItems.map((item: IReqoreTabsListItem | IReqoreTabsListItem[], index: number) =>
          isArray(item) ? (
            <React.Fragment key={index}>
              <ReqorePopover
                key={index}
                component={ReqoreTabsListItem}
                componentProps={
                  {
                    icon: 'ArrowDownSLine',
                    id: 'showMore',
                    label: getMoreLabel(item, activeTab),
                    active: !!isTabHidden(item, activeTab),
                    activeIntent: activeTabIntent,
                    intent: !!isTabHidden(item, activeTab) ? activeTabData?.intent : undefined,
                    effect: !!isTabHidden(item, activeTab) ? activeTabData?.effect : undefined,
                    customTheme: !!isTabHidden(item, activeTab)
                      ? activeTabData?.customTheme
                      : theme,
                    vertical,
                    flat,
                    size,
                    padded,
                    className: 'reqore-tabs-list-item-menu',
                  } as IReqoreTabListItemProps
                }
                closeOnOutsideClick
                isReqoreComponent
                noWrapper
                handler='hoverStay'
                content={
                  <ReqoreMenu customTheme={theme}>
                    {item.map(
                      ({
                        icon,
                        label,
                        as,
                        tooltip,
                        props,
                        disabled,
                        id,
                        onCloseClick,
                        intent,
                        activeIntent,
                        closeIcon,
                        ...rest
                      }) => (
                        <ReqoreMenuItem
                          {...({
                            ...props,
                            icon,
                            as,
                            intent: activeTab === id ? activeIntent || intent : intent,
                            disabled,
                            rightIcon: onCloseClick ? closeIcon || 'CloseLine' : undefined,
                            onRightIconClick:
                              onCloseClick && !disabled
                                ? () => {
                                    onCloseClick(id);
                                  }
                                : undefined,
                            selected: activeTab === id,
                            onClick: (_id, event: React.MouseEvent<any>) => {
                              if (!disabled) {
                                onTabChange?.(id);

                                if (props?.onClick) {
                                  props.onClick(event);
                                }
                              }
                            },
                          } as IReqoreMenuItemProps)}
                          tooltip={tooltip}
                          {...rest}
                          key={index + label}
                        >
                          {label}
                        </ReqoreMenuItem>
                      )
                    )}
                  </ReqoreMenu>
                }
              />
            </React.Fragment>
          ) : (
            <React.Fragment key={index}>
              <ReqoreTabsListItem
                customTheme={theme}
                fill={fill}
                size={size}
                flat={flat}
                padded={padded}
                activeIntent={activeTabIntent}
                wrapTabNames={wrapTabNames}
                {...item}
                key={index}
                vertical={vertical}
                active={activeTab === item.id}
                onClick={(event: React.MouseEvent<any>) => {
                  if (!item.disabled) {
                    onTabChange?.(item.id);

                    if (item.props?.onClick) {
                      item.props.onClick(event);
                    }
                  }
                }}
                onCloseClick={
                  item.onCloseClick
                    ? () => {
                        item.onCloseClick?.(item.id);
                      }
                    : undefined
                }
              />
            </React.Fragment>
          )
        )}
      </StyledReqoreTabsList>
    </ReqoreThemeProvider>
  );
};

export default ReqoreTabsList;
