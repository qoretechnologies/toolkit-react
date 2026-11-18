import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A host-injected editor is told when the field's own management is locked.
 *
 * `disableManagement` says the value may be picked but not managed: no editing of what it names and no creating of
 * a new one. It is destructured into a named prop, so it never reached a host editor - the IDE's connection
 * editor, which the IDE's "create an option's value" form locks to the step's connection so the value is created
 * there and nowhere else, kept offering "Edit connection" and "Create new connection" (qorus#683, qorus-ide#646).
 */
const schema = (disableManagement?: boolean) =>
  ({
    connection: {
      type: 'connection',
      display_name: 'Connection',
      ...(disableManagement === undefined ? {} : { disableManagement }),
    },
  }) as never;

const VALUE = { connection: { type: 'connection', value: 'discord-main' } } as never;

const renderWithHost = (
  disableManagement: boolean | undefined,
  record: (props: Record<string, unknown>) => void
) => {
  const Host = (props: Record<string, unknown>) => {
    record(props);
    return <div>host editor</div>;
  };
  return render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          name='test'
          value={VALUE}
          options={schema(disableManagement)}
          onChange={vi.fn()}
          componentOverrides={{ connection: Host }}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

describe('a host-injected editor of a field whose management is locked', () => {
  it('is handed disableManagement', async () => {
    let props: Record<string, unknown> = {};
    const { container } = renderWithHost(true, (p) => (props = p));
    await waitFor(() => expect(container.textContent).toContain('host editor'));

    expect(props.disableManagement).toBe(true);
  });

  it('is not told it is locked when the field is not', async () => {
    let props: Record<string, unknown> = {};
    const { container } = renderWithHost(undefined, (p) => (props = p));
    await waitFor(() => expect(container.textContent).toContain('host editor'));

    expect(props.disableManagement).toBeFalsy();
  });
});
