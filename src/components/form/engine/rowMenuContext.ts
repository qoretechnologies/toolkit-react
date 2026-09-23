// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * SEAM (reqraft): an editor publishes its own actions into the row's ⋮ menu.
 *
 * A row already renders one overflow menu — Edit fullscreen, Remove field, and
 * any `optionActions` the host injected — and the comment on it has always said
 * why: *"this row already has a menu, so they reuse it rather than adding a
 * second one beside it."* An EDITOR could not reach that menu, so an editor
 * with affordances of its own had no choice but to draw a second ⋮ inside the
 * value cell. The IDE's template field does exactly that, and the two menus
 * ended up side by side on one control, at slightly different widths.
 *
 * `optionActions` does not solve it: that seam is host configuration, resolved
 * from the option's name and schema before the editor exists, so it cannot know
 * what the editor can offer *now* — whether its templates have loaded, whether
 * the value is already an expression, which custom items the field was given.
 *
 * ## Why registration is keyed, and by whom
 *
 * Menu items carry `onClick` handlers, so they are a new array on every render
 * and cannot be compared by value. An editor therefore publishes a `key`
 * alongside them: a primitive describing WHICH items it is currently offering
 * (`'expression,template'`). The row re-renders only when a publisher's key
 * changes, so a re-rendering editor cannot drive the row into a state loop.
 *
 * Each registration also belongs to ONE publisher. A single shared slot let
 * two publishers in the same row — an expression builder's operands — overwrite
 * each other's key on every render, which re-rendered the row and both of them,
 * which published again: a synchronous render loop that froze the page. And a
 * slot that outlived its editor kept that editor's handlers after it unmounted,
 * so a row closed and reopened offered items that did nothing. Registrations
 * are therefore per publisher, withdrawn on unmount, and a click always reaches
 * the handler from the publisher's latest render.
 *
 * Publish with `useRowMenuPublisher`; provide with `useRowMenuRegistry`.
 */
export interface IRowMenuRegistration {
  /**
   * Publish a publisher's menu items into the containing row's ⋮.
   *
   * @param publisherId identifies the publishing editor (one per mounted editor)
   * @param key a primitive describing which items are being offered; the row
   * re-renders only when it changes
   * @param items the items to merge, or an empty array to contribute none
   */
  registerRowMenuItems: (publisherId: string, key: string, items: IReqoreDropdownItem[]) => void;
  /** Withdraw a publisher's items — when it unmounts or leaves the row. */
  unregisterRowMenuItems: (publisherId: string) => void;
}

/**
 * Absent outside a compact row — the classic (non-compact) render path has no
 * row menu to merge into, and an editor there keeps drawing its own control.
 */
export const RowMenuContext = createContext<IRowMenuRegistration | undefined>(undefined);

/**
 * The row-menu channel for the row this editor is inside, or `undefined` when
 * there is no row menu to publish into.
 *
 * An editor that finds it should render no menu of its own; one that does not
 * must keep rendering its own, or its actions become unreachable.
 */
export const useRowMenu = (): IRowMenuRegistration | undefined => useContext(RowMenuContext);

/**
 * Publish `items` into `rowMenu` for as long as the calling editor is mounted.
 * `rowMenu` is passed rather than read here so an editor can claim the channel
 * and hide it from what it renders (see `TemplateField`).
 */
export const useRowMenuPublisher = (
  rowMenu: IRowMenuRegistration | undefined,
  key: string,
  items: IReqoreDropdownItem[]
): void => {
  const publisherId = useId();

  useEffect(() => {
    rowMenu?.registerRowMenuItems(publisherId, key, items);
  }, [rowMenu, publisherId, key, items]);

  useEffect(() => () => rowMenu?.unregisterRowMenuItems(publisherId), [rowMenu, publisherId]);
};

/**
 * The row side of the channel: the registration to provide, and the items the
 * row's ⋮ should list.
 */
export const useRowMenuRegistry = (): {
  rowMenu: IRowMenuRegistration;
  items: IReqoreDropdownItem[];
} => {
  // Which publishers are offering which item SET — the only state, so only a
  // change of set re-renders the row.
  const [keys, setKeys] = useState<Record<string, string>>({});
  // Each publisher's items from its latest render, read at click time.
  const latest = useRef<Record<string, IReqoreDropdownItem[]>>({});

  const registerRowMenuItems = useCallback(
    (publisherId: string, key: string, items: IReqoreDropdownItem[]) => {
      latest.current[publisherId] = items;
      setKeys((previous) =>
        previous[publisherId] === key ? previous : { ...previous, [publisherId]: key }
      );
    },
    []
  );

  const unregisterRowMenuItems = useCallback((publisherId: string) => {
    delete latest.current[publisherId];
    setKeys((previous) => {
      if (!(publisherId in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[publisherId];
      return next;
    });
  }, []);

  const rowMenu = useMemo(
    () => ({ registerRowMenuItems, unregisterRowMenuItems }),
    [registerRowMenuItems, unregisterRowMenuItems]
  );

  const items = useMemo(
    () =>
      Object.keys(keys).flatMap((publisherId) =>
        (latest.current[publisherId] ?? []).map((item, index) =>
          item.onClick
            ? {
                ...item,
                // Same key, same item set, so the index still names this item;
                // the handler is whatever the publisher rendered last.
                onClick: ((...args: unknown[]) =>
                  (latest.current[publisherId]?.[index]?.onClick as
                    | ((...clickArgs: unknown[]) => unknown)
                    | undefined)?.(...args)) as IReqoreDropdownItem['onClick'],
              }
            : item
        )
      ),
    [keys]
  );

  return { rowMenu, items };
};
