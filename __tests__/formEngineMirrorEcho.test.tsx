/**
 * A form must not repeat the parent's own value back at it.
 *
 * `localValue` is derived state — the sync-down effect rebuilds it from the
 * `value` prop through `fixOptions`. When that rebuild adds nothing, the result
 * says exactly what the parent already holds, and emitting it is not an answer
 * from the form.
 *
 * Emitting it anyway is harmless in a form that owns its state outright, and
 * fatal in one that shares a parent with a NESTED engine. Both write the same
 * parent value, so each sees the other's write arrive as an external change and
 * `lastEmittedValue` — the guard meant to catch "the parent echoed us" — is
 * always one step behind, so it never fires. The two engines then alternate
 * between two states several times a second, forever, each overwriting the
 * other's newer write with its own older one.
 *
 * That is what made the Qorus test editor unusable: inserting the "Call the
 * service you are testing" worked example left the setup row's summary flipping
 * between two readings indefinitely, and `setTimeout` starved past a 45-second
 * deadline.
 *
 * The two halves have to hold together, which is what these gates pin:
 *   - a rebuild that CHANGES NOTHING is not emitted;
 *   - a rebuild that RESTORES a default still is, because that default is
 *     genuinely new information the parent has to be told about. Suppressing
 *     everything would "fix" the loop by breaking the reason the sync-down runs
 *     `fixOptions` at all.
 *
 * The RENDERED tests below pin the rules but cannot reproduce the interleaving:
 * that needs the emit to be decided against a `value` newer than the
 * `localValue` built from it, which only happens when two components' effects
 * land in one React commit — and a test renderer flushes effects between
 * updates, so the two never fall out of step. Those tests pass against the
 * unfixed engine too, which is exactly why they are not the gate.
 *
 * The gate is the last block in this file. `shouldEmitLocalValue` is the
 * decision itself, extracted and pure, exercised with the states recorded from
 * a live instrumented run. Removing the mirror check from it turns that block
 * red, which is the property these tests exist to have.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  agreementFromRebuild,
  FormEngine,
  isMirrorOfValue,
  shouldEmitLocalValue,
} from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/** A plain field, and one carrying a default the form is expected to restore. */
const SCHEMA = {
  name: { type: 'string', display_name: 'Name' },
  mode: {
    type: 'string',
    display_name: 'Mode',
    preselected: true,
    default_value: { type: 'string', value: 'simulate' },
  },
} as never;

const renderForm = (value: unknown, onChange: (...args: unknown[]) => void) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='mirror-test'
          value={value as never}
          options={SCHEMA}
          onChange={onChange as never}
          compactCollapsedGroups={[]}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** A value that already carries everything `fixOptions` would add. */
const SETTLED = {
  name: { type: 'string', value: 'my-test' },
  mode: { type: 'string', value: 'simulate' },
};

