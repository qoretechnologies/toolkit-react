import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { FormEngine, IOptionsSchema } from '../src/components/form/engine/FormEngine';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * Several compact engines can be mounted at once with colliding field names —
 * one form per state in the qog template drawer, each carrying `guild` /
 * `channel`. The moved-field flash used to resolve its scroll target with a
 * document-wide query, so a move in one form scrolled the container to the
 * FIRST matching row in the DOM — a different form's field near the top of the
 * page. The lookup must stay inside the engine's own wrap.
 */
describe('FormEngine moved-field flash scoping', () => {
  const scrolledTo: HTMLElement[] = [];
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  const originalRect = Element.prototype.getBoundingClientRect;
  /** Where a moved row sits, viewport-relative; jsdom has no layout of its own. */
  let rowTop = 0;

  beforeEach(() => {
    scrolledTo.length = 0;
    rowTop = window.innerHeight + 200;
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolledTo.push(this);
    } as typeof Element.prototype.scrollIntoView;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const top = this.classList.contains('readfirst-row') ? rowTop : 0;
      return {
        top,
        bottom: top + 30,
        height: 30,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: top,
      } as DOMRect;
    };
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    Element.prototype.getBoundingClientRect = originalRect;
  });

  const guildSchema: IOptionsSchema = {
    guild: {
      type: 'string',
      ui_type: 'string',
      display_name: 'Server',
      required: true,
      supports_expressions: false,
      supports_templates: false,
    },
  };

  const engines = (secondValue: Record<string, unknown>) => (
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <div data-testid='form-a'>
          <FormEngine compact name='trigger' value={{}} options={guildSchema} />
        </div>
        <div data-testid='form-b'>
          <FormEngine compact name='send' value={secondValue} options={guildSchema} />
        </div>
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

  it('scrolls to the moved row of the engine the move happened in, not the first matching row in the document', async () => {
    const { rerender, getByTestId } = render(engines({}));

    // Both forms have rendered `guild` as needs-attention at least once, so the
    // move diff has a previous bucket to compare against.
    await waitFor(() =>
      expect(document.querySelectorAll('.readfirst-row[data-field="guild"]')).toHaveLength(2)
    );

    // Fill `guild` on the SECOND form only — it moves needs-attention → set,
    // which fires the follow-the-field flash with its scroll.
    rerender(engines({ guild: { type: 'string', value: 'My Dev Server' } }));

    await waitFor(() => expect(scrolledTo.length).toBeGreaterThan(0));

    const formB = getByTestId('form-b');
    for (const target of scrolledTo) {
      expect(formB.contains(target)).toBe(true);
    }
  });

  it('does not scroll to a moved row that is already in view', async () => {
    rowTop = 100;
    const { rerender } = render(engines({}));
    await waitFor(() =>
      expect(document.querySelectorAll('.readfirst-row[data-field="guild"]')).toHaveLength(2)
    );

    rerender(engines({ guild: { type: 'string', value: 'My Dev Server' } }));

    // The move is followed (the row flashes) in the frame the reveal runs in;
    // wait for that frame deterministically, then check no scroll was asked for.
    await waitFor(() =>
      expect(document.querySelector('.readfirst-row-flash[data-field="guild"]')).toBeTruthy()
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(scrolledTo).toHaveLength(0);
  });
});
