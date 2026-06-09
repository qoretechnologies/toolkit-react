/**
 * Unit tests for src/helpers/common.ts `typedToYaml` — the typed-value → YAML
 * conversion used by the `list`/`hash` (object) field editors.
 *
 * Regression coverage for the "r.map is not a function" crash: opening a `list`
 * field (e.g. a connection's `oauth2_scopes`) whose value arrives as a non-array
 * (a string from a YAML round-trip) crashed `typedToPlain`'s unguarded `.map`.
 * Each test calls the real production `typedToYaml`.
 */
import { typedToYaml } from '../src/helpers/common';

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
