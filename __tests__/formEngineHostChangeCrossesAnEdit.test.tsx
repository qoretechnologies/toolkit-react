// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, waitFor } from '@testing-library/react';
import { useCallback, useMemo, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A change the host makes in the same commit as an edit in the form (qorus#646).
 *
 * The form's emit effect runs before its sync-down. In a commit where both the host's value and the form's
 * own copy had changed, the emit sent the form's copy - built before the host's change - and the sync-down
 * then adopted the host's value. The host stored what it was sent, the form emitted what it had adopted, and
 * the two traded places on every commit, forever, synchronously under `act`. The Qorus IDE's OPC UA node
 * editor froze its story run this way: a namespace renamed by the host while the form held the old one
 * flipped between the two on every render.
 *
 * The host here is the IDE's kind: it stores only fields that hold a value (an empty field is dropped), so
 * the form's rebuild of what it is handed always adds the empty preselected field back and never counts as a
 * mirror.
 */

const OPTIONS = {
  namespace: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Namespace',
    required: true,
    preselected: true,
    sort: 1,
    allowed_values: [
      { display_name: 'old', value: { type: 'string', value: 'urn:old' } },
      { display_name: 'new', value: { type: 'string', value: 'urn:new' } },
    ],
  },
  name: { type: 'string', ui_type: 'probe-text', display_name: 'Name', preselected: true, sort: 2 },
  display_name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Display name',
    preselected: true,
    sort: 3,
  },
} as never;

/** A field editor the test types into from outside: what it reports goes straight to the form. */
const editor: { report?: (value: string) => void } = {};
const ProbeText = ({ onChange }: { onChange: (value: string) => void }) => {
  editor.report = onChange;
  return null;
};

/** How many reports the host takes before the test calls it a loop: a loop would never return from `act`. */
const REPORT_LIMIT = 200;

type TDraft = Record<string, string | undefined>;
const host: {
  draft: TDraft;
  reports: number;
  /** Every name the host was told, in order. */
  names: (string | undefined)[];
  setDraft?: (draft: TDraft) => void;
  /** Switches the form to another record, with that record's value. */
  switchRecord?: (record: number, draft: TDraft) => void;
  setOptions?: (options: Record<string, unknown>) => void;
  /** Called as a report is stored, in the same update. */
  onStore?: () => void;
} = {
  draft: {},
  reports: 0,
  names: [],
};

/**
 * Stores only what holds a value, as the IDE's editors do, and hands it back down - at once, or `echoDelay`
 * ms after it was told, as a host that stores through a debounce of its own does.
 */
const Host = ({
  initial,
  echoDelay = 0,
  identity,
}: {
  initial: TDraft;
  echoDelay?: number;
  /** How the host tells the form it switched records: its `valueKey`, or a React `key`. */
  identity?: 'valueKey' | 'key';
}) => {
  const [draft, setDraft] = useState<TDraft>(initial);
  const [record, setRecord] = useState(1);
  const [options, setOptions] = useState<Record<string, unknown>>(OPTIONS);
  host.draft = draft;
  host.setDraft = setDraft;
  host.setOptions = setOptions;
  host.switchRecord = (next, nextDraft) => {
    setRecord(next);
    setDraft(nextDraft);
  };
  const value = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(draft)
          .filter(([, text]) => text !== undefined && text !== '')
          .map(([key, text]) => [key, { type: 'string', value: text }])
      ),
    [draft]
  );
  const onChange = useCallback((_name: string, next: Record<string, { value?: unknown }>) => {
    host.reports++;
    if (host.reports > REPORT_LIMIT) {
      throw new Error('the form and its host kept trading values');
    }
    host.names.push(next?.name?.value as string | undefined);
    const store = () => {
      host.onStore?.();
      setDraft((previous) => {
        const updated: TDraft = {};
        for (const [key, field] of Object.entries(next ?? {})) {
          const text = field?.value;
          if (text !== undefined && text !== null && text !== '') {
            updated[key] = String(text);
          }
        }
        return JSON.stringify(updated) === JSON.stringify(previous) ? previous : updated;
      });
    };
    if (echoDelay) {
      setTimeout(store, echoDelay);
    } else {
      store();
    }
  }, []);
  return (
    <FormEngine
      key={identity === 'key' ? record : undefined}
      valueKey={identity === 'valueKey' ? record : undefined}
      compact
      name='node'
      value={value as never}
      options={options as never}
      componentOverrides={{ 'probe-text': ProbeText }}
      // the editor's name, not a type a value is stored as: as the IDE registers its own editors
      rendererOnlyUiTypes={['probe-text']}
      // the name's editor is open, as the user's is while they type into it
      initialExpandedOptions={['name']}
      onChange={onChange as never}
    />
  );
};

