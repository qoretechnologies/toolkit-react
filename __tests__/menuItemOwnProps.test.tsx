/**
 * A menu item's own props (`activePaths`, `submenu`, `divider`) decide what the menu draws and never reach
 * the DOM, and an item's active state follows its `activePaths` (qorus#646).
 *
 * ReqraftMenuItem read `activePaths` to decide whether it is active, then spread every prop it was given into
 * ReqoreMenuItem. An item drawn as a router link (`as: Link`, as qorus-ide's sidebar draws its items) hands the
 * props it does not know to its `<a>`, so React warned that it does not recognize `activePaths` and the attribute
 * was written to the link. The active state was also kept from the first render: it was computed once per
 * `path`, so `activePaths` changing (a menu rebuilt with another item active) changed nothing.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import { AnchorHTMLAttributes, forwardRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReqraftMenu, ReqraftMenuItem, TReqraftMenu } from '../src/components/menu/Menu';
import { ReqraftStorageContext } from '../src/contexts/StorageContext';

/** What react-router's Link does with the props it does not use: they go on its `<a>`. */
const LinkLike = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }
>(({ to, ...rest }, ref) => <a ref={ref} href={to} {...rest} />);

const storage: Record<string, unknown> = {};
const withProviders = (ui: JSX.Element) => (
  <ReqoreUIProvider>
    <ReqraftStorageContext.Provider
      value={{
        getStorage: (path: string, defaultValue?: unknown) =>
          path in storage ? storage[path] : defaultValue,
        updateStorage: (path: string, value: unknown) => {
          storage[path] = value;
        },
        removeStorageValue: (path: string) => {
          delete storage[path];
        },
      }}
    >
      {ui}
    </ReqraftStorageContext.Provider>
  </ReqoreUIProvider>
);

const ownPropWarnings = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls
    .map((args) => args.map(String).join(' '))
    .filter((text) => /activePaths|activepaths|submenu|`divider`/.test(text));

// jsdom has no ResizeObserver; the menu watches its list with one to show its scroll shadow.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

afterEach(() => vi.restoreAllMocks());

describe("a menu item's own props", () => {
  it('never reach the DOM, on a link, a section, a section item or a divider', () => {
    const errors = vi.spyOn(console, 'error');
    const menu: TReqraftMenu = [
      {
        label: 'Linked',
        icon: 'HomeLine',
        as: LinkLike,
        to: '/home',
        activePaths: ['/home'],
      } as any,
      { divider: true, label: 'Group' },
      {
        label: 'Interfaces',
        icon: 'FolderLine',
        activePaths: ['/Interfaces'],
        submenu: [
          {
            label: 'Mapper',
            as: LinkLike,
            to: '/Interfaces/mapper',
            activePaths: ['/Interfaces/mapper'],
          } as any,
        ],
      },
    ];
    render(withProviders(<ReqraftMenu menu={menu} path='/Interfaces/mapper' />));

    expect(screen.getAllByText('Linked').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mapper').length).toBeGreaterThan(0);
    expect(
      document.querySelectorAll('[activepaths], [activePaths], [submenu], [divider]')
    ).toHaveLength(0);
    expect(ownPropWarnings(errors)).toEqual([]);
  });
});

describe("a menu item's active state", () => {
  const section = (activePaths: string[]) => (
    <ReqraftMenuItem
      label='Interfaces'
      icon='FolderLine'
      path='/Interfaces/mapper'
      isCollapsed
      activePaths={activePaths}
      submenu={[{ label: 'Mapper', to: '/Interfaces/mapper' }]}
    />
  );

  it('follows activePaths when they change', async () => {
    const { rerender } = render(withProviders(section(['/Other'])));
    // not active: the section stays collapsed
    expect(screen.queryByText('Mapper')).toBeNull();

    rerender(withProviders(section(['/Interfaces'])));
    // active now: a collapsed section holding the active item opens
    await waitFor(() => expect(screen.getAllByText('Mapper').length).toBeGreaterThan(0));

    rerender(withProviders(section(['/Other'])));
    await waitFor(() => expect(screen.queryByText('Mapper')).toBeNull());
  });
});
