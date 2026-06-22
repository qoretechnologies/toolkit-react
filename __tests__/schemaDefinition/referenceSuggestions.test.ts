import {
  buildTableSectionResolver,
  otherTableNames,
  tableColumnNames,
} from '../../src/components/form/fields/schema-definition/referenceSuggestions';
import { IDataSchemaDefinition } from '../../src/components/form/fields/schema-definition/types';

const definition: IDataSchemaDefinition = {
  schema: { name: 'shop', version: '1.0' },
  tables: {
    customers: {
      columns: {
        customer_id: {},
        name: {},
        email: {},
      },
    },
    addresses: {
      columns: {
        address_id: {},
        customer_id: {},
        line1: {},
      },
    },
  },
};

describe('schemaDefinition/referenceSuggestions', () => {
  describe('tableColumnNames', () => {
    it('returns the column keys of the named table', () => {
      expect(tableColumnNames(definition, 'customers')).toEqual([
        'customer_id',
        'name',
        'email',
      ]);
    });

    it('returns [] for an unknown table or missing definition', () => {
      expect(tableColumnNames(definition, 'ghosts')).toEqual([]);
      expect(tableColumnNames(null, 'customers')).toEqual([]);
      expect(tableColumnNames(definition, undefined)).toEqual([]);
    });
  });

  describe('otherTableNames', () => {
    it("excludes the named table from the schema's tables", () => {
      expect(otherTableNames(definition, 'customers')).toEqual(['addresses']);
    });

    it('returns every table when no current table is supplied', () => {
      expect(otherTableNames(definition, undefined)).toEqual([
        'customers',
        'addresses',
      ]);
    });
  });

  describe('buildTableSectionResolver', () => {
    it('suggests the parent table columns for a primary-key columns list', () => {
      const resolve = buildTableSectionResolver(
        definition,
        'customers',
        'primary_key'
      );
      expect(resolve('columns', undefined)).toEqual([
        'customer_id',
        'name',
        'email',
      ]);
      expect(resolve('name', undefined)).toBeUndefined();
    });

    it('suggests the parent table columns for a unique constraint', () => {
      const resolve = buildTableSectionResolver(
        definition,
        'customers',
        'unique_constraints'
      );
      expect(resolve('columns', undefined)).toEqual([
        'customer_id',
        'name',
        'email',
      ]);
    });

    it('suggests the parent table columns for an index', () => {
      const resolve = buildTableSectionResolver(
        definition,
        'customers',
        'indexes'
      );
      expect(resolve('columns', undefined)).toEqual([
        'customer_id',
        'name',
        'email',
      ]);
    });

    describe('foreign_constraints', () => {
      const resolve = buildTableSectionResolver(
        definition,
        'addresses',
        'foreign_constraints'
      );

      it("suggests the parent table's columns for the LOCAL columns list", () => {
        expect(resolve('columns', undefined)).toEqual([
          'address_id',
          'customer_id',
          'line1',
        ]);
      });

      it('suggests OTHER tables for the target_table field', () => {
        expect(resolve('table', undefined)).toEqual(['customers']);
      });

      it("resolves target_columns from the picked target table's columns", () => {
        expect(resolve('target_columns', { table: 'customers' })).toEqual([
          'customer_id',
          'name',
          'email',
        ]);
      });

      it('returns undefined for target_columns when target_table is unset', () => {
        expect(resolve('target_columns', { table: '' })).toBeUndefined();
        expect(resolve('target_columns', undefined)).toBeUndefined();
      });

      it('returns [] for target_columns when the picked target is external', () => {
        // case-2: pointing at a table not in this schema is valid; the
        // resolver returns an empty list so the picker offers nothing,
        // and the field's `_creatable: true` flag lets the user type
        // the external column name freely.
        expect(resolve('target_columns', { table: 'external_users' })).toEqual(
          []
        );
      });
    });
  });
});
