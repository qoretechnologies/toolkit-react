/**
 * Unit tests for src/components/form/engine/_structuredData/structuredData.ts —
 * the pure helpers behind the compact-mode structured hash preview
 * (StructuredDataView): the Qorus UI envelope, embedded-YAML detection, and
 * Qorus date parsing/formatting.
 *
 * Each test calls real production code and asserts on actual behaviour.
 * Breaking the implementation must cause at least one test to fail.
 */

import {
  dateLikeStringToIso,
  formatIdeTimestamp,
  formatStructuredScalar,
  hasStructuredValue,
  isDateType,
  isRecord,
  isStructuredContainerValue,
  isUiEncodedValue,
  parseSerializedStructuredText,
  qorusDateStringToIso,
  unwrapUiEncodedValue,
  UI_ENVELOPE_KEY_LIST,
} from '../src/components/form/engine/_structuredData/structuredData';

describe('isUiEncodedValue / unwrapUiEncodedValue', () => {
  it('recognises a minimal {type, value} envelope', () => {
    expect(isUiEncodedValue({ type: 'string', value: 'x' })).toBe(true);
    expect(unwrapUiEncodedValue({ type: 'string', value: 'x' })).toBe('x');
  });

  it('recognises an envelope carrying any allow-list keys', () => {
    const env = {
      type: 'string',
      value: 'secret',
      sensitive: true,
      required: true,
      display_name: 'Token',
    };
    expect(isUiEncodedValue(env)).toBe(true);
    expect(unwrapUiEncodedValue(env)).toBe('secret');
  });

  it('rejects an object with a foreign key (a real user hash)', () => {
    // `count` is not in the allow-list → this is a user hash, not an envelope.
    const hash = { type: 'string', value: 'x', count: 2 };
    expect(isUiEncodedValue(hash)).toBe(false);
    expect(unwrapUiEncodedValue(hash)).toBe(hash);
  });

  it('rejects non-objects, arrays, and shapes missing type/value', () => {
    expect(isUiEncodedValue(null)).toBe(false);
    expect(isUiEncodedValue('x')).toBe(false);
    expect(isUiEncodedValue(['type', 'value'])).toBe(false);
    expect(isUiEncodedValue({ type: 'string' })).toBe(false);
    expect(isUiEncodedValue({ value: 'x' })).toBe(false);
    expect(isUiEncodedValue({ type: 123, value: 'x' })).toBe(false);
  });

  it('keeps the allow-list and the matcher in sync', () => {
    // Every documented key must be accepted on an otherwise-valid envelope.
    for (const key of UI_ENVELOPE_KEY_LIST) {
      expect(isUiEncodedValue({ type: 'string', value: 'x', [key]: 'y' })).toBe(true);
    }
  });
});

describe('isRecord / isStructuredContainerValue', () => {
  it.each([
    [{}, true],
    [{ a: 1 }, true],
    [[], false],
    ['x', false],
    [null, false],
    [undefined, false],
    [42, false],
  ])('isRecord(%p) === %p', (value, expected) => {
    expect(isRecord(value)).toBe(expected);
  });

  it.each([
    [{ a: 1 }, true],
    [[1, 2], true],
    [[], true],
    ['x', false],
    [42, false],
    [null, false],
  ])('isStructuredContainerValue(%p) === %p', (value, expected) => {
    expect(isStructuredContainerValue(value)).toBe(expected);
  });
});

describe('isDateType', () => {
  it.each(['date', 'datetime', 'time', 'timestamp', 'qore::date', 'DATE', ' Date '])(
    'accepts %p',
    (type) => {
      expect(isDateType(type)).toBe(true);
    }
  );

  it.each(['string', 'int', 'hash', '', null, undefined, 42])('rejects %p', (type) => {
    expect(isDateType(type)).toBe(false);
  });
});

