/**
 * The row's ⋮ belongs to the row's own editor.
 *
 * A compact row hands its editor a channel for publishing actions into the
 * row's menu (`rowMenuContext`). The first `TemplateField` in the row claims it;
 * anything that field renders — an expression's operands, a nested value — must
 * not see it. Operands that did publish offered "Use Template" in a menu that
 * cannot say which operand it acts on, and, publishing different offerings into
 * one row, drove the row into a render loop that froze the page.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  RowMenuContext,
  useRowMenu,
} from '../src/components/form/engine/rowMenuContext';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const TEMPLATES = {
  items: [{ label: 'Captured', items: [{ value: '$.result', label: 'result' }] }],
};

/** Reports whether the editor TemplateField renders can see a row menu. */
const Probe = () => (
  <div data-testid='probe' data-sees-row-menu={String(!!useRowMenu())} />
);

/** An editor that itself renders a TemplateField — an operand, a nested value. */
const Nesting = () => (
  <TemplateField
    name='inner'
    allowTemplates
    templates={TEMPLATES as never}
    filterTemplatesByType={false}
    onChange={vi.fn()}
    component={Probe as never}
  />
);

const renderInRow = (component: unknown) => {
  const registerRowMenuItems = vi.fn();
  const unregisterRowMenuItems = vi.fn();
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <RowMenuContext.Provider value={{ registerRowMenuItems, unregisterRowMenuItems }}>
          <TemplateField
            name='outer'
            allowTemplates
            templates={TEMPLATES as never}
            filterTemplatesByType={false}
            onChange={vi.fn()}
            component={component as never}
          />
        </RowMenuContext.Provider>
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  return { registerRowMenuItems, unregisterRowMenuItems };
};

describe('TemplateField and the row menu', () => {
  it('publishes its own offering into the row', () => {
    const { registerRowMenuItems } = renderInRow(Probe);
    expect(registerRowMenuItems).toHaveBeenCalled();
    const [, key, items] = registerRowMenuItems.mock.calls.at(-1)!;
    expect(key).toContain('template');
    expect(items.map((item: { label: string }) => item.label)).toContain('Use Template');
  });

  it('hides the row menu from the editor it renders', () => {
    renderInRow(Probe);
    expect(screen.getByTestId('probe').dataset.seesRowMenu).toBe('false');
  });

  it('leaves a nested TemplateField out of the row: exactly one publisher', () => {
    const { registerRowMenuItems } = renderInRow(Nesting);
    // The nested field rendered, and could not see the row either.
    expect(screen.getByTestId('probe').dataset.seesRowMenu).toBe('false');
    const publishers = new Set(registerRowMenuItems.mock.calls.map(([publisherId]) => publisherId));
    expect(publishers.size).toBe(1);
  });
});
