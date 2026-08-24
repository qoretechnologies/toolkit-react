import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { FormEngine } from '../src/components/form/engine/FormEngine';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

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

  beforeEach(() => {
    scrolledTo.length = 0;
    Element.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolledTo.push(this);
    } as typeof Element.prototype.scrollIntoView;
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  const guildSchema = {
    guild: {
      type: 'string',
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
});
