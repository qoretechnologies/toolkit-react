import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreInput,
  ReqoreMenuDivider,
  ReqoreMenuItem,
  ReqoreMenuSection,
} from '@qoretechnologies/reqore';
import ReqoreMenu, { IReqoreMenuProps } from '@qoretechnologies/reqore/dist/components/Menu';
import { IReqoreMenuDividerProps } from '@qoretechnologies/reqore/dist/components/Menu/divider';
import { IReqoreMenuItemProps } from '@qoretechnologies/reqore/dist/components/Menu/item';
import { map, reduce, size } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useReqraftStorage } from '../../hooks/useStorage/useStorage';

export interface IReqraftMenuItem extends IReqoreMenuItemProps {
  submenu?: TReqraftMenuItem[];
  activePaths?: string[];
  to?: string;
  href?: string;
}

export type TReqraftMenuItem = IReqraftMenuItem | ({ divider: true } & IReqoreMenuDividerProps);
export type TReqraftMenu = TReqraftMenuItem[];

export interface IReqraftMenuProps extends Partial<Omit<IReqoreMenuProps, 'resizable'>> {
  hidden?: boolean;
  onHideClick?: () => void;

  defaultQuery?: string;
  onQueryChange?: (query: string) => void;

  menu: TReqraftMenu;
  inputFocusShortcut?: string;
  path?: string;

  resizable?: boolean;
  onResizeChange?: (width: number) => void;
  defaultWidth?: number;
}

export const ReqraftMenuItem = ({
  path,
  isCollapsed,
  ...props
}: TReqraftMenuItem & { path?: string; isCollapsed?: boolean }) => {
  if ('divider' in props) {
    return <ReqoreMenuDivider />;
  }

  const isActive = useMemo(
    () =>
      props.activePaths?.some(
        (activePath) => activePath === path || path?.startsWith(`${activePath}/`)
      ),
    [path]
  );

  if (props.submenu) {
    const { submenu, ...menuData } = props;

    return (
      <ReqoreMenuSection
        label={menuData.label}
        icon={menuData.icon}
        isCollapsed={isCollapsed && !isActive}
        verticalPadding='tiny'
        {...menuData}
      >
        {map(submenu, (submenuData, submenuId) => (
          <ReqraftMenuItem key={submenuId} {...submenuData} path={path} />
        ))}
      </ReqoreMenuSection>
    );
  }

  return (
    <ReqoreMenuItem
      customTheme={{ main: '#050505' }}
      effect={
        isActive
          ? {
              gradient: {
                colors: {
                  0: 'info:darken:5:0.4',
                  40: '#181818',
                  100: '#181818',
                },
              },
            }
          : undefined
      }
      leftIconColor={isActive ? 'info:lighten:10' : undefined}
      verticalPadding='tiny'
      {...props}
    />
  );
};

export const ReqraftMenu = ({
  defaultQuery,
  defaultWidth = 250,
  inputFocusShortcut = '/',
  hidden,
  menu,
  onQueryChange,
  onResizeChange,
  onHideClick,
  resizable,
  path,
  ...rest
}: IReqraftMenuProps) => {
  const [query, setQuery] = useState<string>(defaultQuery);

  const [isSidebarOpen, update] = useReqraftStorage<boolean>('sidebar-open', true, false);
  const [sidebarSize, updateSidebarSize] = useReqraftStorage<number>(
    'sidebar-size',
    defaultWidth,
    false
  );

  useEffect(() => {
    if (defaultQuery) {
      setQuery(defaultQuery);
    }
  }, [defaultQuery]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    onQueryChange?.(newQuery);
  };

  const handleWidthChange = (newWidth: number) => {
    updateSidebarSize(newWidth);
    onResizeChange?.(newWidth);
  };

  const filteredMenu: TReqraftMenu = useMemo<TReqraftMenu>(() => {
    if (!query) {
      return menu;
    }

    const filterItems = (items: TReqraftMenu): TReqraftMenu => {
      return reduce(
        items,
        (acc, item) => {
          if ('divider' in item) {
            acc.push(item);
            return acc;
          }

          if (item.submenu) {
            const submenu = filterItems(item.submenu);
            const hasChildMatch = size(submenu);

            if (hasChildMatch) {
              acc.push({
                ...item,
                submenu,
              });

              return acc;
            }
          }

          if (item.label.toString().toLowerCase().includes(query.toLowerCase())) {
            acc.push(item);
          }

          return acc;
        },
        []
      );
    };

    return filterItems(menu);
  }, [menu, query]);

  if (hidden) {
    return null;
  }

  return (
    <ReqoreMenu
      width='250px'
      minimal
      position='left'
      resizable={{
        enable: { right: resizable, left: false },
        minWidth: '250px',
        maxWidth: '350px',
        onResizeStop: (_e, _direction, _ref, d) => {
          handleWidthChange(sidebarSize + d.width);
        },
        size: {
          width: `${sidebarSize}px`,
          height: '100%',
        },
      }}
      rounded={false}
      customTheme={{ main: '#181818' }}
      {...rest}
    >
      <ReqoreControlGroup>
        <ReqoreInput
          icon='Search2Line'
          minimal={false}
          flat={false}
          placeholder={`Filter menu "${inputFocusShortcut}"`}
          intent={query ? 'info' : 'muted'}
          leftIconProps={{ size: 'small' }}
          iconColor={query ? 'info' : 'muted'}
          pill
          value={query}
          onClearClick={() => handleQueryChange('')}
          onChange={(e: any) => handleQueryChange(e.target.value)}
          focusRules={{
            shortcut: inputFocusShortcut,
            type: 'keypress',
            clearOnFocus: true,
            doNotInsertShortcut: true,
          }}
        />
        <ReqoreButton
          icon='SideBarLine'
          fixed
          minimal={false}
          onClick={() => {
            update(!isSidebarOpen);
            onHideClick?.();
          }}
        />
      </ReqoreControlGroup>
      {map(filteredMenu, (menuData, menuId) => (
        <ReqraftMenuItem
          key={menuId}
          {...menuData}
          path={path}
          isCollapsed={!query && !!(menuData as IReqraftMenuItem).submenu}
        />
      ))}
    </ReqoreMenu>
  );
};
