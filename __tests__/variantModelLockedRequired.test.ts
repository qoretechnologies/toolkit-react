import { describe, expect, it } from 'vitest';
import {
  buildVariantGroups,
  summarize,
} from '../src/components/form/engine/variants/variantModel';

/**
 * The variants playground's row model follows the engine's rule: a required
 * field locked by an unmet `depends_on` does not need attention, and is
 * required again once its dependency holds.
 */
const OPTIONS = {
  kind: { type: 'string', display_name: 'Kind' },
  expected: { type: 'string', display_name: 'Expected value', required: true, depends_on: ['kind'] },
  min: { type: 'int', display_name: 'Minimum', required: true, depends_on: ['kind=between'] },
} as never;

const rows = (values: Record<string, unknown>) =>
  buildVariantGroups(OPTIONS, values as never).groups.flatMap((group) => group.rows);
const statusOf = (values: Record<string, unknown>, name: string) =>
  rows(values).find((row) => row.name === name)?.status;

describe('the variant row model and locked required fields', () => {
  it('does not ask for a locked required field, but still marks it required', () => {
    const values = { kind: { type: 'string' } };
    expect(statusOf(values, 'expected')).toBe('unset');
    expect(statusOf(values, 'min')).toBe('unset');
    expect(rows(values).find((row) => row.name === 'min')?.required).toBe(true);
    expect(summarize(buildVariantGroups(OPTIONS, values as never).groups).attention).toBe(0);
  });

  it('asks for it once the dependency holds and it is still empty', () => {
    const values = { kind: { type: 'string', value: 'between' } };
    expect(statusOf(values, 'expected')).toBe('todo');
    expect(statusOf(values, 'min')).toBe('todo');
  });

  it('asks only for what the picked kind unlocks', () => {
    const values = { kind: { type: 'string', value: 'equals' } };
    expect(statusOf(values, 'expected')).toBe('todo');
    expect(statusOf(values, 'min')).toBe('unset');
  });
});
