// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { createContext, useContext } from 'react';

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
 * ## Why registration is keyed
 *
 * Menu items carry `onClick` handlers, so they are a new array on every render
 * and cannot be compared by value. An editor therefore publishes a `key`
 * alongside them: a primitive describing WHICH items it is currently offering
 * (`'expression,template'`). The row stores the items only when the key
 * changes, so a re-rendering editor cannot drive the row into a state loop —
 * the common failure of "child registers into parent" APIs.
 *
 * The key is a claim about the item SET, not about the handlers: publish a key
 * that changes whenever the set does, and no more often.
 */
export interface IRowMenuRegistration {
  /**
   * Publish this editor's menu items into the containing row's ⋮.
   *
   * @param key a primitive describing which items are being offered; the row
   * re-reads `items` only when this changes
   * @param items the items to merge, or an empty array to contribute none
   */
  registerRowMenuItems: (key: string, items: IReqoreDropdownItem[]) => void;
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