const renderHost = async (initial: TDraft, echoDelay = 0, identity?: 'valueKey' | 'key') => {
  host.reports = 0;
  host.names = [];
  host.onStore = undefined;
  editor.report = undefined;
  // a host that echoes late is driven on fake timers from the start, so its every echo is the test's to run
  if (echoDelay) {
    vi.useFakeTimers();
  }
  const view = render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <Host initial={initial} echoDelay={echoDelay} identity={identity} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  if (echoDelay) {
    // the form settles, and the host stores what the form reported on its way in
    await pass(500);
    expect(editor.report).toBeTruthy();
  } else {
    await waitFor(() => expect(editor.report).toBeTruthy());
  }
  return view;
};

/**
 * Lets `ms` of fake time pass in 10 ms steps, each in an `act` of its own: what the host stores in one step is
 * committed - and answered by the form - before the next, as it would be on a page. One `act` around the
 * whole stretch would hold every update to its end and commit them as one.
 */
const pass = async (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 10) {
    await act(() => vi.advanceTimersByTimeAsync(10));
  }
};

describe('a host change in the same commit as an edit in the form', () => {
  it('settles on the host change and the edit both, instead of trading them forever', async () => {
    await renderHost({ namespace: 'urn:old' });

    // the host renames the namespace as the user's edit to the name reaches the form: one commit
    act(() => {
      host.setDraft!({ namespace: 'urn:new' });
      editor.report!('Speed');
    });

    expect(host.reports).toBeLessThan(REPORT_LIMIT);
    await waitFor(() => expect(host.draft).toEqual({ namespace: 'urn:new', name: 'Speed' }));
  });

  it('takes a host change on its own, as before', async () => {
    await renderHost({ namespace: 'urn:old', name: 'Speed' });

    act(() => host.setDraft!({ namespace: 'urn:new', name: 'Speed' }));

    await waitFor(() => expect(host.draft).toEqual({ namespace: 'urn:new', name: 'Speed' }));
    expect(host.reports).toBeLessThan(REPORT_LIMIT);
  });

  it('takes an edit on its own, as before', async () => {
    await renderHost({ namespace: 'urn:old' });

    act(() => editor.report!('Speed'));

    await waitFor(() => expect(host.draft).toEqual({ namespace: 'urn:old', name: 'Speed' }));
    expect(host.reports).toBeLessThan(REPORT_LIMIT);
  });
});

describe('a host that hands its value back late', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never takes the late echo of an older report for the value', async () => {
    // The echo of "a" arrives after "ab" was reported. It is the form's own report coming back, not the
    // host's change; resetting the form to it lost the "b", and with a host that drops empty fields the
    // form then reported "a" again, and the two reports chased each other on every echo.
    await renderHost({ namespace: 'urn:old' }, 50);

    act(() => editor.report!('a'));
    // "ab" 20 ms later: the echo of "a" comes back while "ab" is on its way
    await pass(20);
    act(() => editor.report!('ab'));
    await pass(1000);

    expect(host.draft).toEqual({ namespace: 'urn:old', name: 'ab' });
    // once "ab" was reported, nothing older was
    const firstAb = host.names.indexOf('ab');
    expect(firstAb).toBeGreaterThan(-1);
    expect(host.names.slice(firstAb).every((name) => name === 'ab')).toBe(true);
    expect(host.reports).toBeLessThan(10);
  });
});

describe('a schema change that arrives with the echo of a report', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds what the new schema asks for to the form, and keeps the edits made since the report', async () => {
    await renderHost({ namespace: 'urn:old' }, 50);
    // the host stores the first report and, in the same update, its schema gains a field with a default
    let stores = 0;
    host.onStore = () => {
      stores++;
      if (stores === 1) {
        host.setOptions!({
          ...(OPTIONS as Record<string, unknown>),
          unit: {
            type: 'string',
            ui_type: 'string',
            display_name: 'Unit',
            preselected: true,
            default_value: 'm/s',
            sort: 4,
          },
        });
      }
    };

    act(() => editor.report!('a'));
    await pass(20);
    act(() => editor.report!('ab'));
    await pass(1000);

    expect(host.draft).toEqual({ namespace: 'urn:old', name: 'ab', unit: 'm/s' });
    expect(host.reports).toBeLessThan(10);
  });
});

describe('a host that switches the form to another record', () => {
  it.each(['valueKey', 'key'] as const)(
    'starts the new record clean, with an edit to the old one in flight (%s)',
    async (identity) => {
      await renderHost({ namespace: 'urn:old' }, 0, identity);

      // the edit to record 1 reaches the form in the same commit as the switch to record 2
      act(() => {
        host.switchRecord!(2, { namespace: 'urn:new' });
        editor.report!('Speed');
      });

      await waitFor(() => expect(host.draft).toEqual({ namespace: 'urn:new' }));
      expect(host.reports).toBeLessThan(REPORT_LIMIT);
      // the old record's edit is nowhere in the new record, now or after the form settles
      await act(async () => undefined);
      expect(host.draft).toEqual({ namespace: 'urn:new' });
    }
  );
});
