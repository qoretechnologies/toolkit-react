/**
 * Unit tests for src/helpers/validations.ts
 *
 * Each test calls real production code and asserts on actual behavior.
 * Breaking the implementation must cause at least one test to fail.
 */

import {
  getTypeFromValue,
  hasAllDependenciesFullfilled,
  isValueSet,
  maybeParseYaml,
  validateField,
  validateFieldWithResult,
  validateOptionWithRequiredGroups,
} from '../src/helpers/validations';

// ─── richtext ──────────────────────────────────────────────────────────────────

describe('richtext', () => {
  it('rejects empty string', () => {
    expect(validateField('richtext', '')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('richtext', undefined)).toBe(false);
  });

  it('rejects empty paragraph', () => {
    const empty = [{ type: 'paragraph', children: [{ text: '' }] }];
    expect(validateField('richtext', empty)).toBe(false);
  });

  it('accepts non-empty string', () => {
    expect(validateField('richtext', 'hello')).toBe(true);
  });

  it('accepts non-empty rich-text node', () => {
    const value = [{ type: 'paragraph', children: [{ text: 'hello' }] }];
    expect(validateField('richtext', value)).toBe(true);
  });
});

// ─── bool / boolean ───────────────────────────────────────────────────────────

describe('bool', () => {
  it('accepts true', () => {
    expect(validateField('bool', true)).toBe(true);
  });

  it('accepts false', () => {
    expect(validateField('bool', false)).toBe(true);
  });

  it('rejects string "true"', () => {
    expect(validateField('bool', 'true')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('bool', undefined)).toBe(false);
  });
});

describe('boolean (alias)', () => {
  it('accepts true', () => {
    expect(validateField('boolean', true)).toBe(true);
  });

  it('rejects undefined', () => {
    expect(validateField('boolean', undefined)).toBe(false);
  });
});

// ─── connection ────────────────────────────────────────────────────────────────

describe('connection', () => {
  it('accepts a valid connection string', () => {
    expect(validateField('connection', 'my-connection')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateField('connection', '')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('connection', undefined)).toBe(false);
  });

  it('rejects when allowed_values provided but value not in them', () => {
    const field = {
      allowed_values: [{ value: { value: 'allowed-1' } }],
    };
    expect(validateField('connection', 'not-allowed', field)).toBe(false);
  });

  it('accepts when value is in allowed_values', () => {
    const field = {
      allowed_values: [{ value: { value: 'allowed-1' }, disabled: false }],
    };
    expect(validateField('connection', 'allowed-1', field)).toBe(true);
  });
});

// ─── binary ───────────────────────────────────────────────────────────────────

/**
 * The wire form is base64, matching the server decode. Hex is accepted only
 * under the legacy `0x` prefix, which is what keeps the even-length and
 * hex-alphabet rules meaningful: without the prefix there is nothing to say a
 * string was meant as hex rather than as the base64 it also parses as.
 */
