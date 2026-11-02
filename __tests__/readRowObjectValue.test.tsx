import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A read row whose value is an object must show what the object IS.
 *
 * The reported case: the Qog variables editor, read-only, with a data-provider
 * variable selected — its "Initial value" row read `11 fields`, which looks like
 * a string that happens to say "fields" and tells the reader nothing about the
 * provider. A hash-typed row already carried a structured preview under its
 * summary; a `data-provider` row did not, because the preview was keyed on the
 * declared type rather than on the value's shape.
 */
const SCHEMA = {
  name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Name',
  },
  value: {
    type: 'data-provider',
    ui_type: 'data-provider',
    display_name: 'Initial value',
  },
} as never;

const provider = {
  type: 'datasource',
  name: 'omquser',
  transaction_management: true,
  path: '/bb_local',
  supports_read: true,
  descriptions: ['Record-based data provider for db table `public.bb_local`'],
};

const renderForm = () =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          readOnly
          name='variable'
          value={
            {
              name: { type: 'string', value: 'var2' },
              value: { type: 'data-provider', value: provider },
            } as never
          }
          options={SCHEMA}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const row = (container: HTMLElement, field: string) =>
  container.querySelector(`[data-field="${field}"]`);

describe('a read row with an object value', () => {
  it('names a data provider and previews its keys', async () => {
    const { container } = renderForm();

    await waitFor(() => expect(row(container, 'value')).toBeTruthy());

    const providerRow = row(container, 'value')!;
    // The summary line says which provider, not how many keys describe it.
    expect(providerRow.textContent).toContain('datasource · omquser · /bb_local');
    expect(providerRow.textContent).not.toContain('fields');
    // And the keys themselves are one disclosure away, as they are for a hash.
    expect(providerRow.querySelector('.options-readfirst-structured')).toBeTruthy();
    expect(providerRow.textContent).toContain('bb_local');
  });

  it('gives a scalar row no preview', async () => {
    const { container } = renderForm();

    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    // The counterweight: the preview is a property of the value's shape, not
    // of the read mode. A string row stays one line.
    expect(row(container, 'name')!.querySelector('.options-readfirst-structured')).toBeNull();
  });
});

/**
 * A data provider's preview is the provider, not the cache the picker keeps
 * beside it.
 *
 * The preview drew the stored value through the untyped data view, which prints
 * every string as it is: the picker's `descriptions` (server markdown, "Data
 * provider for database `pgsql:omquser@omquser`") came out with their backticks,
 * and the capabilities the picker cached when the provider was chosen
 * (`supports_*`, `transaction_management`, `record_requires_search_options`)
 * read as if they were part of the value.
 */
