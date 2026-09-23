import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const OPTIONS = {
  name: { type: 'string', display_name: 'Name' },
} as never;

const renderForm = (extra: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='wait-reason'
          value={{} as never}
          options={OPTIONS}
          onChange={vi.fn()}
          {...extra}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/**
 * The placeholder says which wait it is standing for.
 *
 * A form has seven independent reasons to be waiting and every one of them
 * draws the same picture, so a page that is still a placeholder tells you
 * nothing about what to fix. Measured on the live alert rule: three sections
 * were placeholders from 1459ms to 2039ms and cleared in the SAME commit, and
 * neither shared wait explained it — `types` had resolved at 140ms and
 * `templates` at 1500ms. Without this attribute the next step is guessing.
 */
describe('the loading placeholder names its wait', () => {
  const skeleton = '.options-loading-skeleton';

  it('reports a host-owned wait as `host`', async () => {
    const { container } = renderForm({ skeleton: true });

    await waitFor(() => {
      expect(container.querySelector(skeleton)).not.toBeNull();
    });
    expect(container.querySelector(skeleton)?.getAttribute('data-wait')).toBe('host');
  });

  const KNOWN = ['host', 'templates', 'types', 'options', 'fetch', 'operators', 'schema'];

  it('reports one of the form’s OWN waits when the host is not waiting', async () => {
    // The two are fixed in different repositories, so the reading has to be
    // able to send you to the right one.
    //
    // No `url`: the form has a wait of its own here regardless (the type
    // catalogue is unseeded in this harness), and giving it one starts a real
    // query that is cancelled on unmount — an unhandled rejection that fails
    // the run even though every test passes.
    const { container } = renderForm({});

    await waitFor(() => {
      expect(container.querySelector(skeleton)).not.toBeNull();
    });
    const reason = container.querySelector(skeleton)?.getAttribute('data-wait');
    expect(reason).not.toBe('host');
    expect(KNOWN).toContain(reason);
  });

  it('lets the host’s wait win, so a handed-down wait is never misreported', async () => {
    // Both are true here: the host is waiting AND the form has a wait of its
    // own (the previous test proves it reports one when the host is silent).
    // The host is the outer one, so it is the one worth naming — chasing the
    // form's own wait would be chasing something that only exists because the
    // host has not answered yet.
    const { container } = renderForm({ skeleton: true });

    await waitFor(() => {
      expect(container.querySelector(skeleton)).not.toBeNull();
    });
    expect(container.querySelector(skeleton)?.getAttribute('data-wait')).toBe('host');
  });

  it('names the host’s OWN reason when it hands one down', async () => {
    // The reading has to survive the package boundary: `host` alone stops at
    // it, and the host has five conditions of its own behind that one word.
    const { container } = renderForm({ skeleton: true, skeletonReason: 'templates' });

    await waitFor(() => {
      expect(container.querySelector(skeleton)).not.toBeNull();
    });
    expect(container.querySelector(skeleton)?.getAttribute('data-wait')).toBe('host:templates');
  });

  it('carries no wait attribute once the form itself is rendered', async () => {
    const { container } = renderForm({ skeleton: false });

    await waitFor(() => {
      expect(container.textContent).toContain('Name');
    });
    expect(container.querySelector(skeleton)).toBeNull();
    expect(container.querySelector('[data-wait]')).toBeNull();
  });
});