describe('binary', () => {
  it('accepts base64', () => {
    expect(validateField('binary', 'deadbeef')).toBe(true);
    expect(validateField('binary', 'aGVsbG8=')).toBe(true);
    expect(validateField('binary', 'aGVsbG8h')).toBe(true);
  });

  it('accepts a base64 data: URL', () => {
    expect(validateField('binary', 'data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('accepts 0x-prefixed hex', () => {
    expect(validateField('binary', '0xDEAD')).toBe(true);
  });

  it('rejects characters that are in neither alphabet', () => {
    expect(validateField('binary', 'not base64!')).toBe(false);
    expect(validateField('binary', '****')).toBe(false);
  });

  it('rejects odd-length 0x hex', () => {
    expect(validateField('binary', '0xabc')).toBe(false);
  });

  it('rejects non-hex characters after a 0x prefix', () => {
    expect(validateField('binary', '0xzzzz')).toBe(false);
  });

  it('rejects padding in the middle of a base64 value', () => {
    expect(validateField('binary', 'aGV=sbG8')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateField('binary', '')).toBe(false);
    expect(validateField('binary', '   ')).toBe(false);
  });

  it('rejects non-string', () => {
    expect(validateField('binary', 123)).toBe(false);
  });
});

// ─── string (and aliases) ─────────────────────────────────────────────────────

describe('string', () => {
  it('accepts a non-empty string', () => {
    expect(validateField('string', 'hello')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateField('string', '')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('string', undefined)).toBe(false);
  });

  it('rejects number', () => {
    expect(validateField('string', 42)).toBe(false);
  });

  it('rejects when validation_regex does not match', () => {
    expect(validateField('string', 'hello', { validation_regex: '^[0-9]+$' })).toBe(false);
  });

  it('accepts when validation_regex matches', () => {
    expect(validateField('string', '42', { validation_regex: '^[0-9]+$' })).toBe(true);
  });
});

describe('long-string alias', () => {
  it('accepts non-empty string', () => {
    expect(validateField('long-string', 'text')).toBe(true);
  });

  it('rejects empty', () => {
    expect(validateField('long-string', '')).toBe(false);
  });
});

// ─── file ─────────────────────────────────────────────────────────────────────

describe('file', () => {
  const validFile = {
    name: { type: 'richtext', value: 'file.txt' },
    content: { type: 'richtext', value: 'content' },
  };

  it('accepts valid file object', () => {
    expect(validateField('file', validFile)).toBe(true);
  });

  it('rejects file without name', () => {
    const file = { name: { type: 'richtext', value: '' }, content: { type: 'richtext', value: 'ok' } };
    expect(validateField('file', file)).toBe(false);
  });

  it('rejects file without content', () => {
    const file = { name: { type: 'richtext', value: 'file.txt' }, content: { type: 'richtext', value: '' } };
    expect(validateField('file', file)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('file', undefined)).toBe(false);
  });

  // A Build-tab sub-value is a full option envelope carrying its own `type` and
  // an optional `is_expression`. Validating the unwrapped `.value` as a bare
  // `string` rejected everything that is not one — the operator could not use an
  // expression or rich text for a file's name or content.
  it('accepts an expression as the file name', () => {
    expect(
      validateField('file', {
        name: {
          type: 'richtext',
          is_expression: true,
          value: { exp: 'convert-to-string', args: [{ type: 'string', value: 'invoice' }] },
        },
        content: { type: 'data', value: 'JVBERi0xLjQK' },
      })
    ).toBe(true);
  });

  it('accepts an expression as the file content', () => {
    expect(
      validateField('file', {
        name: { type: 'richtext', value: 'invoice.pdf' },
        content: { type: 'data', is_expression: true, value: { exp: 'concat', args: [] } },
      })
    ).toBe(true);
  });

  it('accepts a rich-text paragraph array as the file name', () => {
    expect(
      validateField('file', {
        name: {
          type: 'richtext',
          value: [{ type: 'paragraph', children: [{ text: 'invoice.pdf' }] }],
        },
        content: { type: 'data', value: 'JVBERi0xLjQK' },
      })
    ).toBe(true);
  });

  it('still rejects an envelope that only claims to be an expression', () => {
    // No `is_expression`, so the part is validated against its declared type
    // instead — an arbitrary object must not pass as "probably an expression".
    expect(
      validateField('file', {
        name: { type: 'richtext', value: 'invoice.pdf' },
        content: { type: 'data', value: { exp: 'concat', args: [] } },
      })
    ).toBe(false);
  });

  it('reports the content problem instead of letting the name mask it', () => {
    const result = validateFieldWithResult('file', {
      name: { type: 'richtext', value: '' },
      content: { type: 'data', value: '' },
    });

    expect(result.isValid).toBe(false);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0]).toMatch(/^File name is invalid/);
    expect(result.reasons[1]).toMatch(/^File content is invalid/);
  });
});

// ─── number ───────────────────────────────────────────────────────────────────

describe('number', () => {
  it('accepts integer', () => {
    expect(validateField('number', 42)).toBe(true);
  });

  it('accepts float', () => {
    expect(validateField('number', 3.14)).toBe(true);
  });

  it('rejects NaN', () => {
    expect(validateField('number', NaN)).toBe(false);
  });

  it('rejects string', () => {
    expect(validateField('number', '42')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('number', undefined)).toBe(false);
  });
});

// ─── int ──────────────────────────────────────────────────────────────────────

describe('int', () => {
  it('accepts integer', () => {
    expect(validateField('int', 5)).toBe(true);
  });

  it('rejects float', () => {
    expect(validateField('int', 3.14)).toBe(false);
  });

  it('rejects string', () => {
    expect(validateField('int', '5')).toBe(false);
  });
});

// ─── float ────────────────────────────────────────────────────────────────────

describe('float', () => {
  it('accepts float', () => {
    expect(validateField('float', 3.14)).toBe(true);
  });

  it('accepts integer (is a valid float)', () => {
    expect(validateField('float', 5)).toBe(true);
  });

  it('rejects string', () => {
    expect(validateField('float', '3.14')).toBe(false);
  });
});

