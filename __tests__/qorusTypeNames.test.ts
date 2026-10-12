// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A type is called what the Qorus server calls it (qorus#646, David's names: Text, Rich text, Whole number, Number,
 * Exact number, True or false, Date).
 *
 * The server's type catalogue (QorusDataTypeCatalogue::Info, served at /system/qorus-type-info) is the one source
 * of a type's name. Until it arrives reqraft draws with its own copy, `defaultQorusTypes`, and words its condition
 * and type messages with it - so a copy that drifts says one name in a fallback and another once the server
 * answers. fixtures/qorusTypeCatalogueNames.json is the server catalogue's names. When the server's catalogue
 * changes, refresh it from the qorus checkout and fix the fallback until this passes:
 *
 *   yarn refresh:type-names ~/src/Qorus/git/qorus/Classes/QorusDataTypeCatalogue.qc
 */
import { describe, expect, it } from 'vitest';
import { getImmediateValueTypes } from '../src/components/form/fields/auto/AutoFormField';
import { conditionErrorText } from '../src/helpers/expressions';
import { defaultQorusTypes } from '../src/hooks/useQorusTypes';
import catalogue from './fixtures/qorusTypeCatalogueNames.json';

const serverName = catalogue as Record<string, string>;

describe("reqraft's fallback type list", () => {
  it('calls every type what the server catalogue calls it', () => {
    for (const type of defaultQorusTypes) {
      expect({ type: type.name, name: type.display_name }).toEqual({
        type: type.name,
        name: serverName[type.name],
      });
    }
  });

  it('lists the data types the server catalogue has', () => {
    for (const name of [
      'any', 'string', 'richtext', 'int', 'float', 'number', 'bool', 'date', 'binary', 'hash', 'list',
    ]) {
      expect(defaultQorusTypes.map((type) => type.name)).toContain(name);
      expect(serverName[name]).toBeTruthy();
    }
  });

  it("names each type as David decided, and no two the same", () => {
    expect(
      Object.fromEntries(
        ['string', 'richtext', 'int', 'float', 'number', 'bool', 'date'].map((name) => [
          name,
          defaultQorusTypes.find((type) => type.name === name)?.display_name,
        ])
      )
    ).toEqual({
      string: 'Text',
      richtext: 'Rich text',
      int: 'Whole number',
      float: 'Number',
      number: 'Exact number',
      bool: 'True or false',
      date: 'Date',
    });
    const names = defaultQorusTypes.map((type) => type.display_name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('the words that name a type before the server answers', () => {
  it("the type picker calls a type the catalogue's name, where David named it", () => {
    const picker = Object.fromEntries(getImmediateValueTypes().map((type) => [type.name, type.display_name]));
    for (const name of ['string', 'int', 'float', 'bool', 'date', 'binary', 'list']) {
      expect({ type: name, name: picker[name] }).toEqual({ type: name, name: serverName[name] });
    }
  });

  it('a condition of text says "Text", as the server does', () => {
    const name = defaultQorusTypes.find((type) => type.name === 'string')!.display_name;
    expect(conditionErrorText(name, 'string')).toMatch(/^The condition evaluates to Text, but it must evaluate to true or false\./);
  });
});
