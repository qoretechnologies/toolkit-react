import { describe, expect, it } from 'vitest';
import { hasAllDependenciesFullfilled, parseDependency } from '../src/helpers/validations';

/**
 * The `depends_on` grammar, and the two ways it used to mean different things in
 * different places.
 *
 * 1. A `name=value` entry inside a nested ANY list was looked up as if the whole
 *    string were a field name. No field is called `type=cookie`, so the lookup
 *    missed and the entry returned `true` unconditionally — an any-of group of
 *    value comparisons was satisfied by nothing at all, while `CompactRow`
 *    rendered those same entries in the lock as real comparisons. Both sides now
 *    go through `parseDependency`.
 *
 * 2. There was no way to say "answered, and not this answer". Spelling it as an
 *    any-of list of every other value is unreadable in the lock and silently
 *    wrong the moment a value is added — which is exactly the shape a test's
 *    subject field needs: it applies to every subject kind except `type`, whose
 *    subjects are selected by path instead of by name.
 */

const form = (values: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, { type: 'string', value }])
  ) as never;

const schema = { kind: { type: 'string' }, name: { type: 'string' } } as never;

describe('parseDependency', () => {
  it('reads the three forms', () => {
    expect(parseDependency('kind')).toEqual({ name: 'kind' });
    expect(parseDependency('kind=type')).toEqual({ name: 'kind', op: '=', value: 'type' });
    expect(parseDependency('kind!=type')).toEqual({ name: 'kind', op: '!=', value: 'type' });
  });

  it('does not read the "!" of "!=" as part of the field name', () => {
    // `indexOf('=')` alone would split `kind!=type` into `kind!` and `=type`
    expect(parseDependency('kind!=type').name).toBe('kind');
    expect(parseDependency('kind!=type').value).toBe('type');
  });
});

describe('hasAllDependenciesFullfilled', () => {
  it('treats no dependencies as fulfilled', () => {
    expect(hasAllDependenciesFullfilled([], form({}), schema)).toBe(true);
  });

  it('requires a bare name to have a value', () => {
    expect(hasAllDependenciesFullfilled(['kind'], form({ kind: 'fsm' }), schema)).toBe(true);
    expect(hasAllDependenciesFullfilled(['kind'], form({ kind: '' }), schema)).toBe(false);
  });

  it('requires name=value to match exactly', () => {
    expect(hasAllDependenciesFullfilled(['kind=type'], form({ kind: 'type' }), schema)).toBe(true);
    expect(hasAllDependenciesFullfilled(['kind=type'], form({ kind: 'fsm' }), schema)).toBe(false);
    expect(hasAllDependenciesFullfilled(['kind=type'], form({}), schema)).toBe(false);
  });

  it('reads name!=value as "answered, and not that answer"', () => {
    expect(hasAllDependenciesFullfilled(['kind!=type'], form({ kind: 'fsm' }), schema)).toBe(true);
    expect(hasAllDependenciesFullfilled(['kind!=type'], form({ kind: 'type' }), schema)).toBe(false);
    // unanswered does NOT satisfy it: a field that applies to "any kind but type"
    // must stay locked until a kind is chosen, not unlock on an empty form
    expect(hasAllDependenciesFullfilled(['kind!=type'], form({}), schema)).toBe(false);
  });

  it('applies the comparison forms inside a nested any-of list', () => {
    const anyOf = [['kind=workflow', 'kind=service']];
    expect(hasAllDependenciesFullfilled(anyOf, form({ kind: 'workflow' }), schema)).toBe(true);
    expect(hasAllDependenciesFullfilled(anyOf, form({ kind: 'service' }), schema)).toBe(true);
    // the regression: this returned true, because `kind=fsm` matched no field name
    expect(hasAllDependenciesFullfilled(anyOf, form({ kind: 'fsm' }), schema)).toBe(false);
    expect(hasAllDependenciesFullfilled(anyOf, form({}), schema)).toBe(false);
  });

  it('requires every top-level entry, with a nested list as one of them', () => {
    // the shape a test's subject version field declares: one of the versioned
    // kinds, AND a name to attach a version to
    const deps = [['kind=workflow', 'kind=service'], 'name'];
    expect(
      hasAllDependenciesFullfilled(deps, form({ kind: 'workflow', name: 'ORDER-INTAKE' }), schema)
    ).toBe(true);
    expect(hasAllDependenciesFullfilled(deps, form({ kind: 'workflow', name: '' }), schema)).toBe(
      false
    );
    expect(hasAllDependenciesFullfilled(deps, form({ kind: 'fsm', name: 'a' }), schema)).toBe(false);
  });

  it('treats a bare name with no entry in the form at all as fulfilled', () => {
    // Long-standing behaviour, relied on across the product: a bare name gates on
    // the sibling's VALUE, and a field the form has not materialized has no value
    // to judge. In practice the sibling is `required` or `preselected`, so it is
    // materialized empty and correctly fails validation — which is why a field
    // that means to gate on a bare name has to make sure its sibling is one of
    // those. The comparison forms do not share this: `kind=x` and `kind!=x` are
    // both false on an unanswered `kind`, which is asserted above.
    expect(hasAllDependenciesFullfilled(['name'], form({}), schema)).toBe(true);
    expect(hasAllDependenciesFullfilled(['name'], form({ name: '' }), schema)).toBe(false);
  });
});
