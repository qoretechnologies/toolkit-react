/**
 * Unit tests for src/helpers/common.ts `typedToYaml` — the typed-value → YAML
 * conversion used by the `list`/`hash` (object) field editors.
 *
 * Regression coverage for the "r.map is not a function" crash: opening a `list`
 * field (e.g. a connection's `oauth2_scopes`) whose value arrives as a non-array
 * (a string from a YAML round-trip) crashed `typedToPlain`'s unguarded `.map`.
 * Each test calls the real production `typedToYaml`.
 */
import { getDefaultValue, richtextToSegments, typedToYaml } from '../src/helpers/common';

describe('typedToYaml', () => {
  it('renders a list of typed { type, value } items', () => {
    const result = typedToYaml({
      type: 'list',
      value: [
        { type: 'string', value: 'email' },
        { type: 'string', value: 'profile' },
      ],
    } as any);
    expect(result).toContain('email');
    expect(result).toContain('profile');
  });

  it('renders a list of bare (untyped) primitive items without nulling them out', () => {
    const result = typedToYaml({ type: 'list', value: ['email', 'profile'] } as any);
    expect(result).toContain('email');
    expect(result).toContain('profile');
    // Previously bare strings were destructured to `null` in the editor.
    expect(result).not.toContain('null');
  });

  it('does not throw on a non-array list value (regression: r.map is not a function)', () => {
    expect(() =>
      typedToYaml({ type: 'list', value: 'https://example.com/scope' } as any)
    ).not.toThrow();
    expect(typedToYaml({ type: 'list', value: 'https://example.com/scope' } as any)).toContain(
      'example.com'
    );
  });

  it('renders a hash of typed values', () => {
    const result = typedToYaml({
      type: 'hash',
      value: { access_type: { type: 'string', value: 'offline' } },
    } as any);
    expect(result).toContain('access_type');
    expect(result).toContain('offline');
  });

  it('does not throw on a non-object hash value', () => {
    expect(() => typedToYaml({ type: 'hash', value: 'oops' } as any)).not.toThrow();
  });
});

describe('richtextToSegments', () => {
  it('keeps embedded template tags as discrete segments, coalescing prose', () => {
    const segments = richtextToSegments([
      {
        type: 'paragraph',
        children: [
          { text: 'This is a rich text option ' },
          { type: 'tag', label: 'Richtext Template', value: '$local:some-richtext', children: [{ text: '' }] },
          { text: '' },
        ],
      },
    ] as any);
    expect(segments).toEqual([
      { kind: 'text', text: 'This is a rich text option ' },
      { kind: 'tag', value: '$local:some-richtext', text: 'Richtext Template' },
    ]);
  });

  it('falls back to the tag value when it has no label', () => {
    const segments = richtextToSegments([
      { type: 'paragraph', children: [{ type: 'tag', value: '$config:url', children: [{ text: '' }] }] },
    ] as any);
    expect(segments).toEqual([{ kind: 'tag', value: '$config:url', text: '$config:url' }]);
  });

  it('returns a single text segment for a plain scalar (non-document) value', () => {
    expect(richtextToSegments('plain note' as any)).toEqual([{ kind: 'text', text: 'plain note' }]);
  });

  it('returns no segments for an empty value', () => {
    expect(richtextToSegments(undefined as any)).toEqual([]);
  });
});

describe('getDefaultValue', () => {
  /* The crash this guards: every call site reaches the schema as
     `options?.[optionName]`, and that lookup MISSES whenever a value is held
     under a name the schema does not describe — ordinary for a form carrying a
     value for a field the server no longer sends. The body then ran
     `'default_value' in undefined`, and `in` throws rather than returning
     false. It threw during render, so React unmounted the tree and a whole page
     went blank with `Cannot use 'in' operator to search for 'default_value' in
     undefined` as the only trace. */
  it('returns undefined for a field with no schema, instead of throwing', () => {
    expect(() => getDefaultValue(undefined)).not.toThrow();
    expect(getDefaultValue(undefined)).toBeUndefined();
  });

  it('still returns undefined when the schema declares no default', () => {
    expect(getDefaultValue({ type: 'string' } as any)).toBeUndefined();
  });

  it('reads a plain default', () => {
    expect(getDefaultValue({ type: 'string', default_value: 'x' } as any)).toBe('x');
  });

  it('unwraps a typed default', () => {
    expect(
      getDefaultValue({ type: 'string', default_value: { type: 'string', value: 'x' } } as any)
    ).toBe('x');
  });
});
