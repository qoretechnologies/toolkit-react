// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What kind of value an option takes, in words (qorus#646, David's decision): an open option shows it beside its
 * name, and "Show field types" shows it on read rows - never the type's code (`<string>`, IDE rule 7).
 */
import { describe, expect, it } from 'vitest';
import {
  builtInTypeName,
  builtInTypeSentenceForm,
  defaultQorusTypes,
  optionTypeSentence,
  optionTypeWords,
  qorusTypeKnownName,
} from '../src/helpers/qorusTypeCatalogue';

describe("an option's type in words", () => {
  it("is its type's name in the catalogue", () => {
    expect(optionTypeWords({ type: 'string' }, builtInTypeName)).toBe('Text');
    expect(optionTypeWords({ type: 'int' }, builtInTypeName)).toBe('Whole number');
    expect(optionTypeWords({ type: '*int' }, builtInTypeName)).toBe('Whole number');
  });

  it("is its kind of control's name where the catalogue names it, else its type's", () => {
    expect(optionTypeWords({ type: 'rgbcolor', ui_type: 'rgbcolor' }, builtInTypeName)).toBe(
      'Color'
    );
    expect(optionTypeWords({ type: 'string', ui_type: 'long-string' }, builtInTypeName)).toBe(
      'Text'
    );
  });

  it('says what a list holds after it', () => {
    expect(optionTypeWords({ type: 'list', ui_element_type: 'string' }, builtInTypeName)).toBe(
      'List (Text)'
    );
  });

  it('is nothing where the catalogue names neither: never the code', () => {
    expect(optionTypeWords({ type: 'some-custom-type' }, builtInTypeName)).toBeUndefined();
    expect(optionTypeWords(undefined, builtInTypeName)).toBeUndefined();
  });

  it("is in the words of the catalogue it is given: the server's, in its language", () => {
    const german = defaultQorusTypes.map((type) =>
      type.name === 'string' ? { ...type, display_name: 'Text (de)' } : type
    );
    expect(optionTypeWords({ type: 'string' }, (name) => qorusTypeKnownName(german, name))).toBe(
      'Text (de)'
    );
  });
});

describe("an option's type inside a sentence, as its hover and its help say it", () => {
  const sentence = (schema: Record<string, unknown>) =>
    optionTypeSentence(schema, builtInTypeName, builtInTypeSentenceForm);

  it('is the sentence form of its kind of control, or of its type', () => {
    expect(sentence({ type: 'int' })).toBe('a whole number');
    expect(sentence({ type: 'string' })).toBe('text');
    expect(sentence({ type: 'rgbcolor', ui_type: 'rgbcolor' })).toBe('a color');
    expect(sentence({ type: 'string', ui_type: 'long-string' })).toBe('text');
  });

  it('is nothing where the catalogue names neither', () => {
    expect(sentence({ type: 'some-custom-type' })).toBeUndefined();
  });
});
