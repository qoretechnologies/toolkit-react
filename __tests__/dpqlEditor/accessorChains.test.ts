// Copyright 2026 Qore Technologies, s.r.o.
// A field with accessors is one chip (qorus#646, David): the server writes a reference with a selector back as
// `@create.items[*].id`, and the editor drew the chip `create.items` followed by the plain text `[*].id`.
import {
  dpqlFieldName,
  dpqlHoverOffsets,
  endsDpqlReference,
  getTagLabel,
  plainTextToSlate,
  slateToPlainText,
} from '../../src/components/dpqlEditor/dpqlHelpers';
import { ISlateElement } from '../../src/components/smartEditor/types';

const chipsIn = (text: string) =>
  plainTextToSlate(text).flatMap((paragraph) =>
    paragraph.children
      .filter((node): node is ISlateElement => (node as ISlateElement).type === 'tag')
      .map(({ value, label }) => ({ value, label }))
  );

describe('a field with accessors is one chip', () => {
  const chains: [string, string][] = [
    ['@create.items[*].id', 'create.items[*].id'],
    ['@orders[*]', 'orders[*]'],
    ['@prices{*}', 'prices{*}'],
    ['@prices{*}.amount', 'prices{*}.amount'],
    ['@items[0].id', 'items[0].id'],
    ['@items[-1]', 'items[-1]'],
    // a key that is a name after an accessor, as the server writes it now (Qore f341ddfc0)
    ['@create.items[0].id', 'create.items[0].id'],
    ['@items[0].order-id', 'items[0].order-id'],
    // a key that needs quoting keeps its braces, and so does a key directly after a field
    ['@create.items[0]{"a b"}', 'create.items[0]{"a b"}'],
    ['@headers{"content-type"}', 'headers{"content-type"}'],
    ['@a{b}', 'a{b}'],
    ['@h{a, "b c"}', 'h{a, "b c"}'],
    // as the server wrote a key after an index before
    ['@create.items[0]{"id"}', 'create.items[0]{"id"}'],
    ['@orders[*].lines[*].sku', 'orders[*].lines[*].sku'],
    ['@"order-lines"[*].id', 'order-lines[*].id'],
  ];

  test.each(chains)('%s, labeled %s, written back exactly', (text, label) => {
    expect(chipsIn(text)).toEqual([{ value: text, label }]);
    expect(slateToPlainText(plainTextToSlate(text))).toBe(text);
  });

  test('in an expression: the chain ends where the accessors do', () => {
    const text = 'size(@orders[*].id) + size(@prices{*}) > @items[0]';
    expect(chipsIn(text).map(({ label }) => label)).toEqual([
      'orders[*].id',
      'prices{*}',
      'items[0]',
    ]);
    expect(slateToPlainText(plainTextToSlate(text))).toBe(text);
  });

  test('what is not an accessor is not part of it', () => {
    // a slice, an expression in brackets, a hash literal
    expect(chipsIn('@items[1..2]')).toEqual([{ value: '@items', label: 'items' }]);
    expect(chipsIn('@items[@i]').map(({ value }) => value)).toEqual(['@items', '@i']);
    expect(chipsIn('@a {"x": 1}')).toEqual([{ value: '@a', label: 'a' }]);
    // an unclosed key
    expect(chipsIn('@h{"x')).toEqual([{ value: '@h', label: 'h' }]);
  });

  test('its name and label, for the renderer and a completion', () => {
    expect(dpqlFieldName('@create.items[*].id')).toBe('create.items[*].id');
    expect(dpqlFieldName('@"order-lines"[*].id')).toBe('order-lines[*].id');
    expect(getTagLabel('@"a\\"b"{*}')).toBe('a"b{*}');
  });

  test("names where the server says something of each part of its chip, for the chip's hover", () => {
    // the field, the * of the wildcard, the name after it
    expect(dpqlHoverOffsets('@create.items[*].id')).toEqual([0, 14, 17]);
    // an index is a number to the server: not a part of its own
    expect(dpqlHoverOffsets('@items[0].id')).toEqual([0, 10]);
    expect(dpqlHoverOffsets('@prices{*}')).toEqual([0, 8]);
    expect(dpqlHoverOffsets('@h{"a b"}')).toEqual([0, 3]);
    expect(dpqlHoverOffsets('@h{ a, "b c"}')).toEqual([0, 4]);
    expect(dpqlHoverOffsets('@"a b"[*]')).toEqual([0, 7]);
    // a field alone, and a template, are one part
    expect(dpqlHoverOffsets('@name')).toEqual([0]);
    expect(dpqlHoverOffsets('$record:{orders[*].id}')).toEqual([0]);
  });

  test('typed, an opening bracket does not end the field: an accessor may follow', () => {
    expect(endsDpqlReference('[')).toBe(false);
    expect(endsDpqlReference(' ')).toBe(true);
  });
});
