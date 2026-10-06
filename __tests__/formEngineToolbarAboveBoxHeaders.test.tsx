/**
 * The pinned toolbar is painted above the pinned status-box headers.
 *
 * A box header pins just below the toolbar, but it cannot leave its own box:
 * when the end of the box scrolls up past the toolbar it is pushed up with it.
 * With both at ReqorePanel's sticky z-index, the header (later in the
 * document) slid OVER the toolbar and covered the search and the meter.
 * The geometry is asserted in the "Box Header Slides Under Toolbar" stories;
 * this pins the stacking order the fix relies on.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const options = {
  title: { type: 'string', display_name: 'Title', required: true },
  owner: { type: 'string', display_name: 'Owner', required: true },
  detail: { type: 'string', display_name: 'Detail' },
} as never;

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='form'
          value={{ owner: { type: 'string', value: 'ops' } } as never}
          options={options}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const zIndex = (element: Element | null) => Number(getComputedStyle(element as Element).zIndex);

describe('pinned toolbar and status-box headers', () => {
  it('stacks the toolbar above every box header', async () => {
    const { container } = renderForm();
    await waitFor(() =>
      expect(container.querySelectorAll('.options-readfirst-group').length).toBeGreaterThan(1)
    );
    const toolbar = container.querySelector(
      '.options-readfirst-scroll > .reqore-panel > .reqore-panel-title'
    );
    expect(toolbar).toBeTruthy();
    const headers = [...container.querySelectorAll('.options-readfirst-group')].map((box) =>
      box.querySelector(':scope > .reqore-panel-title')
    );
    expect(headers.length).toBeGreaterThan(1);
    for (const header of headers) {
      expect(header).toBeTruthy();
      expect(zIndex(toolbar)).toBeGreaterThan(zIndex(header));
    }
  });
});
