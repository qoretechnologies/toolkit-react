import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine, inheritedScopeFor } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * The bag a field forwards to any sub-form it hosts is a PROP, so its identity
 * is the whole question: a new object every render re-renders the field that
 * receives it forever, over a value that never changed. It was reported as
 * `Template field kind Updated because: {inheritedFromParent}` scrolling past
 * in the console on a form nobody was touching — `kind` declares no
 * `inherit_props` at all, and was still handed `{ ...(undefined ?? {}) }`
 * afresh on every render of the form.
 *
 * These assertions are about identity (`toBe`), not about the values in the
 * bag — the values were always right, and asserting them again would have let
 * the defect through.
 */
const fetchContext = emptyFetchContext();

describe('inheritedScopeFor', () => {
  it('forwards the very bag it was handed when the field adds nothing of its own', () => {
    const fromParent = { language: 'qore' };
    expect(inheritedScopeFor(undefined, undefined, fromParent)).toBe(fromParent);
    expect(inheritedScopeFor({}, undefined, fromParent)).toBe(fromParent);
  });

  it('answers a form with no inherited scope with one shared object, not a new one each time', () => {
    const first = inheritedScopeFor(undefined, undefined, undefined);
    const second = inheritedScopeFor(undefined, undefined, undefined);
    expect(first).toBe(second);
    expect(first).toEqual({});
    // Shared, so nothing downstream may write into it.
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('merges a declared inherit_props over the inherited scope', () => {
    const scope = inheritedScopeFor({ language: 'lang' }, { lang: { value: 'python' } } as never, {
      language: 'qore',
      tenant: 'acme',
    });
    // the sibling's LOCAL value wins, and the rest of the ancestor bag survives
    expect(scope).toEqual({ language: 'python', tenant: 'acme' });
  });

  it('falls back to the ancestor bag when the named sibling has no value here', () => {
    // The ancestor's own entries travel on untouched — the merge ADDS the
    // field's resolved props, it does not replace the scope.
    expect(inheritedScopeFor({ language: 'lang' }, {}, { lang: 'qore' })).toEqual({
      lang: 'qore',
      language: 'qore',
    });
  });
});

const PARENT_SCOPE = { language: 'qore' };

const SCHEMA = {
  kind: {
    type: 'string',
    ui_type: 'plain-editor',
    display_name: 'Kind',
  },
  body: {
    type: 'string',
    ui_type: 'host-editor',
    display_name: 'Body',
    inherit_props: { subjectKind: 'kind' },
  },
} as never;

const VALUE = {
  kind: { type: 'string', value: 'service' },
  body: { type: 'string', value: 'x' },
} as never;

const onChange = vi.fn();

describe('the bag the engine forwards to each field', () => {
  it('is the same object on every render, for a field that declares no inherit_props', async () => {
    const plain: Array<Record<string, unknown> | undefined> = [];
    const host: Array<Record<string, unknown> | undefined> = [];
    const PlainEditor = ({ inheritedFromParent }: any) => {
      plain.push(inheritedFromParent);
      return <div data-testid='plain-editor' />;
    };
    const HostEditor = ({ inheritedFromParent }: any) => {
      host.push(inheritedFromParent);
      return <div data-testid='host-editor' />;
    };
    const overrides = { 'plain-editor': PlainEditor, 'host-editor': HostEditor };

    const Harness = ({ tick }: { tick: number }) => (
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <span data-testid='tick'>{tick}</span>
          <FormEngine
            name='inherited-scope'
            value={VALUE}
            options={SCHEMA}
            inheritedFromParent={PARENT_SCOPE}
            componentOverrides={overrides}
            onChange={onChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    const { findByTestId, rerender } = render(<Harness tick={0} />);
    await findByTestId('plain-editor');
    await findByTestId('host-editor');
    await waitFor(() => expect(plain.at(-1)).toBeDefined());

    // `kind` adds nothing, so it forwards the scope this form was handed —
    // unwrapped, so the field can compare it against what it saw last time.
    expect(plain.at(-1)).toBe(PARENT_SCOPE);

    rerender(<Harness tick={1} />);
    rerender(<Harness tick={2} />);
    await findByTestId('tick');

    expect(plain.length).toBeGreaterThan(0);
    expect(new Set(plain).size).toBe(1);
    // `body` DOES add a prop, so its bag is a merge — and the merge is made
    // once, not per render.
    expect(host.length).toBeGreaterThan(0);
    expect(new Set(host).size).toBe(1);
    expect(host.at(-1)).toEqual({ language: 'qore', subjectKind: 'service' });
  });
});
