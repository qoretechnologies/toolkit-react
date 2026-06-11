import {
  catalogLeafToFieldSchema,
  catalogTypeToFieldType,
  hashToOptionsValue,
  isCatalogGroup,
  isCatalogLeaf,
  isCatalogList,
  isCatalogMap,
  isOptionalType,
  leavesToOptionsSchema,
  partitionCatalogOptions,
  unwrapListValues,
} from '../../src/components/form/fields/schema-definition/catalog';
import {
  buildMockCatalog,
  mockSchemaCatalog,
} from '../../src/components/form/fields/schema-definition/mockCatalog';
import {
  ICatalogGroup,
  ICatalogLeaf,
  ICatalogMap,
} from '../../src/components/form/fields/schema-definition/types';

describe('schemaDefinition/catalog', () => {
  const { definition } = mockSchemaCatalog;

  describe('node-kind discrimination', () => {
    it('classifies the qorus#225 catalogue sections by kind', () => {
      // `schema` is a wrapper group (nested options, no scalar type).
      expect(isCatalogGroup(definition.schema)).toBe(true);
      expect(isCatalogMap(definition.schema)).toBe(false);
      expect(isCatalogLeaf(definition.schema)).toBe(false);

      // `tables` is a name-keyed map (`*hash<auto>` + per-entry options).
      expect(isCatalogMap(definition.tables)).toBe(true);
      expect(isCatalogGroup(definition.tables)).toBe(false);

      // `migrations` is an ordered list of hashes.
      expect(isCatalogList(definition.migrations)).toBe(true);
      expect(isCatalogMap(definition.migrations)).toBe(false);
    });

    it('classifies a scalar field as a leaf', () => {
      const schemaGroup = definition.schema;
      if (isCatalogLeaf(schemaGroup)) throw new Error('schema is not a leaf');
      const name = schemaGroup.options.name;
      expect(isCatalogLeaf(name)).toBe(true);
      expect(isCatalogGroup(name)).toBe(false);
      expect(isCatalogMap(name)).toBe(false);
    });
  });

  describe('catalogTypeToFieldType', () => {
    it('maps optional Qore types onto the same field type as required ones', () => {
      expect(catalogTypeToFieldType('int').fieldType).toBe('int');
      expect(catalogTypeToFieldType('*int').fieldType).toBe('int');
      expect(catalogTypeToFieldType('*string').fieldType).toBe('string');
      expect(catalogTypeToFieldType('*bool').fieldType).toBe('bool');
    });

    it('maps select-string to a select field', () => {
      expect(catalogTypeToFieldType('select-string').fieldType).toBe(
        'select-string'
      );
      expect(catalogTypeToFieldType('*select-string').fieldType).toBe(
        'select-string'
      );
    });

    it('maps list types with the correct element type', () => {
      const stringList = catalogTypeToFieldType('list<string>');
      expect(stringList.fieldType).toBe('list');
      expect(stringList.elementType).toBe('string');

      const autoList = catalogTypeToFieldType('*list<auto>');
      expect(autoList.fieldType).toBe('list');
      expect(autoList.elementType).toBe('auto');
    });

    it('maps hash types to the hash field and *auto to auto', () => {
      expect(catalogTypeToFieldType('*hash<auto>').fieldType).toBe('hash');
      expect(catalogTypeToFieldType('*auto').fieldType).toBe('auto');
    });
  });

  describe('isOptionalType', () => {
    it('detects the leading `*` optional marker', () => {
      expect(isOptionalType('*string')).toBe(true);
      expect(isOptionalType('string')).toBe(false);
      expect(isOptionalType(undefined)).toBe(false);
    });
  });

  describe('catalogLeafToFieldSchema', () => {
    it('carries the required flag and copy across', () => {
      const schemaGroup = definition.schema;
      if (isCatalogLeaf(schemaGroup)) throw new Error('not a group');
      const nameField = catalogLeafToFieldSchema(
        schemaGroup.options.name as ICatalogLeaf
      );
      expect(nameField.required).toBe(true);
      expect(nameField.display_name).toBe('Schema Name');
      expect(nameField.type).toBe('string');
    });

    it('treats an optional-typed field as not required even when flagged', () => {
      const optionalLeaf: ICatalogLeaf = {
        display_name: 'Maybe',
        short_desc: 'optional',
        desc: 'optional field',
        type: '*string',
        required: true,
      };
      // An optional Qore type wins — the server marks `*` types optional.
      expect(catalogLeafToFieldSchema(optionalLeaf).required).toBe(false);
    });

    it('converts enum allowed values to the form field shape', () => {
      const tables = definition.tables as ICatalogMap;
      const columns = tables.options.columns as ICatalogMap;
      const typeField = catalogLeafToFieldSchema(
        columns.options.type as ICatalogLeaf
      );
      expect(typeField.allowed_values).toBeDefined();
      const intValue = typeField.allowed_values?.find(
        (av) => av.display_name === 'Integer'
      );
      expect(intValue?.value).toEqual({ type: 'string', value: 'int' });
    });
  });

  describe('partitionCatalogOptions', () => {
    it('splits a table into zero leaves and its nested sections', () => {
      const tables = definition.tables as ICatalogMap;
      const { leaves, nested } = partitionCatalogOptions(tables.options);
      // tableOptions has no scalar fields — everything is a map / group.
      expect(Object.keys(leaves)).toHaveLength(0);
      const nestedKeys = nested.map(([key]) => key);
      expect(nestedKeys).toContain('columns');
      expect(nestedKeys).toContain('primary_key');
      expect(nestedKeys).toContain('indexes');
    });

    it('splits a column into all leaves and no nested sections', () => {
      const tables = definition.tables as ICatalogMap;
      const columns = tables.options.columns as ICatalogMap;
      const { leaves, nested } = partitionCatalogOptions(columns.options);
      expect(nested).toHaveLength(0);
      expect(Object.keys(leaves)).toContain('type');
      expect(Object.keys(leaves)).toContain('notnull');
    });
  });

  describe('leavesToOptionsSchema + hashToOptionsValue', () => {
    it('builds a form schema and wraps a definition hash around it', () => {
      const tables = definition.tables as ICatalogMap;
      const columns = tables.options.columns as ICatalogMap;
      const { leaves } = partitionCatalogOptions(columns.options);
      const schema = leavesToOptionsSchema(leaves);
      expect(schema.type).toBeDefined();

      const wrapped = hashToOptionsValue(
        { type: 'varchar', size: 64, notnull: true },
        schema
      );
      // Only set keys are wrapped, each as a {type, value} pair.
      expect(wrapped.type).toEqual({ type: 'select-string', value: 'varchar' });
      expect(wrapped.size).toEqual({ type: 'int', value: 64 });
      expect(wrapped.scale).toBeUndefined();
    });

    it('wraps + unwraps list<string> values for the Options list field', () => {
      // The Options list field needs `[{value, type}]` elements — a
      // bare `['a','b']` renders as empty rows (the primary-key bug).
      const tables = definition.tables as ICatalogMap;
      const primaryKey = tables.options.primary_key as ICatalogGroup;
      const { leaves } = partitionCatalogOptions(primaryKey.options);
      const schema = leavesToOptionsSchema(leaves);
      expect(schema.columns.type).toBe('list');

      const wrapped = hashToOptionsValue({ columns: ['id', 'tenant'] }, schema);
      expect(wrapped.columns).toEqual({
        type: 'list',
        value: [
          { value: 'id', type: 'string' },
          { value: 'tenant', type: 'string' },
        ],
      });

      // unwrapListValues reverses it back to the bare array the
      // DataSchema definition stores.
      const flat: Record<string, unknown> = {
        columns: [
          { value: 'id', type: 'string' },
          { value: 'tenant', type: 'string' },
        ],
      };
      unwrapListValues(flat, schema);
      expect(flat.columns).toEqual(['id', 'tenant']);
    });
  });

  describe('sandboxed catalogue', () => {
    it('omits trusted-only sections and column types', () => {
      const sandboxed = buildMockCatalog(true);
      expect(sandboxed.definition.triggers).toBeUndefined();
      expect(sandboxed.definition.types).toBeUndefined();

      const tables = sandboxed.definition.tables as ICatalogMap;
      const columns = tables.options.columns as ICatalogMap;
      const typeField = columns.options.type as ICatalogLeaf;
      const values = typeField.allowed_values?.map((av) => av.value) ?? [];
      expect(values).toContain('int');
      expect(values).not.toContain('vector');
    });
  });
});