describe('a form does not echo the value it was given', () => {
  it('emits nothing when an external write needs no defaults added', async () => {
    const onChange = vi.fn();
    const { rerender } = renderForm(SETTLED, onChange);

    // Let the form settle on the value it was handed.
    await waitFor(() => expect(onChange).not.toHaveBeenCalled());

    // Somebody else — a nested engine sharing this parent's state — writes.
    // Nothing here is missing, so the rebuild changes nothing and this form has
    // no answer of its own to contribute.
    const external = { ...SETTLED, name: { type: 'string', value: 'renamed-elsewhere' } };
    rerender(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='mirror-test'
            value={external as never}
            options={SCHEMA}
            onChange={onChange as never}
            compactCollapsedGroups={[]}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    // Give every effect a chance to run and emit before asserting silence.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('still emits a default it had to restore', async () => {
    const onChange = vi.fn();
    // `mode` is missing, so the rebuild genuinely adds something.
    renderForm({ name: { type: 'string', value: 'my-test' } }, onChange);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const emitted = onChange.mock.calls[onChange.mock.calls.length - 1][1] as Record<
      string,
      { value: unknown }
    >;
    expect(emitted.mode?.value).toBe('simulate');
  });

  it('settles: a restored default is emitted once, not on every pass', async () => {
    const onChange = vi.fn();
    renderForm({ name: { type: 'string', value: 'my-test' } }, onChange);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const afterFirst = onChange.mock.calls.length;

    // The parent applies what it was told, exactly as a controlled host does.
    // That echo must end the exchange rather than start another round.
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(onChange.mock.calls.length).toBe(afterFirst);
  });
});


/**
 * The topology that actually broke: ONE parent value, TWO writers.
 *
 * `SecondWriter` stands in for the nested engine (the step drawer). It wants a
 * key the parent value does not have yet and writes it exactly once — the same
 * shape as `fixOptions` materialising a `required_groups` field's default into
 * a row that lacks it.
 *
 * The form must let that write STICK. Echoing its own older mirror back over it
 * restarts the second writer, and the two alternate forever.
 */
const SharedValueHost = ({
  onSettle,
}: {
  onSettle: (state: Record<string, any>, writes: number) => void;
}) => {
  const [state, setState] = useState<Record<string, any>>({
    name: { type: 'string', value: 'my-test' },
    mode: { type: 'string', value: 'simulate' },
    cases: { type: 'list', value: [{ kind: 'service-method' }] },
  });
  const writes = useRef(0);

  // The other writer: adds its key when it is missing, and only then.
  useEffect(() => {
    if (state.cases?.value?.[0]?.enriched) {
      return;
    }
    if (writes.current > 40) {
      return; // runaway guard, so a failure reports rather than hangs
    }
    writes.current += 1;
    setState((current) => ({
      ...current,
      cases: {
        type: 'list',
        value: [{ ...current.cases.value[0], enriched: true }],
      },
    }));
  }, [state]);

  useEffect(() => {
    onSettle(state, writes.current);
  }, [state, onSettle]);

  return (
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='shared-value'
          value={state as never}
          options={{ ...(SCHEMA as any), cases: { type: 'list', display_name: 'Cases' } } as never}
          onChange={((_n: string, v: Record<string, any>) => setState(v)) as never}
          compactCollapsedGroups={[]}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

describe('two writers sharing one value reach a fixed point', () => {
  it("does not overwrite another writer's newer value with its own older mirror", async () => {
    let last: Record<string, any> = {};
    let writes = 0;
    render(
      <SharedValueHost
        onSettle={(state, w) => {
          last = state;
          writes = w;
        }}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 400));

    // The other writer's value survived...
    expect(last.cases?.value?.[0]?.enriched).toBe(true);
    // ...and it only had to say it once. More than a couple of writes means the
    // form reverted it and the two are trading the value back and forth.
    expect(writes).toBeLessThanOrEqual(2);
  });
});


/**
 * The decision itself, against the states a live instrumented run recorded.
 *
 * Two engines shared one parent value. Every cycle logged the same shape:
 *
 *   RQ_SYNC {"val":"<absent>","fixed":"<absent>","lastEmit":"user",     "eqFixed":true,"eqLast":false}
 *   RQ_SYNC {"val":"user",    "fixed":"user",    "lastEmit":"<absent>", "eqFixed":true,"eqLast":false}
 *
 * `eqFixed` always true — the rebuild added nothing, so it was a mirror every
 * time. `eqLast` always false — the other engine's write had already landed, so
 * the value coming down was never the one this form last sent up. Below, `A` is
 * what this form mirrored and `B` is the other engine's newer write.
 */
const A = {
  service: { type: 'string', value: 'qorus-saas' },
};
const B = {
  service: { type: 'string', value: 'qorus-saas' },
  service_type: { type: 'string', value: 'user' },
};

describe('shouldEmitLocalValue', () => {
  it('does not emit a mirror over a newer value — the recorded loop', () => {
    // The form mirrored A; by the time the emit is decided, the parent already
    // holds B. Emitting A here is what overwrote the newer write, forever.
    expect(shouldEmitLocalValue({ localValue: A, value: B, mirroredValue: A })).toBe(false);
  });

  it('emits a value the form actually produced, even though a mirror was recorded', () => {
    // The author edited: `localValue` is no longer the mirror, so it is an
    // answer and has to reach the parent. Suppressing this would trade the loop
    // for a form that silently drops edits.
    const edited = { ...B, service: { type: 'string', value: 'other-service' } };
    expect(shouldEmitLocalValue({ localValue: edited, value: B, mirroredValue: A })).toBe(true);
  });

  it('emits a restored default when the last rebuild contributed one', () => {
    // A rebuild that added something records no mirror, so the default reaches
    // the parent — the whole reason the sync-down runs `fixOptions`.
    expect(shouldEmitLocalValue({ localValue: B, value: A, mirroredValue: undefined })).toBe(true);
  });

  it('stays silent when there is simply nothing to report', () => {
    expect(shouldEmitLocalValue({ localValue: B, value: B, mirroredValue: undefined })).toBe(false);
  });

  it('is not confused by a mirror recorded for some earlier state', () => {
    // `mirroredValue` is stale but `localValue` has moved on; the second check
    // still has to do its job.
    expect(shouldEmitLocalValue({ localValue: B, value: B, mirroredValue: A })).toBe(false);
  });
});

describe('isMirrorOfValue', () => {
  it('calls a rebuild that added nothing a mirror', () => {
    expect(isMirrorOfValue(A, A)).toBe(true);
  });

  it('does not call a restored default a mirror', () => {
    expect(isMirrorOfValue(B, A)).toBe(false);
  });

  it('ignores the empty-value round trip fixOptions performs', () => {
    // `fixOptions` moves a required-empty field between `{ value: '' }` and no
    // `value` key. Reading that as new information re-fixes forever.
    expect(
      isMirrorOfValue({ note: { type: 'string', value: '' } }, { note: { type: 'string' } } as never)
    ).toBe(true);
  });
});

describe('agreementFromRebuild', () => {
  it('records adopting the parent value as an agreement', () => {
    // The half that is easy to leave out. Holding the mirror back without
    // recording the agreement leaves the sync-down unable to skip ever again,
    // and was measured turning ~8 s of starvation into a 45 s timeout — worse
    // than the bug it was meant to fix.
    expect(agreementFromRebuild(A, A)).toEqual(A);
  });

  it('agrees on nothing when the rebuild contributed a default', () => {
    // B carries a restored default A does not, so there is no agreement yet —
    // the parent still has to be told.
    expect(agreementFromRebuild(B, A)).toBeUndefined();
  });
});
