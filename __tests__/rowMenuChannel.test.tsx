import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  RowMenuContext,
  useRowMenu,
  useRowMenuPublisher,
  useRowMenuRegistry,
} from '../src/components/form/engine/rowMenuContext';

/**
 * An editor publishes its actions into the row's ⋮ instead of drawing a second.
 *
 * The registration is KEYED because menu items carry handlers: they are a new
 * array on every render, so a row that stored them by value would re-render the
 * editor, which would publish again — the loop this API exists to avoid.
 */
const Publisher = ({ items, itemKey }: { items: { label: string }[]; itemKey: string }) => {
  const rowMenu = useRowMenu();
  useRowMenuPublisher(rowMenu, itemKey, items as never);
  // What the IDE's template field does: draw nothing of its own when a row
  // menu is there to publish into.
  return <span>{rowMenu ? 'published' : 'own menu'}</span>;
};

describe('the row-menu channel', () => {
  it('publishes again only when the offering changes', () => {
    const register = vi.fn();
    const Harness = ({ itemKey }: { itemKey: string }) => (
      <RowMenuContext.Provider
        value={{ registerRowMenuItems: register, unregisterRowMenuItems: vi.fn() }}
      >
        <Publisher itemKey={itemKey} items={[{ label: 'Use Expression' }]} />
      </RowMenuContext.Provider>
    );

    const { rerender } = render(<Harness itemKey='expression' />);
    expect(register).toHaveBeenCalledWith(expect.any(String), 'expression', [
      { label: 'Use Expression' },
    ]);

    rerender(<Harness itemKey='expression,template' />);
    expect(register).toHaveBeenLastCalledWith(
      expect.any(String),
      'expression,template',
      expect.anything()
    );
  });

  it('withdraws its items when the editor unmounts', () => {
    const unregister = vi.fn();
    const { unmount } = render(
      <RowMenuContext.Provider
        value={{ registerRowMenuItems: vi.fn(), unregisterRowMenuItems: unregister }}
      >
        <Publisher itemKey='expression' items={[{ label: 'Use Expression' }]} />
      </RowMenuContext.Provider>
    );
    expect(unregister).not.toHaveBeenCalled();
    unmount();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('tells an editor there is no row menu, so it keeps its own control', () => {
    // Outside a row — the classic form path, or a field rendered alone — the
    // context is absent and the editor must go on drawing its own menu, or its
    // actions become unreachable.
    render(<Publisher itemKey='expression' items={[{ label: 'Use Expression' }]} />);
    expect(screen.queryByText('own menu')).not.toBeNull();
  });

  it('lets the editor render nothing of its own when a row menu is present', () => {
    render(
      <RowMenuContext.Provider
        value={{ registerRowMenuItems: vi.fn(), unregisterRowMenuItems: vi.fn() }}
      >
        <Publisher itemKey='expression' items={[{ label: 'Use Expression' }]} />
      </RowMenuContext.Provider>
    );
    expect(screen.queryByText('published')).not.toBeNull();
  });

  describe('a real row', () => {
    type TItem = { label?: string; onClick?: () => void };

    /**
     * The row side, the way CompactRow uses it: the editors are created in the
     * row's OWN render (`renderOption(...)`), so every row render re-renders them.
     */
    const Row = ({ editors, onItems }: { editors: () => React.ReactNode; onItems: (items: TItem[]) => void }) => {
      const { rowMenu, items } = useRowMenuRegistry();
      onItems(items as never);
      return <RowMenuContext.Provider value={rowMenu}>{editors()}</RowMenuContext.Provider>;
    };

    /** An editor publishing a fresh item array every render, with a runaway guard. */
    const Editor = ({
      itemKey,
      label,
      onClick = () => undefined,
    }: {
      itemKey: string;
      label: string;
      onClick?: () => void;
    }) => {
      const renders = React.useRef(0);
      renders.current += 1;
      if (renders.current > 50) {
        throw new Error(`editor "${label}" re-rendered ${renders.current} times — the row is looping`);
      }
      useRowMenuPublisher(useRowMenu(), itemKey, [{ label, onClick }] as never);
      return null;
    };

    it('settles when two editors in one row offer different items', () => {
      // An expression builder's operands are separate editors in the same row.
      // Each publishing its own key into ONE slot overwrote the other, which
      // re-rendered the row and both editors, which published again — forever.
      let items: TItem[] = [];
      render(
        <Row
          onItems={(next) => (items = next)}
          editors={() => (
            <>
              <Editor itemKey='expression' label='Use Expression' />
              <Editor itemKey='template' label='Use Template' />
            </>
          )}
        />
      );
      expect(items.map((item) => item.label).sort()).toEqual(['Use Expression', 'Use Template']);
    });

    it('calls the handler of the editor on screen, not one that has unmounted', () => {
      // A row outlives its editor: closing and reopening a row mounts a NEW
      // editor offering the SAME key. The row must not keep the old editor's
      // items, whose handlers belong to a component that no longer exists.
      const stale = vi.fn();
      const current = vi.fn();
      let items: TItem[] = [];
      const { rerender } = render(
        <Row
          onItems={(next) => (items = next)}
          editors={() => <Editor key='first' itemKey='template' label='Use Template' onClick={stale} />}
        />
      );
      rerender(<Row onItems={(next) => (items = next)} editors={() => null} />);
      expect(items).toHaveLength(0);

      rerender(
        <Row
          onItems={(next) => (items = next)}
          editors={() => <Editor key='second' itemKey='template' label='Use Template' onClick={current} />}
        />
      );
      act(() => items[0]?.onClick?.());
      expect(current).toHaveBeenCalledTimes(1);
      expect(stale).not.toHaveBeenCalled();
    });

    it("calls the editor's latest handler when its offering has not changed", () => {
      // Same editor, same key, new props: the handler closes over the new value.
      const first = vi.fn();
      const latest = vi.fn();
      let items: TItem[] = [];
      const { rerender } = render(
        <Row
          onItems={(next) => (items = next)}
          editors={() => <Editor itemKey='template' label='Use Template' onClick={first} />}
        />
      );
      rerender(
        <Row
          onItems={(next) => (items = next)}
          editors={() => <Editor itemKey='template' label='Use Template' onClick={latest} />}
        />
      );
      act(() => items[0]?.onClick?.());
      expect(latest).toHaveBeenCalledTimes(1);
      expect(first).not.toHaveBeenCalled();
    });
  });
});
