// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A type is called what the Qorus server calls it (qorus#646, David's names: Text, Whole number, Number,
 * Exact number, True or false, Date).
 *
 * The server's type catalogue (QorusDataTypeCatalogue::Info, served at /system/qorus-type-info) is the one source
 * of a type's name. Until it arrives reqraft draws with its own copy, `defaultQorusTypes`, and words its condition
 * and type messages with it - so a copy that drifts says one name in a fallback and another once the server
 * answers. fixtures/qorusTypeInfo.json is a recorded answer of the server; qorusTypeCatalogue.test.ts compares the
 * whole copy with it, and these tests the names reqraft words with.
 */
import { describe, expect, it } from 'vitest';
import { getImmediateValueTypes } from '../src/components/form/fields/auto/AutoFormField';
import { conditionErrorText } from '../src/helpers/expressions';
import { defaultQorusTypes } from '../src/hooks/useQorusTypes';
import recorded from './fixtures/qorusTypeInfo.json';

/** The server catalogue's names for each type: its display name (a label) and its sentence form. */
const serverNames: Record<string, { display_name: string; sentence_form: string }> = Object.fromEntries(
  recorded.map(({ name, display_name, sentence_form }) => [name, { display_name, sentence_form }])
);
const serverName = Object.fromEntries(
  Object.entries(serverNames).map(([type, names]) => [type, names.display_name])
);

describe("reqraft's fallback type list", () => {
  it('calls every type what the server catalogue calls it', () => {
    for (const type of defaultQorusTypes) {
      expect({ type: type.name, name: type.display_name }).toEqual({
        type: type.name,
        name: serverName[type.name],
      });
    }
  });

  it('names every type inside a sentence as the server catalogue does', () => {
    for (const type of defaultQorusTypes) {
      expect({ type: type.name, sentence: type.sentence_form }).toEqual({
        type: type.name,
        sentence: serverNames[type.name]?.sentence_form,
      });
    }
  });

  it('lists the data types the server catalogue has', () => {
    for (const name of [
      'any',
      'string',
      'richtext',
      'int',
      'float',
      'number',
      'bool',
      'date',
      'time',
      'binary',
      'hash',
      'list',
    ]) {
      expect(defaultQorusTypes.map((type) => type.name)).toContain(name);
      expect(serverName[name]).toBeTruthy();
    }
  });

  it('names each type as David decided, and no two the same', () => {
    expect(
      Object.fromEntries(
        ['string', 'richtext', 'int', 'float', 'number', 'bool', 'date'].map((name) => [
          name,
          defaultQorusTypes.find((type) => type.name === name)?.display_name,
        ])
      )
    ).toEqual({
      string: 'Text',
      // text that can hold templates is text to a user: the editor it is written in is not a kind of value
      richtext: 'Text',
      int: 'Whole number',
      float: 'Number',
      number: 'Exact number',
      bool: 'True or false',
      date: 'Date',
    });
    // a picker lists the offered types: no two of those share a name (richtext is text, and not offered)
    const names = defaultQorusTypes.filter((type) => type.offered !== false).map((type) => type.display_name);
    expect(new Set(names).size).toBe(names.length);
    expect(defaultQorusTypes.find((type) => type.name === 'richtext')?.offered).toBe(false);
  });
});

describe('the words that name a type before the server answers', () => {
  it("the type picker calls a type the catalogue's name, where David named it", () => {
    const picker = Object.fromEntries(
      getImmediateValueTypes().map((type) => [type.name, type.display_name])
    );
    for (const name of ['string', 'int', 'float', 'bool', 'date', 'binary', 'list']) {
      expect({ type: name, name: picker[name] }).toEqual({ type: name, name: serverName[name] });
    }
  });

  it('a condition of text says "text", as the server does', () => {
    const name = defaultQorusTypes.find((type) => type.name === 'string')!.sentence_form!;
    expect(conditionErrorText(name, 'string')).toMatch(
      /^The condition evaluates to text, but it must evaluate to true or false\./
    );
  });
});
