import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/* A schema load that never answers. Never REJECTS either: a rejection after the
   test has unmounted is an unhandled one, and it would fail the run from a
   test that had already passed. */
const neverLoads = () => new Promise<never>(() => {});

const OPTIONS = {
  name: { type: 'string', display_name: 'Name' },
} as never;

const renderForm = (extra: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='host-wait'
          value={{} as never}
          options={OPTIONS}
          onChange={vi.fn()}
          {...extra}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/**
 * A host's own wait can be handed to the form.
 *
 * The alternative is what the Qorus IDE used to do: draw its own placeholder
 * while it resolved a schema, then hand over to this component, which drew ITS
 * own for the waits that only start once it mounts. Three components did that
 * in series for one load — three placeholder mounts, three DOM nodes, and the
 * page relayouting between them each time the height differed. Measured on the
 * alert rule at three sections' worth: nine placeholder mounts for one page
 * load, dropping to five once the hosts handed their waits down here.
 *
 * `skeleton` was read by the loading gate long before it was declared, which is
 * why this pins it: an undeclared prop is one refactor away from being dropped.
 */
describe('a host wait handed to the form', () => {
  const skeletonSelector = '.options-loading-skeleton';

  it('draws the form’s own placeholder while the host is still loading', async () => {
    const { container } = renderForm({ skeleton: true });

    await waitFor(() => {
      expect(container.querySelector(skeletonSelector)).not.toBeNull();
    });
    // ...and nothing of the form itself, so there is nothing to replace later.
    expect(container.textContent).not.toContain('Name');
  });

  it('renders the form once the host says it is done', async () => {
    const { container } = renderForm({ skeleton: false });

    await waitFor(() => {
      expect(container.textContent).toContain('Name');
    });
    expect(container.querySelector(skeletonSelector)).toBeNull();
  });

  it('is one placeholder, not one per wait: the same node survives the handover', async () => {
    // The host finishes first and the form's own waits carry on. If the two
    // drew separate placeholders this is where the swap would show — so the
    // form is given a wait that OUTLIVES the host's: a schema loader that never
    // settles, which pins `data-wait` at `options` once the host stops waiting.
    // Without it the handover is a race against the type catalogue resolving,
    // and the moment worth asserting would be gone before it could be read.
    const { container, rerender } = renderForm({ skeleton: true, options: undefined, optionsLoader: neverLoads });

    await waitFor(() => {
      expect(container.querySelector(skeletonSelector)).not.toBeNull();
    });
    const first = container.querySelector(skeletonSelector);
    expect(first?.getAttribute('data-wait')).toBe('host');

    rerender(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='host-wait'
            value={{} as never}
            options={undefined}
            optionsLoader={neverLoads}
            onChange={vi.fn()}
            skeleton={false}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    // The host's wait is over and one of the form's own is now holding the
    // gate...
    const after = container.querySelector(skeletonSelector);
    expect(after?.getAttribute('data-wait')).not.toBe('host');
    // ...in the very same node. A second placeholder mounted for the second
    // wait is the cost this prop exists to remove, and it would show here as a
    // different element.
    expect(after).toBe(first);
  });
});