describe("a data provider's read-first preview", () => {
  const stored = {
    type: 'datasource',
    name: 'omquser',
    path: '/bb_local',
    transaction_management: true,
    record_requires_search_options: false,
    supports_read: true,
    supports_create: true,
    supports_messages: 'NONE',
    descriptions: ['Data provider for database `pgsql:omquser@omquser`'],
  };

  /** Stands in for the host's renderer; marks what it drew and how it was asked. */
  const hostRenderer = vi.fn(({ value, compact }: { value: string; compact?: boolean }) => (
    <div className='host-markdown' data-compact={String(!!compact)}>
      {value.replace(/`([^`]+)`/g, '<<$1>>')}
    </div>
  ));

  const renderProvider = ({
    value = stored as Record<string, unknown>,
    readOnly = true,
    withHost = true,
  }: { value?: Record<string, unknown>; readOnly?: boolean; withHost?: boolean } = {}) =>
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            readOnly={readOnly}
            name='action'
            value={{ data_provider: { type: 'data-provider', value } } as never}
            options={
              {
                data_provider: {
                  type: 'data-provider',
                  ui_type: 'data-provider',
                  display_name: 'Data provider',
                },
              } as never
            }
            markdownRenderer={withHost ? hostRenderer : undefined}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

  const inset = async (container: HTMLElement): Promise<HTMLElement> => {
    await waitFor(() =>
      expect(
        container.querySelector('[data-field="data_provider"] .options-readfirst-structured')
      ).toBeTruthy()
    );
    return container.querySelector(
      '[data-field="data_provider"] .options-readfirst-structured'
    ) as HTMLElement;
  };

  it('shows what the provider is, and none of the cached capabilities', async () => {
    const { container } = renderProvider();
    const preview = await inset(container);

    expect(preview.textContent).toContain('datasource');
    expect(preview.textContent).toContain('omquser');
    expect(preview.textContent).toContain('/bb_local');
    for (const cached of [
      'transaction_management',
      'record_requires_search_options',
      'supports_read',
      'supports_create',
      'supports_messages',
      'descriptions',
    ]) {
      expect(preview.textContent).not.toContain(cached);
    }
  });

  it("draws the provider's description through the host's renderer, compact", async () => {
    hostRenderer.mockClear();
    const { container } = renderProvider();
    const preview = await inset(container);

    await waitFor(() => expect(preview.querySelector('.host-markdown')).toBeTruthy());
    expect(hostRenderer).toHaveBeenCalledWith({
      value: 'Data provider for database `pgsql:omquser@omquser`',
      compact: true,
    });
    expect(preview.querySelector('.host-markdown')!.getAttribute('data-compact')).toBe('true');
    expect(preview.querySelector('.host-markdown')!.textContent).toBe(
      'Data provider for database <<pgsql:omquser@omquser>>'
    );
    // the source is never printed beside what the renderer drew
    expect(preview.textContent).not.toContain('`');
  });

  it('reads the description as the prose it renders to where the host draws no markdown', async () => {
    const { container } = renderProvider({ withHost: false });
    const preview = await inset(container);

    await waitFor(() =>
      expect(preview.querySelector('.options-readfirst-provider-desc')?.textContent).toBe(
        'Data provider for database pgsql:omquser@omquser'
      )
    );
    expect(preview.textContent).not.toContain('`');
    expect(preview.querySelector('.host-markdown')).toBeNull();
  });

  it('does the same on an editable row', async () => {
    hostRenderer.mockClear();
    const { container } = renderProvider({ readOnly: false });
    const preview = await inset(container);

    await waitFor(() => expect(preview.querySelector('.host-markdown')).toBeTruthy());
    expect(preview.textContent).not.toContain('`');
    expect(preview.textContent).not.toContain('supports_read');
    expect(preview.textContent).not.toContain('transaction_management');
  });

  it("shows the provider's options, as the values they hold", async () => {
    const { container } = renderProvider({
      value: {
        type: 'factory',
        name: 'db',
        path: '/orders',
        options: { datasource: { type: 'string', value: 'omquser' } },
        supports_read: true,
      },
    });
    const preview = await inset(container);

    expect(preview.textContent).toContain('options');
    expect(preview.textContent).toContain('datasource');
    expect(preview.textContent).toContain('omquser');
    expect(preview.textContent).not.toContain('supports_read');
  });
});

/**
 * The other object-valued types keep the untyped preview, and it never prints a
 * description either: an option envelope's `desc` is part of the envelope the
 * data view unwraps, so only the value it holds is shown.
 */
describe('an options value in a read-first row', () => {
  it("shows each option's value, never its envelope's markdown description", async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            readOnly
            name='connection'
            value={
              {
                opts: {
                  type: 'options',
                  value: {
                    timeout: { type: 'int', value: 30, desc: 'Seconds to wait for `connect()`' },
                  },
                },
              } as never
            }
            options={{ opts: { type: 'options', display_name: 'Options' } } as never}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() =>
      expect(
        container.querySelector('[data-field="opts"] .options-readfirst-structured')
      ).toBeTruthy()
    );
    const preview = container.querySelector(
      '[data-field="opts"] .options-readfirst-structured'
    ) as HTMLElement;
    expect(preview.textContent).toContain('timeout');
    expect(preview.textContent).toContain('30');
    expect(preview.textContent).not.toContain('connect()');
  });
});
