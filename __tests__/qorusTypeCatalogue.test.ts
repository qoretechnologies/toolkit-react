// Copyright 2026 Qore Technologies, s.r.o.
/**
 * reqraft's copy of the server's type catalogue is the server's catalogue (qorus#646).
 *
 * Until a host's server answers GET /system/qorus-type-info, reqraft draws with `defaultQorusTypes`: it names the
 * types with it, and the expression builder decides with its `types_accepted` and `exact_match` which values and
 * expressions fit a place. A copy that differs from the server says other names, and offers or refuses other
 * expressions, than it does once the server answers.
 *
 * fixtures/qorusTypeInfo.json is a server's answer, recorded from professor (qorus 8.0.0 develop 354e7eafa, which has
 * the catalogue of c6b3fb97c). When the server's catalogue changes, record its answer again and change the copy
 * until this passes:
 *
 *   qrest -j system/qorus-type-info | yarn -s record:type-info
 */
import { describe, expect, it } from 'vitest';
import { defaultQorusTypes, getQorusTypes } from '../src/hooks/useQorusTypes';
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
          'sentence_form',
          'short_desc',
          'types_accepted',
        ].sort()
      );
    }
  });
});
