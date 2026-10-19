import { describe, expect, it } from 'vitest';
import {
  mockParseDpql,
  mockRenderDpql,
  mockSerializeDpql,
} from '../src/components/form/expressions/dpqlMockLanguage';
import {
  readRecordReference,
  recordReferenceDpql,
} from '../src/components/form/expressions/dpqlMockRecordPath';

/**
 * The stories' stand-in for the Qorus language server writes a record field as the server does (qorus#646): Qorus
 * reads `$record:{<path>}` as a test path and gives it as a field reference, or the accessors over one
 * (`QorusRecordPath::reference()`), and the DPQL serializer writes those with its accessor sugar and qore#5480's path
 * rule: dots separate the parts of a name, quoted or bare, and a dot that is part of a key is `\.`. It wrote the
 * template (`$record:{pos} + 1`), which is not what a user sees on the Expression tab.
 */
const WRITTEN: Array<[string, string]> = [
  ['$record:{pos}', '@pos'],
  ['$record:{create.status}', '@create.status'],
  ['$record:{menge_bestätigt}', '@menge_bestätigt'],
  // a part that is not a name: the path is one quoted name, its dots still separating its parts
  ['$record:{create.order-id}', '@"create.order-id"'],
  ['$record:{a b}', '@"a b"'],
  // a dot that is part of a key (qore#5480)
  ['$record:{Unit\\.Price}', '@"Unit\\.Price"'],
  // the accessors, as the serializer writes them
  ['$record:{orders[*].id}', '@orders[*].id'],
  ['$record:{create.items[*].id}', '@create.items[*].id'],
  ['$record:{orders[*]}', '@orders[*]'],
  ['$record:{orders[*].order-id}', '@orders[*].order-id'],
  ['$record:{orders[*].a b}', '@orders[*]{"a b"}'],
  ['$record:{prices{*}}', '@prices{*}'],
  ['$record:{prices{*}.amount}', '@prices{*}.amount'],
  ['$record:{items[0].sku}', '@items[0].sku'],
  ['$record:{items[0].a b}', '@items[0]{"a b"}'],
  ['$record:{items[0][1]}', '@items[0][1]'],
];

describe('a record field written by the stories’ server', () => {
  it.each(WRITTEN)('%s is written %s', (template, dpql) => {
    expect(recordReferenceDpql(template)).toBe(dpql);
  });

  it('reads the template escapes of the braces first', () => {
    expect(recordReferenceDpql('$record:{prices\\{*\\}.amount}')).toBe('@prices{*}.amount');
  });

  it('leaves what is not a record field, and a path the accessors cannot give', () => {
    expect(recordReferenceDpql('$local:name')).toBeUndefined();
    expect(recordReferenceDpql('$data:{create.status}')).toBeUndefined();
    expect(recordReferenceDpql('plain text')).toBeUndefined();
    expect(recordReferenceDpql(12)).toBeUndefined();
    // it does not start with a field, or a list selector is neither * nor an index
    expect(recordReferenceDpql('$record:{[0]}')).toBeUndefined();
    expect(recordReferenceDpql('$record:{orders[x]}')).toBeUndefined();
  });
});

describe('a record field read by the stories’ server', () => {
  it.each(WRITTEN)('%s is read back from %s', (template, dpql) => {
    expect(readRecordReference(`${dpql} == 1`)).toEqual({ template, length: dpql.length });
  });

  it('stops where the reference ends', () => {
    expect(readRecordReference('@pos + 1')).toEqual({ template: '$record:{pos}', length: 4 });
    expect(readRecordReference('@items[0].sku, 2')).toEqual({
      template: '$record:{items[0].sku}',
      length: '@items[0].sku'.length,
    });
  });

  it('reads a key given in braces as a part of the path', () => {
    expect(readRecordReference('@headers{"content-type"}')?.template).toBe(
      '$record:{headers.content-type}'
    );
    expect(readRecordReference('@headers{"a.b"}')?.template).toBe('$record:{headers.a\\.b}');
  });

  it('is nothing where the text does not start with a field', () => {
    expect(readRecordReference('pos')).toBeUndefined();
    expect(readRecordReference('@')).toBeUndefined();
  });
});

describe('an expression holding a record field', () => {
  const POS_PLUS_ONE = {
    exp: '+',
    args: [
      { type: 'int', value: '$record:{pos}' },
      { type: 'int', value: 1 },
    ],
  };

  it('is written with the field reference, and read back to the same expression', () => {
    const { dpql } = mockSerializeDpql(POS_PLUS_ONE);

    expect(dpql).toBe('@pos + 1');
    expect(mockSerializeDpql(mockParseDpql(dpql).expression).dpql).toBe('@pos + 1');
  });

  it('round-trips a quoted path and an accessor chain', () => {
    for (const text of [
      '@"create.order-id" == "A-1"',
      'size(@orders[*].id) > 0',
      '@"Unit\\.Price" > 10',
    ]) {
      expect(mockSerializeDpql(mockParseDpql(text).expression).dpql).toBe(text);
    }
  });

  it('is rendered with the field as its chip', () => {
    expect(mockRenderDpql(POS_PLUS_ONE).rendered).toBe('$record:{pos} + 1');
  });
});
