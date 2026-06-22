import {
  moveItem,
  removeKey,
  renameKey,
  sectionCount,
  setKey,
  uniqueKey,
} from '../../src/components/form/fields/schema-definition/helpers';

describe('schemaDefinition/helpers', () => {
  describe('renameKey', () => {
    it('renames a key while preserving every entry position', () => {
      const cols = { id: 1, name: 2, email: 3 };
      const renamed = renameKey(cols, 'name', 'full_name');
      // Order matters — a column rename must not reshuffle the table.
      expect(Object.keys(renamed)).toEqual(['id', 'full_name', 'email']);
      expect(renamed.full_name).toBe(2);
    });

    it('is a no-op when the key is unchanged', () => {
      const cols = { a: 1, b: 2 };
      expect(renameKey(cols, 'a', 'a')).toEqual(cols);
    });

    it('does not mutate the input', () => {
      const cols = { a: 1 };
      renameKey(cols, 'a', 'b');
      expect(cols).toEqual({ a: 1 });
    });
  });

  describe('setKey / removeKey', () => {
    it('sets a key immutably', () => {
      const original = { a: 1 };
      const next = setKey(original, 'b', 2);
      expect(next).toEqual({ a: 1, b: 2 });
      expect(original).toEqual({ a: 1 });
    });

    it('removes a key immutably', () => {
      const original = { a: 1, b: 2 };
      const next = removeKey(original, 'a');
      expect(next).toEqual({ b: 2 });
      expect(original).toEqual({ a: 1, b: 2 });
    });

    it('treats an undefined hash as empty', () => {
      expect(setKey(undefined, 'a', 1)).toEqual({ a: 1 });
      expect(removeKey(undefined, 'a')).toEqual({});
    });
  });

  describe('moveItem', () => {
    it('moves a list element to a new position', () => {
      expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
      expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    });

    it('returns the list unchanged for a no-op or out-of-range move', () => {
      expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
      expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
    });
  });

  describe('uniqueKey', () => {
    it('returns the base key when it is free', () => {
      expect(uniqueKey({ other: 1 }, 'new_table')).toBe('new_table');
    });

    it('suffixes to avoid clobbering an existing entry', () => {
      expect(uniqueKey({ new_table: 1 }, 'new_table')).toBe('new_table_2');
      expect(
        uniqueKey({ new_table: 1, new_table_2: 1 }, 'new_table')
      ).toBe('new_table_3');
    });
  });

  describe('sectionCount', () => {
    it('counts hash entries and tolerates non-hashes', () => {
      expect(sectionCount({ a: 1, b: 2 })).toBe(2);
      expect(sectionCount(undefined)).toBe(0);
      expect(sectionCount('not a hash')).toBe(0);
    });
  });
});