// ─── multi-select / array ─────────────────────────────────────────────────────

describe('array', () => {
  it('accepts non-empty array', () => {
    expect(validateField('array', ['a', 'b'])).toBe(true);
  });

  it('rejects empty array', () => {
    expect(validateField('array', [])).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('array', undefined)).toBe(false);
  });
});

describe('multi-select alias', () => {
  it('accepts non-empty array', () => {
    expect(validateField('multi-select', ['x'])).toBe(true);
  });

  it('rejects empty', () => {
    expect(validateField('multi-select', [])).toBe(false);
  });
});

// ─── cron ─────────────────────────────────────────────────────────────────────

describe('cron', () => {
  it('accepts valid cron expression', () => {
    expect(validateField('cron', '0 * * * *')).toBe(true);
  });

  it('rejects invalid cron expression', () => {
    expect(validateField('cron', 'not-a-cron')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('cron', undefined)).toBe(false);
  });
});

// ─── date ─────────────────────────────────────────────────────────────────────

describe('date', () => {
  it('accepts valid ISO date string', () => {
    expect(validateField('date', '2024-01-15T00:00:00.000Z')).toBe(true);
  });

  it('rejects invalid date string', () => {
    expect(validateField('date', 'not-a-date')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('date', undefined)).toBe(false);
  });
});

// ─── hash / free-hash ─────────────────────────────────────────────────────────

describe('hash', () => {
  it('accepts plain object', () => {
    expect(validateField('hash', { key: 'value' })).toBe(true);
  });

  it('accepts YAML string that parses to object', () => {
    expect(validateField('hash', 'key: value')).toBe(true);
  });

  it('rejects non-object YAML', () => {
    expect(validateField('hash', 'just a string')).toBe(false);
  });

  it('rejects array', () => {
    expect(validateField('hash', [1, 2, 3])).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateField('hash', undefined)).toBe(false);
  });
});

// ─── rgbcolor ─────────────────────────────────────────────────────────────────

describe('rgbcolor', () => {
  it('accepts valid RGB object', () => {
    expect(validateField('rgbcolor', { r: 255, g: 0, b: 0 })).toBe(true);
  });

  it('accepts object with r=0, g=0, b=0', () => {
    expect(validateField('rgbcolor', { r: 0, g: 0, b: 0 })).toBe(true);
  });

  it('rejects undefined', () => {
    expect(validateField('rgbcolor', undefined)).toBe(false);
  });

  it('rejects object without g and b', () => {
    expect(validateField('rgbcolor', { r: 255 })).toBe(false);
  });
});

// ─── list / free-list ─────────────────────────────────────────────────────────

describe('list', () => {
  it('accepts YAML list string', () => {
    expect(validateField('list', '- item1\n- item2')).toBe(true);
  });

  it('accepts array', () => {
    expect(validateField('list', ['a', 'b'])).toBe(true);
  });

  it('rejects non-list value', () => {
    expect(validateField('list', 'not-yaml', { has_to_have_value: true })).toBe(false);
  });
});

// ─── auto / any ───────────────────────────────────────────────────────────────

describe('auto', () => {
  it('accepts plain string value (YAML parses it as a string)', () => {
    expect(validateField('auto', 'hello')).toBe(true);
  });

  it('accepts YAML object string', () => {
    expect(validateField('auto', 'key: value')).toBe(true);
  });

  it('rejects empty string (no parseable value)', () => {
    expect(validateField('auto', '')).toBe(false);
  });

  it('rejects invalid YAML', () => {
    expect(validateField('auto', '{')).toBe(false);
  });
});

describe('any alias', () => {
  it('accepts plain string value', () => {
    expect(validateField('any', 'hello')).toBe(true);
  });
});

// ─── options ──────────────────────────────────────────────────────────────────

describe('options', () => {
  it('rejects when required option is missing', () => {
    const value = {};
    const schema = { requiredOpt: { type: 'string', ui_type: 'string', required: true } } as any;
    expect(validateField('options', value, { optionSchema: schema })).toBe(false);
  });

  it('accepts when all required options have values', () => {
    const value = { requiredOpt: { type: 'string', value: 'hello' } };
    const schema = { requiredOpt: { type: 'string', ui_type: 'string', required: true } } as any;
    expect(validateField('options', value, { optionSchema: schema })).toBe(true);
  });

  it('rejects when option value is invalid', () => {
    // value is number but type is string
    const value = { opt: { type: 'string', value: 123 } };
    const schema = { opt: { type: 'string', ui_type: 'string' } } as any;
    expect(validateField('options', value, { optionSchema: schema })).toBe(false);
  });

  it('accepts undefined options when canBeNull is true', () => {
    expect(validateField('options', undefined, {}, true)).toBe(true);
  });
});

