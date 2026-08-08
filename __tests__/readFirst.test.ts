/**
 * Unit tests for src/components/form/engine/readFirst.ts — the pure helpers
 * behind the FormEngine `compact` (read-first) mode.
 *
 * Each test calls real production code and asserts on actual behaviour.
 * Breaking the implementation must cause at least one test to fail.
 */

import {
  colorToCss,
  formatBytes,
  formatColorValue,
  formatFileValue,
  formatOptionValue,
  getAllowedValueImage,
  getFirstAttentionOptionName,
  getHashEntries,
  getOptionGroup,
  getOptionGroupLabel,
  getReadFirstBucket,
  getReadFirstCompletion,
  getReadFirstStatus,
  isFixedCompactAllowedValueOption,
  isCompactBooleanOption,
  isOptionValueEmpty,
  shouldAutoCollapseCompactOption,
  shouldAutoCollapseCompactAllowedValueOption,
  type IFirstAttentionFieldMeta,
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

describe('shouldAutoCollapseCompactAllowedValueOption', () => {
  const fixedChoiceSchema = {
    type: 'string',
    allowed_values: [{ value: 'api', display_name: 'API' }],
  } as never;

  it('identifies fixed allowed-value fields that do not need a Done confirmation', () => {
    expect(isFixedCompactAllowedValueOption(fixedChoiceSchema)).toBe(true);
    expect(
      isFixedCompactAllowedValueOption({
        ...fixedChoiceSchema,
        allowed_values_creatable: true,
      } as never)
    ).toBe(false);
    expect(
      isFixedCompactAllowedValueOption({ ...fixedChoiceSchema, arg_schema: {} } as never)
    ).toBe(false);
  });

  it('auto-collapses fixed allowed-value selections', () => {
    expect(shouldAutoCollapseCompactAllowedValueOption(fixedChoiceSchema, 'api')).toBe(true);
  });

  it('does not auto-collapse empty values', () => {
    expect(shouldAutoCollapseCompactAllowedValueOption(fixedChoiceSchema, '')).toBe(false);
  });

  it('does not auto-collapse creatable allowed-value fields', () => {
    expect(
      shouldAutoCollapseCompactAllowedValueOption(
        { ...fixedChoiceSchema, allowed_values_creatable: true } as never,
        'custom'
      )
    ).toBe(false);
  });

  it('does not auto-collapse multiselect fields', () => {
    expect(
      shouldAutoCollapseCompactAllowedValueOption(
        { ...fixedChoiceSchema, multiselect: true } as never,
        ['api']
      )
    ).toBe(false);
  });
});

describe('shouldAutoCollapseCompactOption', () => {
  it('identifies both supported boolean schema names', () => {
    expect(isCompactBooleanOption({ type: 'bool' } as never)).toBe(true);
    expect(isCompactBooleanOption({ ui_type: 'boolean' } as never)).toBe(true);
    expect(isCompactBooleanOption({ type: 'string' } as never)).toBe(false);
  });

  it('auto-collapses explicit true and false choices but not an unset boolean', () => {
    const schema = { type: 'bool', ui_type: 'bool' } as never;

    expect(shouldAutoCollapseCompactOption(schema, true)).toBe(true);
    expect(shouldAutoCollapseCompactOption(schema, false)).toBe(true);
    expect(shouldAutoCollapseCompactOption(schema, undefined)).toBe(false);
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

  // Security: a sensitive option (password/token) must never leak its value
  // into the read-first row or its hover title.
  it('masks sensitive option values', () => {
    expect(
      formatOptionValue({ type: 'string', value: 'hunter2' }, { sensitive: true } as never)
    ).toBe('••••••');
    // Empty sensitive values still show as empty (the "Not set" placeholder).
    expect(formatOptionValue({ type: 'string', value: '' }, { sensitive: true } as never)).toBe(
      ''
    );
  });

  // Regression: a `richtext` ui_type option can hold a plain scalar (set
  // programmatically / loaded from the server) — `richtextToString` used to
  // call `.map` on it and crash the compact row.
  it('formats richtext options that hold plain scalar values', () => {
    const schema = { type: 'string', ui_type: 'richtext' } as never;
    expect(formatOptionValue({ type: 'string', value: '123' }, schema)).toBe('123');
    expect(formatOptionValue({ type: 'string', value: 123 as never }, schema)).toBe('123');
  });

  it('formats richtext Slate documents as their text content', () => {
    expect(
      formatOptionValue(
        {
          type: 'richtext' as never,
          value: [
            {
              type: 'paragraph',
              children: [
                { text: 'Hello ' },
                { type: 'tag', value: '$local:x', children: [{ text: '' }] },
              ],
            },
          ] as never,
        },
        { type: 'richtext', ui_type: 'richtext' } as never
      )
    ).toBe('Hello $local:x');
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

  it('unwraps typed {type,value} envelopes in a list of hashes (never "[object Object]")', () => {
    const methods = [
      { type: 'hash', value: { name: 'init', body: 'sub init() { }' } },
      { type: 'hash', value: { name: 'run', body: 'sub run() {}' } },
    ];
    const summary = formatOptionValue({ type: 'list', value: methods });
    expect(summary).toBe('init, run');
    expect(summary).not.toContain('[object Object]');
  });

  it('counts a list of anonymous hash envelopes rather than printing objects', () => {
    const rows = [
      { type: 'hash', value: { a: 1 } },
      { type: 'hash', value: { b: 2 } },
    ];
    expect(formatOptionValue({ type: 'list', value: rows })).toBe('2 items');
  });

  it('marks expression values', () => {
    expect(
      formatOptionValue({ type: 'string', value: 'anything', is_expression: true })
    ).toBe('Expression');
  });

  it('summarises a hash object by its field count', () => {
    expect(formatOptionValue({ type: 'hash', value: { a: 1 } })).toBe('1 field');
    expect(formatOptionValue({ type: 'hash', value: { a: 1, b: 2 } })).toBe('2 fields');
  });

  it('summarises a structured (arg_schema) hash value by its sub-field count', () => {
    expect(
      formatOptionValue({
        type: 'hash',
        value: {
          host: { type: 'string', value: 'db.local' },
          port: { type: 'int', value: 5432 },
        },
      })
    ).toBe('2 fields');
  });

  it('falls back to the generic marker for an empty object', () => {
    expect(formatOptionValue({ type: 'hash', value: {} as any })).toBe('Set');
  });

  it('formats an rgbcolor value as an uppercase hex string', () => {
    expect(formatOptionValue({ type: 'rgbcolor', value: { r: 0, g: 0, b: 255, a: 1 } })).toBe(
      '#0000FF'
    );
  });

  it('formats a non-opaque rgbcolor value as rgba(…)', () => {
    expect(formatOptionValue({ type: 'rgbcolor', value: { r: 255, g: 0, b: 0, a: 0.5 } })).toBe(
      'rgba(255, 0, 0, 0.5)'
    );
  });

  it('formats a file value as its filename', () => {
    expect(
      formatOptionValue({ type: 'file', value: { name: 'config.txt', size: 1234, content: 'x' } })
    ).toBe('config.txt');
  });

  it('stringifies scalars', () => {
    expect(formatOptionValue({ type: 'number', value: 42 })).toBe('42');
    expect(formatOptionValue({ type: 'string', value: 'hello' })).toBe('hello');
  });

  it('summarises a YAML-serialized list value instead of dumping raw YAML', () => {
    // The object/list editor stores list values as a YAML string; the read row
    // must summarise it, not print `%YAML 1.2 --- [ … ]`.
    const yamlList = '%YAML 1.2\n---\n["https://x/youtube.force-ssl", "email", "profile"]\n';
    expect(formatOptionValue({ type: 'list', value: yamlList })).toBe(
      'https://x/youtube.force-ssl, email, profile'
    );
  });

  it('summarises a YAML-serialized hash value as a field count', () => {
    const yamlHash = '%YAML 1.2\n---\naccess_type: offline\nprompt: consent\n';
    expect(formatOptionValue({ type: 'hash', value: yamlHash })).toBe('2 fields');
  });

  it('does not over-parse a plain string that merely looks bracketed', () => {
    // type is not list/hash and there's no YAML doc marker → leave it alone.
    expect(formatOptionValue({ type: 'string', value: '[draft]' })).toBe('[draft]');
  });
});

describe('formatColorValue', () => {
  it('converts an RGB object to uppercase hex', () => {
    expect(formatColorValue({ r: 0, g: 0, b: 255 })).toBe('#0000FF');
    expect(formatColorValue({ r: 255, g: 165, b: 0 })).toBe('#FFA500');
  });

  it('renders rgba(…) only when alpha is below 1', () => {
    expect(formatColorValue({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
    expect(formatColorValue({ r: 0, g: 0, b: 0, a: 0.25 })).toBe('rgba(0, 0, 0, 0.25)');
  });

  it('accepts a { hex } object or a raw hex string', () => {
    expect(formatColorValue({ hex: '#abcdef' })).toBe('#ABCDEF');
    expect(formatColorValue('#abcdef')).toBe('#ABCDEF');
  });

  it('prefers rgba over an accompanying opaque hex when alpha is below 1', () => {
    // react-color emits both `hex` (opaque) and `{ r, g, b, a }`; a semi-
    // transparent colour must render as rgba(), not the opaque hex.
    expect(formatColorValue({ hex: '#0000ff', r: 0, g: 0, b: 255, a: 0.5 })).toBe(
      'rgba(0, 0, 255, 0.5)'
    );
  });

  it('returns undefined for unrecognisable colour values', () => {
    expect(formatColorValue('not-a-colour')).toBeUndefined();
    expect(formatColorValue({})).toBeUndefined();
    expect(formatColorValue(undefined)).toBeUndefined();
  });
});

describe('colorToCss', () => {
  it('keeps the alpha channel for the swatch preview', () => {
    expect(colorToCss({ r: 0, g: 0, b: 255, a: 1 })).toBe('rgba(0, 0, 255, 1)');
    expect(colorToCss({ r: 255, g: 0, b: 0, a: 0.5 })).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('passes through hex forms', () => {
    expect(colorToCss({ hex: '#abcdef' })).toBe('#abcdef');
    expect(colorToCss('#abcdef')).toBe('#abcdef');
  });
});

describe('formatFileValue', () => {
  it('returns the filename from the upload descriptor', () => {
    expect(formatFileValue({ name: 'config.txt', size: 10, content: 'x' })).toBe('config.txt');
  });

  it('reads the build-tab { name: { value } } shape', () => {
    expect(formatFileValue({ name: { value: 'built.json' } })).toBe('built.json');
  });

  it('takes the basename of a path string', () => {
    expect(formatFileValue('/tmp/uploads/report.pdf')).toBe('report.pdf');
  });

  it('returns undefined when no filename is present', () => {
    expect(formatFileValue({ size: 10 })).toBeUndefined();
    expect(formatFileValue(undefined)).toBeUndefined();
  });
});

describe('formatBytes', () => {
  it('formats raw bytes, KB, MB and GB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1234)).toBe('1.2 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5 GB');
  });
});

describe('getHashEntries', () => {
  it('expands a structured (arg_schema) hash into labelled sub-rows', () => {
    const schema: any = {
      type: 'hash',
      arg_schema: {
        host: { type: 'string', display_name: 'Host' },
        secure: { type: 'bool', display_name: 'Secure' },
      },
    };
    const entries = getHashEntries(
      {
        type: 'hash',
        value: {
          host: { type: 'string', value: 'db.local' },
          secure: { type: 'bool', value: true },
        },
      },
      schema
    );
    expect(entries).toEqual([
      { name: 'host', label: 'Host', value: 'db.local' },
      { name: 'secure', label: 'Secure', value: 'Yes' },
    ]);
  });

  it('expands a plain free-hash object using keys as labels', () => {
    expect(getHashEntries({ type: 'hash', value: { a: '1', b: '2' } })).toEqual([
      { name: 'a', label: 'a', value: '1' },
      { name: 'b', label: 'b', value: '2' },
    ]);
  });

  it('expands a YAML-serialized hash string', () => {
    const yamlHash = '%YAML 1.2\n---\naccess_type: offline\nprompt: consent\n';
    expect(getHashEntries({ type: 'hash', value: yamlHash })).toEqual([
      { name: 'access_type', label: 'access_type', value: 'offline' },
      { name: 'prompt', label: 'prompt', value: 'consent' },
    ]);
  });

  it('does not mistake a free-hash value with a `value` key for a field descriptor', () => {
    // Without an arg_schema this is a plain free-hash; the inner object must be
    // summarised whole, not collapsed to its `value` property.
    expect(getHashEntries({ type: 'hash', value: { conf: { value: 'prod', env: 'eu' } } })).toEqual(
      [{ name: 'conf', label: 'conf', value: '2 fields' }]
    );
  });

  // Regression: a schema-less hash whose entries are typed envelopes (the
  // server's serialization — e.g. the Basic fixture's `selectedOption`
  // default_value) must unwrap each envelope, not count its own keys as
  // "2 fields".
  it('unwraps typed-envelope entries in a schema-less hash', () => {
    const entries = getHashEntries({
      type: 'hash',
      value: {
        option1: { type: 'string', value: 'value1' },
        option2: {
          type: 'hash',
          value: {
            option3: { type: 'string', value: 'value3' },
            option4: { type: 'list', value: [{ type: 'string', value: 'value4' }] },
          },
        },
      } as never,
    });
    expect(entries).toEqual([
      { name: 'option1', label: 'option1', value: 'value1' },
      { name: 'option2', label: 'option2', value: '2 fields' },
    ]);
  });

  // The engine has ONE envelope definition (structuredData's allow-list): an
  // entry carrying extended envelope keys (`sensitive`, `required`, …) must
  // unwrap in the summary exactly like the structured tree unwraps it.
  it('unwraps envelopes carrying extended allow-list keys', () => {
    const entries = getHashEntries({
      type: 'hash',
      value: {
        token: { type: 'string', value: 'secret', sensitive: true, required: true },
      } as never,
    });
    expect(entries).toEqual([{ name: 'token', label: 'token', value: 'secret' }]);
  });

  it('resolves enum items (label + image) the same as allowed_values', () => {
    // IDE enum shape: { items: [{ value, title, image }] }
    const enumSchema = { items: [{ value: 'qore', title: 'Qore', image: 'q.png' }] };
    expect(formatOptionValue({ type: 'enum', value: 'qore' } as never, enumSchema as never)).toBe(
      'Qore'
    );
    expect(getAllowedValueImage('qore', enumSchema as never)).toBe('q.png');
    // reqraft allowed_values shape still resolves label + image
    const avSchema = {
      allowed_values: [{ value: { type: 'string', value: 'x' }, display_name: 'X', image: 'x.png' }],
    };
    expect(formatOptionValue({ type: 'string', value: 'x' } as never, avSchema as never)).toBe('X');
    expect(getAllowedValueImage('x', avSchema as never)).toBe('x.png');
  });

  it('renders an expression value as an offline DPQL-ish summary', () => {
    const expr = {
      is_expression: true,
      value: {
        exp: '==',
        args: [
          { type: 'string', value: '$local:name' },
          { type: 'string', value: 'John' },
        ],
      },
    };
    expect(formatOptionValue(expr as never)).toBe('"$local:name" == "John"');
    // unrenderable / empty AST → the generic marker, never blank-looking
    expect(formatOptionValue({ is_expression: true, value: { args: [] } } as never)).toBe(
      'Expression'
    );
  });

  it('summarises a schema-definition as the schema name + table count', () => {
    const def = { schema: { name: 'orders_db' }, tables: { orders: {}, lines: {} } };
    expect(
      formatOptionValue({ type: 'hash', value: def } as never, { ui_type: 'schema-definition' } as never)
    ).toBe('orders_db · 2 tables');
    // no tables → name only; no name → generic marker
    expect(
      formatOptionValue({ type: 'hash', value: { schema: { name: 's' } } } as never, { ui_type: 'schema-definition' } as never)
    ).toBe('s');
    expect(
      formatOptionValue({ type: 'hash', value: {} } as never, { ui_type: 'schema-definition' } as never)
    ).toBe('Schema');
  });

  it('returns [] for empty or non-hash values', () => {
    expect(getHashEntries({ type: 'hash', value: undefined })).toEqual([]);
    expect(getHashEntries({ type: 'list', value: ['a', 'b'] })).toEqual([]);
    expect(getHashEntries(undefined)).toEqual([]);
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

describe('getFirstAttentionOptionName', () => {
  // Build a getFieldMeta callback from a plain map, defaulting focusable to true.
  const metaFrom =
    (fields: Record<string, Partial<IFirstAttentionFieldMeta>>) =>
    (name: string): IFirstAttentionFieldMeta | undefined => {
      const field = fields[name];
      if (!field) return undefined;
      return { needsAttention: !!field.needsAttention, focusable: field.focusable ?? true };
    };

  it('returns the first attention field in the supplied order', () => {
    const target = getFirstAttentionOptionName(
      ['first', 'second'],
      metaFrom({ first: { needsAttention: false }, second: { needsAttention: true } })
    );
    expect(target).toBe('second');
  });

  it('respects the given order, not the map insertion order', () => {
    // Even though `b` is listed first in the meta map, `a` comes first in order.
    const target = getFirstAttentionOptionName(
      ['a', 'b'],
      metaFrom({ b: { needsAttention: true }, a: { needsAttention: true } })
    );
    expect(target).toBe('a');
  });

  it('skips fields that do not need attention', () => {
    const target = getFirstAttentionOptionName(
      ['ok', 'fix'],
      metaFrom({ ok: { needsAttention: false }, fix: { needsAttention: true } })
    );
    expect(target).toBe('fix');
  });

  it('skips non-focusable (disabled/readonly/dependency-locked) fields even when they need attention', () => {
    const target = getFirstAttentionOptionName(
      ['locked', 'open'],
      metaFrom({
        locked: { needsAttention: true, focusable: false },
        open: { needsAttention: true },
      })
    );
    expect(target).toBe('open');
  });

  it('returns undefined when nothing needs attention', () => {
    const target = getFirstAttentionOptionName(
      ['a', 'b'],
      metaFrom({ a: { needsAttention: false }, b: { needsAttention: false } })
    );
    expect(target).toBeUndefined();
  });

  it('ignores fields missing from the meta lookup', () => {
    const target = getFirstAttentionOptionName(
      ['ghost', 'real'],
      metaFrom({ real: { needsAttention: true } })
    );
    expect(target).toBe('real');
  });
});

describe('getReadFirstStatus', () => {
  // Per-field status that feeds the read-first buckets. Anything other than
  // 'set' / 'optional' surfaces the row for attention (see getReadFirstBucket).
  const status = (s: Partial<Parameters<typeof getReadFirstStatus>[0]>) =>
    getReadFirstStatus({
      empty: false,
      required: false,
      covered: false,
      invalid: false,
      warned: false,
      ...s,
    });

  it("marks an empty required field 'todo'", () => {
    expect(status({ empty: true, required: true })).toBe('todo');
  });

  it("marks a filled, valid field 'set'", () => {
    expect(status({ empty: false })).toBe('set');
  });

  it("marks a FILLED but INVALID field 'invalid', not 'set'", () => {
    // The case behind the autofocus fix: a required field can carry a value and
    // still need fixing, so it must not read as a completed ('set') row.
    expect(status({ empty: false, required: true, invalid: true })).toBe('invalid');
  });

  it("treats an empty one-of member covered by a satisfied sibling as 'set'", () => {
    expect(status({ empty: true, required: true, covered: true })).toBe('set');
  });

  it("marks an empty warned field 'todo'", () => {
    expect(status({ empty: true, warned: true })).toBe('todo');
  });

  it("marks an empty, non-required, non-warned field 'optional'", () => {
    expect(status({ empty: true })).toBe('optional');
  });
});

describe('getReadFirstBucket', () => {
  it("buckets 'invalid' as 'attention' (a filled-but-invalid row still needs fixing)", () => {
    expect(getReadFirstBucket('invalid')).toBe('attention');
  });

  it("buckets 'todo' as 'attention'", () => {
    expect(getReadFirstBucket('todo')).toBe('attention');
  });

  it("buckets 'set' as 'set'", () => {
    expect(getReadFirstBucket('set')).toBe('set');
  });

  it("buckets 'optional' as 'optional'", () => {
    expect(getReadFirstBucket('optional')).toBe('optional');
  });
});
