// Copyright 2026 Qore Technologies, s.r.o.
/**
 * reqraft's copy of the server's type catalogue is the server's catalogue (qorus#646).
 *
 * Until a host's server answers GET /system/qorus-type-info, reqraft draws with `defaultQorusTypes`: it names the
 * types with it, and the expression builder decides with its `types_accepted` and `exact_match` which values and
 * expressions fit a place. A copy that differs from the server says other names, and offers or refuses other
 * expressions, than it does once the server answers.
 *
 * fixtures/qorusTypeInfo.json is the server's answer for qorus 974643455 (the string format types and the file type,
 * not offered; every entry says whether it is offered): QorusDataTypeCatalogue::Info of that commit, as the endpoint
 * answers it in English, with the DataProvider of Qore 28a6bbcb14 that gives the new types their names - no
 * running server had it yet. When the server's catalogue changes, record its answer again and change the copy
 * until this passes:
 *
 *   qrest -j system/qorus-type-info | yarn -s record:type-info
 */
import { describe, expect, it } from 'vitest';
import { areQorusTypesCompatible } from '../src/helpers/expressions';
import { offeredQorusTypes } from '../src/helpers/qorusTypeCatalogue';
import { defaultQorusTypes, getQorusTypes, qorusTypeDisplayName } from '../src/hooks/useQorusTypes';
import recorded from './fixtures/qorusTypeInfo.json';

describe("reqraft's copy of the server's type catalogue", () => {
  it("is the server's answer, type for type and field for field", () => {
    expect(defaultQorusTypes).toEqual(recorded);
  });

  it('lists the types the server lists, in its order', () => {
    expect(defaultQorusTypes.map((type) => type.name)).toEqual(recorded.map((type) => type.name));
    expect(defaultQorusTypes.map((type) => type.name)).toContain('data-provider');
  });

  it('converts between types as the server does', () => {
    const conversions = (
      types: { name: string; types_accepted: string[]; exact_match?: string[] }[]
    ) =>
      Object.fromEntries(
        types.map(({ name, types_accepted, exact_match }) => [
          name,
          { types_accepted, exact_match },
        ])
      );
    expect(conversions(defaultQorusTypes as never)).toEqual(conversions(recorded));
    // a whole number takes the other numbers, as the server says; Qore's other name for it is no type of its own
    expect(defaultQorusTypes.find((type) => type.name === 'int')?.types_accepted).toEqual([
      'int',
      'float',
      'number',
    ]);
  });

  it('is what reqraft answers with before the server does', () => {
    expect(getQorusTypes()).toBe(defaultQorusTypes);
  });

  // the recording itself: a bad one would make the comparisons above pass or fail for the wrong reason
  it('is compared with a whole answer: every type with all its fields', () => {
    expect(recorded.length).toBeGreaterThan(0);
    for (const type of recorded) {
      expect(Object.keys(type).sort()).toEqual(
        [
          'desc',
          'display_name',
          'exact_match',
          'name',
          'offered',
          'sentence_form',
          'short_desc',
          'types_accepted',
        ].sort()
      );
    }
  });
});

// qorus 974643455: the server gives a field of a string format type, or of a file, that type as its UI type
describe('the types that name fields but are not offered', () => {
  const FORMATS = ['email', 'uri', 'uuid', 'hostname', 'ipv4', 'ipv6', 'phone'];

  it('are named as the DataProvider module names them', () => {
    expect(
      [...FORMATS, 'file'].map((name) => qorusTypeDisplayName(defaultQorusTypes, name))
    ).toEqual([
      'Email address',
      'Address (URI)',
      'Unique identifier (UUID)',
      'Host name',
      'IPv4 address',
      'IPv6 address',
      'Phone number',
      'File',
    ]);
  });

  it('take text, and are text; a file takes a hash, and is one', () => {
    for (const format of FORMATS) {
      expect(areQorusTypesCompatible(format, 'string', defaultQorusTypes), format).toBe(true);
      expect(areQorusTypesCompatible(format, 'int', defaultQorusTypes), format).toBe(false);
      expect(areQorusTypesCompatible('data', format, defaultQorusTypes), format).toBe(true);
    }
    expect(areQorusTypesCompatible('file', 'hash', defaultQorusTypes)).toBe(true);
    expect(areQorusTypesCompatible('hash', 'file', defaultQorusTypes)).toBe(true);
  });

  it('are left out of a picker that lists every type, unless a value has one', () => {
    const offered = offeredQorusTypes(defaultQorusTypes).map((type) => type.name);
    expect(offered).toEqual(
      defaultQorusTypes.filter((type) => type.offered).map((type) => type.name)
    );
    expect(offered).not.toContain('email');
    expect(offered).not.toContain('file');
    expect(offered).toContain('rgbcolor');

    const withHeld = offeredQorusTypes(defaultQorusTypes, '*email').map((type) => type.name);
    expect(withHeld).toContain('email');
    expect(withHeld).not.toContain('phone');
  });
});