// ─── nothing ──────────────────────────────────────────────────────────────────

describe('nothing', () => {
  it('always returns invalid', () => {
    expect(validateField('nothing', 'anything')).toBe(false);
    expect(validateField('nothing', undefined)).toBe(false);
  });
});

// ─── default (unknown type) ───────────────────────────────────────────────────

describe('default (unknown type)', () => {
  it('returns valid for unknown types', () => {
    expect(validateField('some-unknown-type', 'value')).toBe(true);
    expect(validateField('some-unknown-type', undefined)).toBe(true);
  });
});

// ─── template value pass-through ─────────────────────────────────────────────

describe('template value', () => {
  it('accepts valid template string for any type', () => {
    expect(validateField('string', '$local:myvar')).toBe(true);
  });

  it('accepts template for bool type', () => {
    expect(validateField('bool', '$env:MY_BOOL')).toBe(true);
  });

  it('rejects invalid template (no colon)', () => {
    // starts with $ but no colon — not treated as template, falls through to string validation
    expect(validateField('string', '$invalidtemplate')).toBe(true); // it's still a valid string
  });

  it('result has reason when template is malformed', () => {
    const result = validateFieldWithResult('bool', '$:missingkey');
    // $:missingkey — key is empty string, value is 'missingkey' → fails
    expect(result.isValid).toBe(false);
  });
});

// ─── canBeNull / *-prefix ─────────────────────────────────────────────────────

describe('canBeNull shortcut', () => {
  it('returns valid for null when canBeNull=true', () => {
    expect(validateField('string', null, {}, true)).toBe(true);
  });

  it('returns valid for undefined when canBeNull=true', () => {
    expect(validateField('string', undefined, {}, true)).toBe(true);
  });

  it('rejects null when canBeNull is not set', () => {
    expect(validateField('string', null)).toBe(false);
  });
});

describe('*-prefix nullable type', () => {
  it('returns valid for null with *-prefixed type', () => {
    expect(validateField('*string', null)).toBe(true);
  });

  it('still validates non-null values with *-prefixed type', () => {
    expect(validateField('*string', 'hello')).toBe(true);
    expect(validateField('*string', '')).toBe(false);
  });
});

// ─── validateFieldWithResult ─────────────────────────────────────────────────

