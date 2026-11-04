// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { expressionTextOfValue } from '../src/components/form/fields/template/writtenAsText';
import { templateTextSegments, templateTextToNodes } from '../src/helpers/templateText';
import {
  hasTextAroundATemplate,
  isCompleteTemplateToken,
  templateTokenSpans,
  textAroundATemplate,
} from '../src/helpers/templates';

/*
 * A template's braced value ends where Qorus ends it (qorus#646): braces nest, and `\{`, `\}` and `\\` are a brace
 * or a backslash of the value (UserApi `_priv_get_template_bracket_arg`). The grammar ended a value at its first
 * `}`, so `$record:{prices{*}}` - the wildcard written as a template - was the chip "record: prices{*" and a
 * stray "}".
 */
describe("a template's braced value", () => {
  it('holds nested braces', () => {
    expect(isCompleteTemplateToken('$record:{prices{*}}')).toBe(true);
    expect(isCompleteTemplateToken('$record:{prices{*}.amount}')).toBe(true);
    expect(isCompleteTemplateToken('$data:{a{b{c}}}')).toBe(true);
  });

  it('holds an escaped brace or backslash as a character of the value', () => {
    expect(isCompleteTemplateToken('$record:{create.a\\{b\\}}')).toBe(true);
    expect(isCompleteTemplateToken('$record:{path\\\\}')).toBe(true);
  });

  // the PO's rule (qorus#646): `\{`, `\}` and `\\` are escapes, decoded first; braces balance, so `{*}` is
  // written unescaped; a key literally named `{*}` is the test path `\{*}`, written `$record:{h.\\{*}}`; a lone
  // brace in a key is escaped
  it("reads the PO's cases as Qorus does", () => {
    expect(isCompleteTemplateToken('$record:{h{*}}')).toBe(true);
    expect(isCompleteTemplateToken('$record:{h.\\\\{*}}')).toBe(true);
    expect(isCompleteTemplateToken('$record:{a\\{b}')).toBe(true);
    // a lone brace written unescaped does not balance: no template
    expect(isCompleteTemplateToken('$record:{a{b}')).toBe(false);
  });

  it('is no template while it is not closed', () => {
    expect(isCompleteTemplateToken('$record:{prices{*}')).toBe(false);
    // an escaped brace does not close it
    expect(isCompleteTemplateToken('$record:{create.a\\}')).toBe(false);
    expect(templateTokenSpans('x $record:{prices{*} y')).toEqual([]);
  });

  it('keeps what the grammar took before: colons, spaces, dashes, quotes and apostrophes', () => {
    for (const token of [
      '$data:{deep:test:list}',
      '$data:{id.Created by.name}',
      '$data:{abc.Multi-select}',
      "$data:{Customer's email}",
      '$qore-expr:{1 + 2}',
      '$local:input',
      '$local:a:{b}',
    ]) {
      expect(isCompleteTemplateToken(token)).toBe(true);
    }
    for (const notOne of [
      'x $data:{a.b}',
      '$data:{a.b}.csv',
      '$foo: hello',
      '$5:00 fee',
      '$local:',
    ]) {
      expect(isCompleteTemplateToken(notOne)).toBe(false);
    }
  });

  it('is one template in text, with the text around it', () => {
    expect(templateTokenSpans('SUP-$record:{prices{*}} kg')).toEqual([[4, 23]]);
    expect(hasTextAroundATemplate('$record:{prices{*}} kg')).toBe(true);
    expect(hasTextAroundATemplate('$record:{prices{*}}')).toBe(false);
    expect(textAroundATemplate('$record:{prices{*}} kg $record:{a\\}b}')).toEqual({
      text: ['kg'],
      templates: 2,
    });
  });

  it('is one chip, labeled with its whole value', () => {
    const [line] = templateTextToNodes('$record:{prices{*}} kg');
    const tags = line.children.filter((node) => 'type' in node && node.type === 'tag');
    expect(tags).toEqual([
      expect.objectContaining({ value: '$record:{prices{*}}', label: 'record: prices{*}' }),
    ]);
    expect(line.children[line.children.length - 1]).toEqual({ text: ' kg' });

    expect(templateTextSegments('$record:{prices{*}}')).toEqual([
      { kind: 'tag', value: '$record:{prices{*}}', text: 'record: prices{*}' },
    ]);
  });

  it('is written into an expression whole', () => {
    expect(expressionTextOfValue('$record:{prices{*}}')).toBe('$record:{prices{*}}');
    expect(expressionTextOfValue('SUP-$record:{prices{*}}')).toBe(
      'concat("SUP-", $record:{prices{*}})'
    );
  });
});
