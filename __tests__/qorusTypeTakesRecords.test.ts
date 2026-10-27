import { describe, expect, it } from 'vitest';
import { defaultQorusTypes, qorusTypeTakesRecords } from '../src/helpers/qorusTypeCatalogue';

/**
 * Where a record - a hash, a Qog state's data - is offered whole (qorus#646, David's review: "Any or hash yes,
 * scalar no"): a hash in any of its spellings, and a type whose base type is a hash; not text, which converts any
 * value, and not a number.
 */
describe('qorusTypeTakesRecords', () => {
  it('a hash, in its own, optional and complex spellings', () => {
    for (const type of ['hash', '*hash', 'hash<auto>', 'softhash']) {
      expect(qorusTypeTakesRecords(defaultQorusTypes, type), type).toBe(true);
    }
  });

  it('a type the catalogue does not list, by its base type', () => {
    expect(qorusTypeTakesRecords(defaultQorusTypes, '/orders/order', 'hash')).toBe(true);
    expect(qorusTypeTakesRecords(defaultQorusTypes, '/orders/postcode', 'string')).toBe(false);
  });

  it('not text, though it converts any value, nor a number, nor a date', () => {
    for (const type of ['string', '*string', 'int', 'float', 'date', 'bool']) {
      expect(qorusTypeTakesRecords(defaultQorusTypes, type), type).toBe(false);
    }
  });

  it("reads reqraft's catalogue until the server's answers, and nothing of no type", () => {
    expect(qorusTypeTakesRecords([], 'hash')).toBe(true);
    expect(qorusTypeTakesRecords(undefined, undefined)).toBe(false);
  });
});
