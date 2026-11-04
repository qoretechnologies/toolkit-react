// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { fieldPathOf, fieldPathTemplate } from '../src/components/form/expressions/fieldPath';
import { IExpression } from '../src/components/form/expressions/types';

/*
 * A field path written with accessors is read as the path it is (qorus#646): the server reads `@orders[*].id` and
 * `$record:{orders[*].id}` into accessor operations over record fields, and those are drawn as the path, not as an
 * operation with a source and a body.
 */
const field = (name: string): IExpression => ({ type: 'auto', value: `$record:{${name}}` });
const op = (exp: string, ...args: IExpression[]): IExpression => ({
  is_expression: true,
  value: { exp, args },
});
const item: IExpression = op('wildcard_item');

describe('fieldPathOf', () => {
  it('reads the paths the server writes as accessor operations', () => {
    // @orders[*].id
    expect(fieldPathOf(op('list_wildcard', field('orders'), field('id')))).toBe('orders[*].id');
    // @orders[*]
    expect(fieldPathOf(op('list_wildcard', field('orders'), item))).toBe('orders[*]');
    // @prices{*}.amount: the body reads from the value
    expect(fieldPathOf(op('hash_wildcard', field('prices'), field('value.amount')))).toBe(
      'prices{*}.amount'
    );
    // @prices{*}
    expect(fieldPathOf(op('hash_wildcard', field('prices'), field('value')))).toBe('prices{*}');
    // @items[0].id
    expect(
      fieldPathOf(
        op('key', op('index', field('items'), { type: 'int', value: 0 }), {
          type: 'string',
          value: 'id',
        })
      )
    ).toBe('items[0].id');
    // a dotted field
    expect(fieldPathOf(op('list_wildcard', field('create.items'), field('id')))).toBe(
      'create.items[*].id'
    );
  });

  it('reads nested wildcards, and accessors on the item', () => {
    // @orders[*].lines[*].sku
    expect(
      fieldPathOf(
        op('list_wildcard', field('orders'), op('list_wildcard', field('lines'), field('sku')))
      )
    ).toBe('orders[*].lines[*].sku');
    // @matrix[*][0]
    expect(
      fieldPathOf(
        op('list_wildcard', field('matrix'), op('index', item, { type: 'int', value: 0 }))
      )
    ).toBe('matrix[*][0]');
    // @prices{*}.tiers[*].amount
    expect(
      fieldPathOf(
        op(
          'hash_wildcard',
          field('prices'),
          op('list_wildcard', field('value.tiers'), field('amount'))
        )
      )
    ).toBe('prices{*}.tiers[*].amount');
  });

  it('writes a key as a test path does, after a dot, and is no path for a key a test path would misread', () => {
    // the path is what `$record:{…}` holds: a test path
    expect(
      fieldPathOf(op('key', field('headers'), { type: 'string', value: 'content-type' }))
    ).toBe('headers.content-type');
    expect(fieldPathOf(op('key', field('headers'), { type: 'string', value: 'a b' }))).toBe(
      'headers.a b'
    );
    for (const key of ['a.b', 'a[0]', 'a{b}', 'a\\b', '']) {
      expect(
        fieldPathOf(op('key', field('headers'), { type: 'string', value: key }))
      ).toBeUndefined();
    }
  });

  it('takes the operation itself, or the operand that holds it', () => {
    expect(fieldPathOf({ exp: 'list_wildcard', args: [field('orders'), field('id')] })).toBe(
      'orders[*].id'
    );
  });

  it('is no path for anything else: the operation is drawn as it is', () => {
    // a field alone is the field
    expect(fieldPathOf(field('orders'))).toBeUndefined();
    // an operation that is not an accessor
    expect(
      fieldPathOf(op('size', op('list_wildcard', field('orders'), field('id'))))
    ).toBeUndefined();
    // a body that is not a path: a literal, a sum
    expect(
      fieldPathOf(op('list_wildcard', field('orders'), { type: 'int', value: 1 }))
    ).toBeUndefined();
    expect(
      fieldPathOf(op('list_wildcard', field('orders'), op('+', field('a'), field('b'))))
    ).toBeUndefined();
    // a hash body that does not read from the value
    expect(fieldPathOf(op('hash_wildcard', field('prices'), field('key')))).toBeUndefined();
    // the item outside a wildcard, a template that is not a record field, an index that is not a whole number
    expect(fieldPathOf(item)).toBeUndefined();
    expect(
      fieldPathOf(op('list_wildcard', { type: 'auto', value: '$local:{orders}' }, field('id')))
    ).toBeUndefined();
    expect(
      fieldPathOf(op('index', field('items'), { type: 'auto', value: '$local:{i}' }))
    ).toBeUndefined();
    expect(fieldPathOf(op('index', field('items'), { type: 'float', value: 1.5 }))).toBeUndefined();
    // a wildcard missing its body
    expect(fieldPathOf(op('list_wildcard', field('orders')))).toBeUndefined();
    expect(fieldPathOf(undefined)).toBeUndefined();
  });

  it('is drawn as the chip a record field is', () => {
    expect(fieldPathTemplate('orders[*].id')).toBe('$record:{orders[*].id}');
  });
});
