import { describe, expect, it } from 'vitest';
import { flatten } from 'lodash';
import { parseDependency } from '../src/helpers/validations';

/**
 * Which option does a `depends_on` entry name?
 *
 * The form clears a dependent's value when the option it depends ON changes.
 * That lookup compared each entry to the option name as a WHOLE STRING, so only
 * the bare spelling ever matched: a field declared
 * `depends_on: ['subject_iface_kind=workflow']` was never cleared.
 *
 * What it cost: a test whose subject was switched from a workflow to a service
 * kept the workflow's `Subject Interface Version`. Services and jobs are
 * versioned but only the latest is testable, so the field no longer applied —
 * yet a field holding a value is deliberately NOT withheld (hiding it would
 * orphan a value still being submitted), so it stayed as a locked control in
 * front of a value the author could not clear.
 */
/** Exactly what the form engine does when deciding which dependents to clear. */
const names = (dependsOn: unknown[], optionName: string): boolean =>
  flatten(dependsOn).some(
    (dependency) => parseDependency(dependency as string).name === optionName
  );

describe('finding which option a dependency names', () => {
  it('matches the bare spelling', () => {
    expect(names(['subject_iface_name'], 'subject_iface_name')).toBe(true);
  });

  it('matches `name=value`, which a whole-string compare never did', () => {
    expect(names(['subject_iface_kind=workflow'], 'subject_iface_kind')).toBe(true);
    expect(['subject_iface_kind=workflow'].includes('subject_iface_kind')).toBe(false);
  });

  it('matches `name!=value` too', () => {
    expect(names(['subject_iface_kind!=type'], 'subject_iface_kind')).toBe(true);
  });

  it('matches when only one entry of several names the option', () => {
    // The real shape: one entry per versioned kind, plus a sibling.
    const dependsOn = [
      'subject_iface_kind=class',
      'subject_iface_kind=workflow',
      'subject_iface_name',
    ];

    expect(names(dependsOn, 'subject_iface_kind')).toBe(true);
    expect(names(dependsOn, 'subject_iface_name')).toBe(true);
  });

  it('matches through a NESTED any-of group, which is the real served shape', () => {
    /* Verified against the live creator socket: `subject_iface_version` arrives as
       [[kind=class, …, kind=workflow], "subject_iface_name"] — the inner list is an
       ANY group, so the entries are one level down and a flat scan would miss them. */
    const served = [
      [
        'subject_iface_kind=class',
        'subject_iface_kind=constant',
        'subject_iface_kind=function',
        'subject_iface_kind=mapper',
        'subject_iface_kind=mapper-code',
        'subject_iface_kind=step',
        'subject_iface_kind=workflow',
      ],
      'subject_iface_name',
    ];

    expect(names(served, 'subject_iface_kind')).toBe(true);
    expect(names(served, 'subject_iface_name')).toBe(true);
    expect(names(served, 'subject_iface_version')).toBe(false);
  });

  it('does not match an option the dependency does not name', () => {
    expect(names(['subject_iface_kind=workflow'], 'subject_iface_version')).toBe(false);
    expect(names(['subject_iface_kind=workflow'], 'kind')).toBe(false);
  });
});
