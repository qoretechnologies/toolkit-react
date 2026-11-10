// Copyright 2026 Qore Technologies, s.r.o.
/* What a place takes, said once for each name: types can be one name, and a host says how they are joined. */
import { afterEach, describe, expect, it } from 'vitest';
import {
  defaultQorusTypes,
  qorusTypeSentenceForm,
  typesInASentence,
} from '../src/helpers/qorusTypeCatalogue';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';

const form =
  (types = defaultQorusTypes) =>
  (name: string | undefined) =>
    qorusTypeSentenceForm(types, name);

afterEach(() => {
  setReqraftLabels();
});

describe('the types a place takes, in a sentence', () => {
  it('says once a name two types share', () => {
    // no sentence form on an older server: the display name, twice
    const old = [
      { name: 'int', display_name: 'Integer' },
      { name: 'integer', display_name: 'Integer' },
    ] as never;
    expect(typesInASentence(['int', 'integer'], form(old))).toBe('a value of type Integer');
  });

  it('says once what a soft or optional type is the same as', () => {
    expect(typesInASentence(['int', 'softint', '*int'], form())).toBe('a whole number');
  });

  it('says once two types of one sentence form', () => {
    expect(typesInASentence(['string', 'richtext'], form())).toBe('text');
  });

  it('joins what differs, in order', () => {
    expect(typesInASentence(['int', 'string'], form())).toBe('a whole number or text');
  });

  it('has nothing to say of no type', () => {
    expect(typesInASentence([], form())).toBeUndefined();
    expect(typesInASentence([undefined], form())).toBeUndefined();
  });

  it('joins in a host’s words, and again when the language changes', () => {
    setReqraftLabels({ formEngine: { typesJoin: (types) => types.join(' oder ') } });
    expect(typesInASentence(['int', 'string'], form())).toBe('a whole number oder text');
    setReqraftLabels();
    expect(typesInASentence(['int', 'string'], form())).toBe('a whole number or text');
  });
});
