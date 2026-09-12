import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RowMenuContext, useRowMenu } from '../src/components/form/engine/rowMenuContext';

/**
 * An editor publishes its actions into the row's ⋮ instead of drawing a second.
 *
 * The registration is KEYED because menu items carry handlers: they are a new
 * array on every render, so a row that stored them by value would re-render the
 * editor, which would publish again — the loop this API exists to avoid.
 */
const Publisher = ({ items, itemKey }: { items: { label: string }[]; itemKey: string }) => {
  const rowMenu = useRowMenu();
  React.useEffect(() => {
    rowMenu?.registerRowMenuItems(itemKey, items as never);
  });
  // What the IDE's template field does: draw nothing of its own when a row
  // menu is there to publish into.
  return <span>{rowMenu ? 'published' : 'own menu'}</span>;
};

describe('the row-menu channel', () => {
  it('re-reads the items only when the key changes', () => {
    const register = vi.fn();
    const Harness = ({ itemKey }: { itemKey: string }) => (
      <RowMenuContext.Provider value={{ registerRowMenuItems: register }}>
        <Publisher itemKey={itemKey} items={[{ label: 'Use Expression' }]} />
      </RowMenuContext.Provider>
    );

    const { rerender } = render(<Harness itemKey='expression' />);
    expect(register).toHaveBeenCalledWith('expression', [{ label: 'Use Expression' }]);

    // A re-render with the SAME offering publishes the same key — the row is
    // what decides to ignore it, which is the next test.
    rerender(<Harness itemKey='expression' />);
    expect(register.mock.calls.every(([key]) => key === 'expression')).toBe(true);

    rerender(<Harness itemKey='expression,template' />);
    expect(register).toHaveBeenLastCalledWith('expression,template', expect.anything());
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
      <RowMenuContext.Provider value={{ registerRowMenuItems: vi.fn() }}>
        <Publisher itemKey='expression' items={[{ label: 'Use Expression' }]} />
      </RowMenuContext.Provider>
    );
    expect(screen.queryByText('published')).not.toBeNull();
  });

  it('ignores a repeat of the same key, so a publishing editor cannot loop the row', () => {
    // The row's own reducer, in the shape CompactRow uses it.
    const reduce = (
      previous: { key: string; items: unknown[] },
      key: string,
      items: unknown[]
    ) => (previous.key === key ? previous : { key, items });

    const first = { key: '', items: [] };
    const second = reduce(first, 'expression', [{ label: 'a' }]);
    expect(second).not.toBe(first);

    // Same key, a DIFFERENT array (handlers make one every render): the row
    // must hand back the identical object, or setState would re-render.
    const third = reduce(second, 'expression', [{ label: 'a' }]);
    expect(third).toBe(second);

    const fourth = reduce(third, 'expression,template', [{ label: 'a' }, { label: 'b' }]);
    expect(fourth).not.toBe(third);
    expect(fourth.items).toHaveLength(2);
  });
});
