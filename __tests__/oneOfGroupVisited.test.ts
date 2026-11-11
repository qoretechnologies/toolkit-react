// Copyright 2026 Qore Technologies, s.r.o.
/*
 * A one-of group (`required_groups`) is one requirement: its members are still to fill in together, and become
 * faults together once anyone has been to the group, so a member's words, its color and the readiness line's
 * count agree (Qlip build 482: four amber members beside "1 need attention · 4 to fill in").
 */
import { describe, expect, it } from 'vitest';
import { hasBeenToTheField } from '../src/components/form/engine/readFirst';

const groupMembers = { first: ['a', 'b', 'c'], second: ['c', 'd'] };

describe('whether a field has been to', () => {
  it('is its own visit, or a refused save', () => {
    expect(hasBeenToTheField('x', { visitedOptions: ['x'] })).toBe(true);
    expect(hasBeenToTheField('x', { visitedOptions: [] })).toBe(false);
    expect(hasBeenToTheField('x', { visitedOptions: [], revealRequired: true })).toBe(true);
  });

  it('is, for a one-of member, a visit to any member of its group', () => {
    const visit = { visitedOptions: ['b'], groupMembers };
    expect(hasBeenToTheField('a', { ...visit, requiredGroups: ['first'] })).toBe(true);
    // in both groups: the first has been to
    expect(hasBeenToTheField('c', { ...visit, requiredGroups: ['first', 'second'] })).toBe(true);
    // the second group nobody has been to is still to fill in
    expect(hasBeenToTheField('d', { ...visit, requiredGroups: ['second'] })).toBe(false);
  });
});