describe('validateFieldWithResult', () => {
  it('returns IValidationResult with isValid and reasons', () => {
    const result = validateFieldWithResult('string', '');
    expect(result).toHaveProperty('isValid', false);
    expect(result).toHaveProperty('reasons');
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns valid result for valid value', () => {
    const result = validateFieldWithResult('string', 'hello');
    expect(result.isValid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});

// ─── maybeParseYaml ───────────────────────────────────────────────────────────

describe('maybeParseYaml', () => {
  it('parses valid YAML object', () => {
    expect(maybeParseYaml('key: value')).toEqual({ key: 'value' });
  });

  it('parses YAML number', () => {
    expect(maybeParseYaml('42')).toBe(42);
  });

  it('passes through booleans', () => {
    expect(maybeParseYaml(true)).toBe(true);
    expect(maybeParseYaml(false)).toBe(false);
  });

  it('passes through numbers', () => {
    expect(maybeParseYaml(5)).toBe(5);
  });

  it('returns undefined for empty string', () => {
    expect(maybeParseYaml('')).toBeUndefined();
  });

  it('returns undefined for invalid YAML', () => {
    expect(maybeParseYaml('{')).toBeUndefined();
  });

  it('passes through non-string objects', () => {
    const obj = { a: 1 };
    expect(maybeParseYaml(obj)).toEqual(obj);
  });
});

// ─── isValueSet ───────────────────────────────────────────────────────────────

describe('isValueSet', () => {
  it('returns false for undefined', () => {
    expect(isValueSet(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValueSet(null)).toBe(false);
  });

  it('returns true for false (valid falsy value)', () => {
    expect(isValueSet(false)).toBe(true);
  });

  it('returns true for 0', () => {
    expect(isValueSet(0)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isValueSet('')).toBe(true);
  });

  it('when canBeNull=true, undefined returns false but null returns true', () => {
    expect(isValueSet(null, true)).toBe(true);
    expect(isValueSet(undefined, true)).toBe(false);
  });
});

// ─── getTypeFromValue ─────────────────────────────────────────────────────────

describe('getTypeFromValue', () => {
  it('returns "bool" for boolean', () => {
    expect(getTypeFromValue(true)).toBe('bool');
  });

  it('returns "int" for integer', () => {
    expect(getTypeFromValue(5)).toBe('int');
  });

  it('returns "float" for float', () => {
    expect(getTypeFromValue(3.14)).toBe('float');
  });

  it('returns "hash" for plain object', () => {
    expect(getTypeFromValue({ a: 1 })).toBe('hash');
  });

  it('returns "list" for array', () => {
    expect(getTypeFromValue([1, 2])).toBe('list');
  });

  it('returns "string" for string', () => {
    expect(getTypeFromValue('hello')).toBe('string');
  });

  it('returns "auto" for undefined', () => {
    expect(getTypeFromValue(undefined)).toBe('auto');
  });

  it('returns "auto" for null', () => {
    expect(getTypeFromValue(null)).toBe('auto');
  });
});

// ─── validateOptionWithRequiredGroups ────────────────────────────────────────

describe('validateOptionWithRequiredGroups', () => {
  it('returns true when one option in the group has a value', () => {
    const schema = {
      opt1: { type: 'string', ui_type: 'string', required_groups: ['G1'] },
      opt2: { type: 'string', ui_type: 'string', required_groups: ['G1'] },
    } as any;
    const options: any = { opt1: { type: 'string', value: 'hello' } };
    expect(validateOptionWithRequiredGroups(options, schema, ['G1'])).toBe(true);
  });

  it('returns false when no option in the group has a value', () => {
    const schema = {
      opt1: { type: 'string', ui_type: 'string', required_groups: ['G1'] },
      opt2: { type: 'string', ui_type: 'string', required_groups: ['G1'] },
    } as any;
    const options: any = {};
    expect(validateOptionWithRequiredGroups(options, schema, ['G1'])).toBe(false);
  });
});

// ─── hasAllDependenciesFullfilled ─────────────────────────────────────────────

describe('hasAllDependenciesFullfilled', () => {
  const schema = {
    parent: { type: 'string', ui_type: 'string' },
    child: { type: 'string', ui_type: 'string', depends_on: ['parent'] },
  } as any;

  it('returns true when all dependencies have values', () => {
    const options: any = { parent: { type: 'string', value: 'hello' } };
    expect(hasAllDependenciesFullfilled(['parent'], options, schema)).toBe(true);
  });

  it('returns false when dependency has no value', () => {
    const options: any = { parent: { type: 'string', value: undefined } };
    expect(hasAllDependenciesFullfilled(['parent'], options, schema)).toBe(false);
  });

  it('returns true for an empty dependencies array', () => {
    expect(hasAllDependenciesFullfilled([], {}, schema)).toBe(true);
  });

  it('handles OR-group dependencies (nested array)', () => {
    const options: any = { parent: { type: 'string', value: 'v' } };
    // [['parent', 'other']] means parent OR other must have a value
    expect(hasAllDependenciesFullfilled([['parent', 'other']], options, schema)).toBe(true);
  });
});

// ─── exported validation functions ────────────────────────────────────────────

describe('validation module exports all public functions', () => {
  it('exports validateField as a function', () => {
    expect(typeof validateField).toBe('function');
  });

  it('exports validateFieldWithResult as a function', () => {
    expect(typeof validateFieldWithResult).toBe('function');
  });

  it('exports isValueSet as a function', () => {
    expect(typeof isValueSet).toBe('function');
  });

  it('exports getTypeFromValue as a function', () => {
    expect(typeof getTypeFromValue).toBe('function');
  });

  it('exports maybeParseYaml as a function', () => {
    expect(typeof maybeParseYaml).toBe('function');
  });

  it('exports hasAllDependenciesFullfilled as a function', () => {
    expect(typeof hasAllDependenciesFullfilled).toBe('function');
  });

  it('exports validateOptionWithRequiredGroups as a function', () => {
    expect(typeof validateOptionWithRequiredGroups).toBe('function');
  });
});

// ─── validateFieldWithResult detailed output ──────────────────────────────────

describe('validateFieldWithResult returns detailed IValidationResult', () => {
  it('returns isValid: true with empty reasons for valid field', () => {
    const result = validateFieldWithResult('string', 'hello');
    expect(result).toEqual({
      isValid: true,
      reasons: [],
    });
  });

  it('returns isValid: false with reason for invalid required string', () => {
    const result = validateFieldWithResult('string', '', { has_to_have_value: true });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns isValid: false with reason for invalid number', () => {
    const result = validateFieldWithResult('number', 'not-a-number');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reasons).toContain(result.reason);
  });

  it('returns isValid: false with reason for invalid int', () => {
    const result = validateFieldWithResult('int', 3.14);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('returns isValid: false with reason for empty required boolean', () => {
    const result = validateFieldWithResult('boolean', undefined, { has_to_have_value: true });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('returns isValid: false with reason for invalid cron', () => {
    const result = validateFieldWithResult('cron', 'not-a-cron');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('returns isValid: false with reason for invalid date', () => {
    const result = validateFieldWithResult('date', 'not-a-date');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('returns isValid: false with reasons for invalid hash with arg_schema', () => {
    const result = validateFieldWithResult('hash', { nested: 'value' }, {
      arg_schema: {
        requiredProp: {
          type: 'string',
          ui_type: 'string',
          required: true,
        },
      },
    });
    expect(result.isValid).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

// ─── rules: valid_identifier (options-schema rules wiring) ─────────────────────

describe('rules: valid_identifier', () => {
  it('rejects values starting with a digit or containing non-word chars', () => {
    expect(validateField('string', '1bad', { rules: ['valid_identifier'] } as never)).toBe(false);
    expect(validateField('string', 'has space', { rules: ['valid_identifier'] } as never)).toBe(
      false
    );
    const result = validateFieldWithResult('string', '1bad', {
      rules: ['valid_identifier'],
    } as never);
    expect(result.isValid).toBe(false);
    expect(result.reasons).toContain('Value is not a valid identifier');
  });

  it('accepts valid identifiers and ignores unrelated rules', () => {
    expect(validateField('string', 'valid_name2', { rules: ['valid_identifier'] } as never)).toBe(
      true
    );
    expect(validateField('string', '1bad', { rules: ['something_else'] } as never)).toBe(true);
  });

  it('still honours the legacy has_to_be_valid_identifier flag', () => {
    expect(validateField('string', '1bad', { has_to_be_valid_identifier: true } as never)).toBe(
      false
    );
  });
});

// ─── byte-size ────────────────────────────────────────────────────────────────

describe('byte-size', () => {
  it('accepts a number + unit string', () => {
    expect(validateField('byte-size', '512MiB')).toBe(true);
    expect(validateField('byte-size', '10KiB')).toBe(true);
  });

  it('rejects non-strings', () => {
    expect(validateField('byte-size', 512)).toBe(false);
    expect(validateField('byte-size', { value: '512MiB' })).toBe(false);
  });

  it('rejects a missing unit, missing amount, or empty string', () => {
    expect(validateField('byte-size', '512')).toBe(false);
    expect(validateField('byte-size', 'MiB')).toBe(false);
    expect(validateField('byte-size', '')).toBe(false);
  });

  it('accepts null/undefined only when canBeNull', () => {
    expect(validateField('byte-size', null)).toBe(false);
    expect(validateField('byte-size', undefined)).toBe(false);
    expect(validateField('byte-size', null, {}, true)).toBe(true);
    expect(validateField('byte-size', undefined, {}, true)).toBe(true);
  });

  it('returns a reason on failure', () => {
    const result = validateFieldWithResult('byte-size', 'MiB');
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

// ─── timeout ──────────────────────────────────────────────────────────────────

describe('timeout', () => {
  it('accepts whole millisecond counts', () => {
    expect(validateField('timeout', 45000)).toBe(true);
    expect(validateField('timeout', 0)).toBe(true);
  });

  it('rejects fractional and non-numeric values', () => {
    expect(validateField('timeout', 450.5)).toBe(false);
    expect(validateField('timeout', '45000')).toBe(false);
    expect(validateField('timeout', { value: 45000 })).toBe(false);
  });

  it('accepts null/undefined only when canBeNull', () => {
    expect(validateField('timeout', null)).toBe(false);
    expect(validateField('timeout', undefined)).toBe(false);
    expect(validateField('timeout', null, {}, true)).toBe(true);
    expect(validateField('timeout', undefined, {}, true)).toBe(true);
  });

  it('returns a reason on failure', () => {
    const result = validateFieldWithResult('timeout', 450.5);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

// ─── url ──────────────────────────────────────────────────────────────────────

describe('url', () => {
  it('accepts protocol://address values', () => {
    expect(validateField('url', 'https://example.com')).toBe(true);
    expect(validateField('url', 'rest://host:8011/api')).toBe(true);
  });

  it('rejects values without a protocol', () => {
    expect(validateField('url', 'example.com')).toBe(false);
    expect(validateField('url', '')).toBe(false);
  });

  it('rejects a protocol with an empty address', () => {
    expect(validateField('url', 'https://')).toBe(false);
  });

  it('keeps :// inside the address intact', () => {
    expect(validateField('url', 'https://proxy/forward?to=http://inner')).toBe(true);
  });

  it('accepts null/undefined only when canBeNull', () => {
    expect(validateField('url', null)).toBe(false);
    expect(validateField('url', null, {}, true)).toBe(true);
  });
});

// ─── schema-definition ────────────────────────────────────────────────────────

describe('expression', () => {
  const expressions = [
    {
      name: 'CONTAINS',
      display_name: 'String Contains',
      args: [
        { name: 'softstring', display_name: 'Value', ui_type: 'richtext', required: true },
        { name: 'softstring', display_name: 'Substring', ui_type: 'richtext', required: true },
      ],
      min_args: 2,
      varargs: false,
    },
  ];
  const field = { expressions } as any;
  const valid = {
    is_expression: true,
    value: {
      exp: 'CONTAINS',
      args: [
        { type: 'string', value: 'haystack' },
        { type: 'string', value: 'needle' },
      ],
    },
  };

  it('accepts a complete expression with a known operation', () => {
    expect(validateField('expression', valid, field)).toBe(true);
  });

  it('skips validation while the catalogue has not loaded', () => {
    expect(validateField('expression', valid, { expressions: [] } as any)).toBe(true);
  });

  it('rejects a missing operation', () => {
    expect(
      validateField('expression', { is_expression: true, value: { args: [] } }, field)
    ).toBe(false);
  });

  it('rejects an unknown operation', () => {
    expect(
      validateField('expression', { is_expression: true, value: { exp: 'NOPE', args: [] } }, field)
    ).toBe(false);
  });

  it('rejects too few arguments', () => {
    expect(
      validateField(
        'expression',
        { is_expression: true, value: { exp: 'CONTAINS', args: [{ type: 'string', value: 'x' }] } },
        field
      )
    ).toBe(false);
  });

  it('validates nested sub-expressions recursively', () => {
    const nested = {
      is_expression: true,
      value: {
        exp: 'CONTAINS',
        args: [
          { is_expression: true, value: { exp: 'NOPE', args: [] } },
          { type: 'string', value: 'needle' },
        ],
      },
    };
    expect(validateField('expression', nested, field)).toBe(false);
  });
});

// ─── schema-definition ────────────────────────────────────────────────────────

describe('schema-definition', () => {
  const definition = {
    schema: { name: 'shop', version: '1.0' },
    tables: {},
  };

  it('accepts an object with a schema section', () => {
    expect(validateField('schema-definition', definition)).toBe(true);
  });

  it('rejects non-objects and arrays', () => {
    expect(validateField('schema-definition', 'shop')).toBe(false);
    expect(validateField('schema-definition', [definition])).toBe(false);
  });

  it('rejects an object without a schema section', () => {
    expect(validateField('schema-definition', { tables: {} })).toBe(false);
  });

  it('accepts null/undefined only when canBeNull', () => {
    expect(validateField('schema-definition', null)).toBe(false);
    expect(validateField('schema-definition', null, {}, true)).toBe(true);
  });
});

// ─── hash with arg_schema, in both value shapes ────────────────────────────────

describe('hash with arg_schema', () => {
  // Exactly the shape a service-method row carries: two required args.
  const methodSchema = {
    arg_schema: {
      name: { type: 'string', required: true },
      desc: { type: 'string', required: true },
      lock: { type: 'string' },
    },
  } as any;

  it('accepts plain values, which is how the server sends them', () => {
    // Regression: a freshly-loaded list-of-hash row holds plain values, and the
    // validator only understood typed envelopes — so every complete
    // service-method row reported "Hash arguments are invalid" on screen while
    // displaying correct values.
    expect(
      validateFieldWithResult('hash', { name: 'init', desc: 'starts up' }, methodSchema).isValid
    ).toBe(true);
  });

  it('accepts typed envelopes, which is what the form emits after an edit', () => {
    expect(
      validateFieldWithResult(
        'hash',
        {
          name: { type: 'string', value: 'init' },
          desc: { type: 'string', value: 'starts up' },
        },
        methodSchema
      ).isValid
    ).toBe(true);
  });

  it('accepts a row that mixes the two, which is a half-edited row', () => {
    expect(
      validateFieldWithResult(
        'hash',
        { name: { type: 'string', value: 'init' }, desc: 'starts up' },
        methodSchema
      ).isValid
    ).toBe(true);
  });

  it('still rejects a missing required arg in either shape', () => {
    expect(validateFieldWithResult('hash', { name: 'init' }, methodSchema).isValid).toBe(false);
    expect(
      validateFieldWithResult('hash', { name: { type: 'string', value: 'init' } }, methodSchema)
        .isValid
    ).toBe(false);
  });

  it('treats an envelope with no value as not supplied, not as an empty string', () => {
    // required -> still invalid ...
    expect(
      validateFieldWithResult(
        'hash',
        { name: { type: 'string', value: undefined }, desc: 'starts up' },
        methodSchema
      ).isValid
    ).toBe(false);
    // ... but an optional arg in the same state must not sink the whole row
    expect(
      validateFieldWithResult(
        'hash',
        { name: 'init', desc: 'starts up', lock: { type: 'string', value: undefined } },
        methodSchema
      ).isValid
    ).toBe(true);
  });

  it('rejects an arg whose value is present but the wrong type', () => {
    expect(
      validateFieldWithResult('hash', { name: '', desc: 'starts up' }, methodSchema).isValid
    ).toBe(false);
  });
});

describe('list of hashes with arg_schema', () => {
  const methodsField = {
    element_type: 'hash',
    arg_schema: {
      name: { type: 'string', required: true },
      desc: { type: 'string', required: true },
    },
  } as any;

  it('validates every row through the element schema, in the shape the list holds', () => {
    // the list wraps each row in its own envelope; the row's own args are plain
    const rows = [
      { type: 'hash', value: { name: 'init', desc: 'starts up' } },
      { type: 'hash', value: { name: 'run', desc: 'does the work' } },
    ];

    expect(validateFieldWithResult('list', rows, methodsField).isValid).toBe(true);
  });

  it('names the offending row when one is incomplete', () => {
    const rows = [
      { type: 'hash', value: { name: 'init', desc: 'starts up' } },
      { type: 'hash', value: { name: 'run' } },
    ];
    const result = validateFieldWithResult('list', rows, methodsField);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('List item 1');
  });
});

/**
 * A list validates its elements in whichever shape they arrive.
 *
 * The editor keeps each element in a `{value, type}` envelope while the form is
 * open, but a value read back from storage is what the server contract asks
 * for: for `element_type: 'string'`, the bare strings. Reaching straight for
 * `.value` made every stored element validate as empty, so a saved list came
 * back "List item 0 is invalid: Text value is empty" — which bucketed the field
 * as needing attention even though its progress meter counted it as set.
 *
 * Reported on an alert rule's Gmail delivery action, whose To: address is
 * exactly this shape.
 */
describe('list elements in either shape', () => {
  const field = { element_type: 'string', has_to_have_value: true } as never;

  it('accepts bare string elements — the shape storage holds', () => {
    expect(validateField('list', ['ops@example.com'], field)).toBe(true);
  });

  it('accepts enveloped elements — the shape the editor writes', () => {
    expect(validateField('list', [{ value: 'ops@example.com', type: 'string' }], field)).toBe(true);
  });

  it('accepts a list mixing both shapes', () => {
    expect(
      validateField('list', ['first@example.com', { value: 'second@example.com' }], field)
    ).toBe(true);
  });

  it('still rejects an element that is genuinely empty, in either shape', () => {
    // The narrowing must not turn the validator into a rubber stamp.
    expect(validateField('list', [''], field)).toBe(false);
    expect(validateField('list', [{ value: '', type: 'string' }], field)).toBe(false);
  });

  it('reports which element failed', () => {
    const result = validateFieldWithResult('list', ['ok@example.com', ''], field);
    expect(result.isValid).toBe(false);
    expect(result.reason ?? '').toContain('List item 1');
  });

  it('does not throw on a null element', () => {
    // `parsedValue[i].value` threw here rather than reporting the element
    // invalid, taking the whole form's validation pass down with it.
    expect(() => validateField('list', [null], field)).not.toThrow();
    expect(validateField('list', [null], field)).toBe(false);
  });
});