describe('qorusDateStringToIso', () => {
  it('parses the canonical Qorus timestamp (3-letter zone + micros)', () => {
    expect(qorusDateStringToIso('2026-06-10 09:14:22.512000 UTC')).toBe('2026-06-10T09:14:22.512');
  });

  it('rejects a slash-named zone (only abbreviations match — why callers use a numeric offset)', () => {
    // The strict regex allows a 3-letter zone, not `Europe/Prague`; such values
    // fall through to dateLikeStringToIso's Date.parse instead.
    expect(qorusDateStringToIso('2026-06-10 09:14:22.512000 Europe/Prague')).toBeUndefined();
  });

  it('parses a numeric offset', () => {
    expect(qorusDateStringToIso('2026-06-10 09:14:22.512000 +02:00')).toBe(
      '2026-06-10T09:14:22.512+02:00'
    );
    expect(qorusDateStringToIso('2026-06-10 09:14:22 +0200')).toBe('2026-06-10T09:14:22+02:00');
  });

  it('parses without a fraction or zone', () => {
    expect(qorusDateStringToIso('2026-06-10 09:14:22')).toBe('2026-06-10T09:14:22');
  });

  it('truncates sub-millisecond precision to 3 digits', () => {
    expect(qorusDateStringToIso('2026-06-10 09:14:22.5 UTC')).toBe('2026-06-10T09:14:22.500');
    expect(qorusDateStringToIso('2026-06-10 09:14:22.123456')).toBe('2026-06-10T09:14:22.123');
  });

  it('accepts the ISO `T` separator', () => {
    expect(qorusDateStringToIso('2026-06-10T09:14:22')).toBe('2026-06-10T09:14:22');
  });

  it('returns undefined for non-matching strings', () => {
    expect(qorusDateStringToIso('not a date')).toBeUndefined();
    expect(qorusDateStringToIso('2026-06-10')).toBeUndefined();
    expect(qorusDateStringToIso('')).toBeUndefined();
  });
});

