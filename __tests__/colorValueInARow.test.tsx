// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * qorus#646: a compact form row draws a color with ReqraftColorValue at its compact size - the look the row
 * has always had - so a page and a row show a color the same way, and a value that is not a color says
 * what it is in the row too, instead of a hex code beside a swatch of nothing.
 */
const renderRow = (field: unknown, schema: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='read'
          value={{ choice: field } as never}
          options={{ choice: { type: 'rgbcolor', display_name: 'Choice', ...schema } } as never}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const readRow = async (container: HTMLElement): Promise<HTMLElement> => {
  await waitFor(() => expect(container.querySelector('.readfirst-row')).not.toBeNull());
  return container.querySelector('.readfirst-row') as HTMLElement;
};

describe('a color in a compact row', () => {
  it('is drawn by ReqraftColorValue at its compact size, its swatch named', async () => {
    const { container } = renderRow({ type: 'rgbcolor', value: { r: 100, g: 149, b: 237, a: 1 } });
    const row = await readRow(container);
    await waitFor(() => expect(row.querySelector('.reqraft-color-value')).not.toBeNull());
    const value = row.querySelector('.reqraft-color-value') as HTMLElement;
    expect(value.getAttribute('data-size')).toBe('compact');
    expect(value.getAttribute('data-color')).toBe('#6495ED');
    expect(value.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Color #6495ED');
  });

  it('says what a value that is not a color is, with no swatch', async () => {
    const { container } = renderRow({ type: 'rgbcolor', value: '#zzz' });
    const row = await readRow(container);
    await waitFor(() => expect(row.textContent).toContain('Not a color: “#zzz”'));
    expect(row.querySelector('.reqraft-color-value[data-invalid="true"]')).not.toBeNull();
    expect(row.querySelector('[role="img"]')).toBeNull();
    expect(row.textContent).not.toContain('#ZZZ');
  });

  it('shows a sensitive color as hidden, with no swatch to give it away', async () => {
    const { container } = renderRow(
      { type: 'rgbcolor', value: { r: 100, g: 149, b: 237, a: 1 } },
      { sensitive: true }
    );
    const row = await readRow(container);
    await waitFor(() => expect(row.textContent).toContain('••••••'));
    expect(row.querySelector('.reqraft-color-value')).toBeNull();
    // no swatch and no wash of the color: the row drew both beside the dots
    expect(row.querySelector('[style*="color-mix"]')).toBeNull();
    expect(row.textContent).not.toContain('#6495ED');
  });
});
