/**
 * Unit tests for src/components/form/engine/readFirst.ts — the pure helpers
 * behind the FormEngine `compact` (read-first) mode.
 *
 * Each test calls real production code and asserts on actual behaviour.
 * Breaking the implementation must cause at least one test to fail.
 */

import {
  formatOptionValue,
  getOptionGroup,
  getOptionGroupLabel,
  getReadFirstCompletion,
  isOptionValueEmpty,
} from '../src/components/form/engine/readFirst';

describe('isOptionValueEmpty', () => {
  it('treats nullish, empty string and empty array as empty', () => {
    expect(isOptionValueEmpty(undefined)).toBe(true);
    expect(isOptionValueEmpty(null)).toBe(true);
    expect(isOptionValueEmpty('')).toBe(true);
    expect(isOptionValueEmpty([])).toBe(true);
  });

  it('treats real values (including 0 and false) as set', () => {
    expect(isOptionValueEmpty(0)).toBe(false);
    expect(isOptionValueEmpty(false)).toBe(false);
    expect(isOptionValueEmpty('x')).toBe(false);
    expect(isOptionValueEmpty(['a'])).toBe(false);
  });
});

describe('formatOptionValue', () => {
  it('returns an empty string when nothing is set', () => {
    expect(formatOptionValue({ type: 'string', value: '' })).toBe('');
    expect(formatOptionValue({ type: 'list', value: [] })).toBe('');
    expect(formatOptionValue(undefined)).toBe('');
  });

  it('formats booleans as Yes / No', () => {
    expect(formatOptionValue({ type: 'bool', value: true })).toBe('Yes');
    expect(formatOptionValue({ type: 'bool', value: false })).toBe('No');
  });

  it('resolves allowed_values to their display label', () => {
    const schema: any = {
      type: 'string',
      ui_type: 'string',
      allowed_values: [
        { value: { type: 'string', value: 'qore' }, display_name: 'Qore' },
        { value: { type: 'string', value: 'python' }, display_name: 'Python' },
      ],
    };
    expect(formatOptionValue({ type: 'string', value: 'python' }, schema)).toBe('Python');
  });

  it('falls back to the raw value when no allowed_value matches', () => {
    const schema: any = {
      type: 'string',
      allowed_values: [{ value: { type: 'string', value: 'qore' }, display_name: 'Qore' }],
    };
    expect(formatOptionValue({ type: 'string', value: 'unknown' }, schema)).toBe('unknown');
  });

  it('joins list item names', () => {
    expect(formatOptionValue({ type: 'list', value: ['a', 'b', 'c'] })).toBe('a, b, c');
    expect(
      formatOptionValue({ type: 'list', value: [{ name: 'one' }, { value: 'two' }] })
    ).toBe('one, two');
  });

  it('summarises a list of unnameable objects by count', () => {
    expect(formatOptionValue({ type: 'list', value: [{}, {}] })).toBe('2 items');
    expect(formatOptionValue({ type: 'list', value: [{}] })).toBe('1 item');
  });

  it('marks expression values', () => {
    expect(
      formatOptionValue({ type: 'string', value: 'anything', is_expression: true })
    ).toBe('Expression');
  });

  it('collapses opaque hash values to a generic marker', () => {
    expect(formatOptionValue({ type: 'hash', value: { a: 1 } })).toBe('Set');
  });

  it('stringifies scalars', () => {
    expect(formatOptionValue({ type: 'number', value: 42 })).toBe('42');
    expect(formatOptionValue({ type: 'string', value: 'hello' })).toBe('hello');
  });
});

describe('getOptionGroup', () => {
  it('returns the raw server group key', () => {
    expect(getOptionGroup({ group: 'info' } as any)).toBe('info');
    expect(getOptionGroup({ group: 'business_context' } as any)).toBe('business_context');
    expect(getOptionGroup({ group: '  scaling  ' } as any)).toBe('scaling');
  });

  it('routes ungrouped required/preselected fields to "general"', () => {
    expect(getOptionGroup({ type: 'string', required: true } as any)).toBe('general');
    expect(getOptionGroup({ type: 'string', preselected: true } as any)).toBe('general');
    expect(getOptionGroup({ type: 'string', required_groups: ['g'] } as any)).toBe('general');
  });

  it('routes other ungrouped fields to "optional"', () => {
    expect(getOptionGroup({ type: 'string' } as any)).toBe('optional');
    expect(getOptionGroup(undefined)).toBe('optional');
  });
});

describe('getOptionGroupLabel', () => {
  it('title-cases the raw key when no consumer label is given', () => {
    expect(getOptionGroupLabel('info')).toBe('Info');
    expect(getOptionGroupLabel('business_context')).toBe('Business Context');
    expect(getOptionGroupLabel('optional')).toBe('Optional');
  });

  it('prefers a consumer-supplied label from the groups config', () => {
    expect(getOptionGroupLabel('info', { info: { label: 'Identity' } })).toBe('Identity');
    // falls through to title-case when the key is absent from the config
    expect(getOptionGroupLabel('scaling', { info: { label: 'Identity' } })).toBe('Scaling');
  });
});

describe('getReadFirstCompletion', () => {
  it('counts how many shown options have a value set', () => {
    const result = getReadFirstCompletion({
      a: { type: 'string', value: 'x' },
      b: { type: 'string', value: '' },
      c: { type: 'bool', value: false },
      d: { type: 'list', value: [] },
    });
    expect(result.total).toBe(4);
    expect(result.set).toBe(2); // 'x' and false; '' and [] are empty
    expect(result.pct).toBe(50);
  });

  it('reports 0% for an empty form', () => {
    expect(getReadFirstCompletion({})).toEqual({ total: 0, set: 0, pct: 0 });
  });

  it('rounds the percentage', () => {
    const result = getReadFirstCompletion({
      a: { type: 'string', value: 'x' },
      b: { type: 'string', value: 'y' },
      c: { type: 'string', value: '' },
    });
    expect(result.pct).toBe(67); // 2/3 → 66.6 → 67
  });
});