describe('dateLikeStringToIso', () => {
  it('prefers the Qorus parser when the string matches', () => {
    expect(dateLikeStringToIso('2026-06-10 09:14:22.512000 UTC')).toBe('2026-06-10T09:14:22.512');
  });

  it('falls back to Date.parse for ISO-shaped strings', () => {
    expect(dateLikeStringToIso('2026-06-10T09:14:22.000Z')).toBe('2026-06-10T09:14:22.000Z');
  });

  it('does not treat an arbitrary parseable string as a date unless typed or date-shaped', () => {
    // "5" parses as a year via Date.parse in some engines — must be rejected
    // without a date type or a date-shaped pattern.
    expect(dateLikeStringToIso('5')).toBeUndefined();
    expect(dateLikeStringToIso('hello')).toBeUndefined();
  });

  it('honours an explicit date type for an otherwise-ambiguous value', () => {
    // The result is Date.parse-based, so it carries a zone offset — assert it
    // is a defined ISO timestamp rather than a fixed local rendering.
    const out = dateLikeStringToIso('2026/06/10', 'date');
    expect(out).toBeDefined();
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('formatIdeTimestamp', () => {
  it('formats an ISO string to `YYYY-MM-DD HH:mm:ss` in the local zone', () => {
    // Pin the seconds/date tail (zone-invariant); the hour is local.
    expect(formatIdeTimestamp('2026-06-10T09:14:22Z')).toMatch(
      /^2026-06-\d{2} \d{2}:\d{2}:22$/
    );
  });

  it('appends `.SSS` only when sub-second precision exists', () => {
    expect(formatIdeTimestamp('2026-06-10T09:14:22.512Z')).toMatch(/:22\.512$/);
    expect(formatIdeTimestamp('2026-06-10T09:14:22.000Z')).not.toMatch(/\.\d{3}$/);
  });

  it('returns the original string unchanged when it is not a date', () => {
    expect(formatIdeTimestamp('not a date')).toBe('not a date');
  });
});

describe('parseSerializedStructuredText', () => {
  it('parses a %YAML-prefixed list', () => {
    const out = parseSerializedStructuredText('%YAML 1.2\n---\n["a", "b"]\n');
    expect(out).toEqual({ data: ['a', 'b'] });
  });

  it('parses a %YAML-prefixed object', () => {
    const out = parseSerializedStructuredText('%YAML 1.2\n---\n{ host: db.local, port: 5432 }');
    expect(out).toEqual({ data: { host: 'db.local', port: 5432 } });
  });

  it('does not treat a bare `---` block as structured (only %YAML / raw brace start)', () => {
    expect(parseSerializedStructuredText('---\n{ host: db.local }')).toBeUndefined();
  });

  it('parses a raw JSON-ish object/array', () => {
    expect(parseSerializedStructuredText('{ a: 1 }')).toEqual({ data: { a: 1 } });
    expect(parseSerializedStructuredText('[1, 2, 3]')).toEqual({ data: [1, 2, 3] });
  });

  it('extracts an embedded YAML payload behind a text prefix', () => {
    const out = parseSerializedStructuredText('Error info: %YAML 1.2\n---\n{ code: 42 }');
    expect(out?.data).toEqual({ code: 42 });
    expect(out?.prefix).toBe('');
  });

  it('leaves an opaque non-structured string alone', () => {
    expect(parseSerializedStructuredText('just a plain string')).toBeUndefined();
    expect(parseSerializedStructuredText('https://example.com/path')).toBeUndefined();
    expect(parseSerializedStructuredText('')).toBeUndefined();
  });

  it('returns undefined when the candidate is a scalar, not a container', () => {
    // `--- 42` parses to a number, which is not a structured container.
    expect(parseSerializedStructuredText('--- 42')).toBeUndefined();
  });
});

describe('formatStructuredScalar', () => {
  it('renders the empty marker for nullish/empty values', () => {
    expect(formatStructuredScalar(null)).toEqual({ display: '-', type: undefined, isDate: false });
    expect(formatStructuredScalar('')).toEqual({ display: '-', type: undefined, isDate: false });
    expect(formatStructuredScalar(undefined)).toEqual({
      display: '-',
      type: undefined,
      isDate: false,
    });
  });

  it('flags a date-shaped string and formats it', () => {
    const out = formatStructuredScalar('2026-06-10 09:14:22.512000 UTC');
    expect(out.isDate).toBe(true);
    expect(out.display).toMatch(/:22\.512$/);
    expect(out.raw).toBe('2026-06-10 09:14:22.512000 UTC');
  });

  it('passes a plain string through as a non-date', () => {
    expect(formatStructuredScalar('hello')).toEqual({
      display: 'hello',
      type: undefined,
      isDate: false,
    });
  });

  it('stringifies numbers and booleans', () => {
    expect(formatStructuredScalar(42).display).toBe('42');
    expect(formatStructuredScalar(true).display).toBe('true');
  });

  it('pretty-prints objects/arrays as JSON', () => {
    expect(formatStructuredScalar({ a: 1 }).display).toBe('{\n  "a": 1\n}');
  });

  it('carries the normalised type label through', () => {
    expect(formatStructuredScalar('x', ' STRING ').type).toBe('string');
  });
});

describe('hasStructuredValue', () => {
  it('unwraps the envelope before judging emptiness', () => {
    expect(hasStructuredValue({ type: 'hash', value: { a: 1 } })).toBe(true);
    expect(hasStructuredValue({ type: 'hash', value: {} })).toBe(false);
    expect(hasStructuredValue({ type: 'list', value: [] })).toBe(false);
  });

  it.each([
    [{ a: 1 }, true],
    [[1], true],
    [{}, false],
    [[], false],
    ['x', true],
    ['', false],
    [0, true],
    [null, false],
    [undefined, false],
  ])('hasStructuredValue(%p) === %p', (value, expected) => {
    expect(hasStructuredValue(value)).toBe(expected);
  });
});
