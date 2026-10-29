// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What the form completes while its host shows the skeleton is emitted when the skeleton clears (qorus#646).
 *
 * The form emits nothing while its host's skeleton is up: a value read against a schema the host is still
 * loading is no answer, and emitting it wiped a Qog state's stored options. But hosts show the skeleton for
 * other waits too: qorus-ide shows it while the templates load, with the schema already there. The form
 * completed the value meanwhile (a required field's default, e.g. the server's `created_by_user`), and the
 * skeleton clearing re-ran nothing: the default was shown and never reached the host, so it was not saved
 * (qorus-ide's "Interfaces › Installed Release › Existing" waited for it forever).
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const form = (props: Record<string, unknown>) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext}>
      <FormEngine compact name='skeleton-clears' {...props} />
    </FetchContext.Provider>
  </ReqoreUIProvider>
);

/** Lets every effect of the last render, and what they scheduled, run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const fieldsEmitted = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.map(
    ([, fields]) => fields as Record<string, { value?: unknown }> | undefined
  );

describe('a form whose host shows the skeleton for another wait', () => {
  const SCHEMA = {
    display_name: { type: 'string', display_name: 'Display Name', required: true },
    created_by_user: {
      type: 'string',
      display_name: 'Created By',
      required: true,
      default_value: 'admin',
    },
  } as never;
  const VALUE = {
    display_name: { type: 'string', value: 'Regression Installed Release' },
  } as never;

  it('emits the default it filled in once the skeleton clears, and not before', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      form({ skeleton: true, options: SCHEMA, value: VALUE, onChange })
    );
    await waitFor(() =>
      expect(container.querySelector('.options-loading-skeleton')).not.toBeNull()
    );
    await settle();
    expect(onChange).not.toHaveBeenCalled();

    rerender(form({ skeleton: false, options: SCHEMA, value: VALUE, onChange }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const [emitted] = fieldsEmitted(onChange);
    expect(emitted?.created_by_user?.value).toBe('admin');
    expect(emitted?.display_name?.value).toBe('Regression Installed Release');

    await settle();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('emits the same as a form that never showed the skeleton', async () => {
    const onChange = vi.fn();
    render(form({ skeleton: false, options: SCHEMA, value: VALUE, onChange }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(fieldsEmitted(onChange)[0]?.created_by_user?.value).toBe('admin');
  });
});

describe('a form whose host loads its schema behind the skeleton', () => {
  const SCHEMA = {
    limit: { type: 'int', display_name: 'Limit' },
    where_cond: { type: 'hash', display_name: 'Where Condition' },
    mode: { type: 'string', display_name: 'Mode', required: true, default_value: 'fast' },
  } as never;
  const STORED = {
    limit: { type: 'int', value: 10 },
    where_cond: { type: 'hash', value: { exp: 'EQUALS', args: [] }, is_expression: true },
  } as never;

  it.each([
    ['no schema', {}],
    ['another schema', { other: { type: 'string', display_name: 'Other' } }],
  ])(
    'keeps the stored options when the schema arrives with the skeleton cleared, read before against %s',
    async (_name, before) => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        form({ skeleton: true, options: before, value: STORED, onChange })
      );
      await waitFor(() =>
        expect(container.querySelector('.options-loading-skeleton')).not.toBeNull()
      );
      await settle();
      expect(onChange).not.toHaveBeenCalled();

      rerender(form({ skeleton: false, options: SCHEMA, value: STORED, onChange }));
      await waitFor(() => expect(container.textContent).toContain('Limit'));
      await waitFor(() => expect(onChange).toHaveBeenCalled());
      await settle();
      // every emit holds the stored options; the schema's default is added to them
      for (const fields of fieldsEmitted(onChange)) {
        expect(fields?.limit?.value).toBe(10);
        expect(fields?.where_cond?.value).toEqual({ exp: 'EQUALS', args: [] });
        expect(fields?.mode?.value).toBe('fast');
      }
    }
  );

  it('shows the stored options once the schema arrives', async () => {
    // Read against the empty schema handed down while it loaded, every stored field was "not on this
    // instance" and was removed from the form: it emitted nothing, but showed Limit empty, and the next edit
    // would have been emitted without the others. (A schema that adds no default: one that does has the
    // value read again, and that put them back.)
    const { mode: _mode, ...schemaWithoutDefaults } = SCHEMA as Record<string, unknown>;
    const onChange = vi.fn();
    const { container, rerender } = render(
      form({ skeleton: true, options: {}, value: STORED, onChange })
    );
    await waitFor(() =>
      expect(container.querySelector('.options-loading-skeleton')).not.toBeNull()
    );
    await settle();
    rerender(form({ skeleton: false, options: schemaWithoutDefaults, value: STORED, onChange }));
    await waitFor(() =>
      expect(container.querySelector('.readfirst-row[data-field="limit"]')?.textContent).toContain(
        '10'
      )
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
