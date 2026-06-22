/**
 * A fully-populated DataSchema definition fixture — two related tables
 * with a primary key, foreign key, unique constraint, index, a
 * sequence, reference data, and one migration block. Stories and unit
 * tests use it to exercise the editor against realistic content.
 */
import { IDataSchemaDefinition } from './types';

export const mockPopulatedDefinition: IDataSchemaDefinition = {
  schema: {
    name: 'example_customer_addresses',
    version: '1.2',
    version_table: 'schema_versions',
    version_column: 'version',
  },
  tables: {
    customers: {
      columns: {
        customer_id: {
          type: 'int',
          notnull: true,
          comment: 'Surrogate primary key',
        },
        name: {
          type: 'varchar',
          size: 255,
          notnull: true,
          comment: 'Customer display name',
        },
        email: {
          type: 'varchar',
          size: 320,
          notnull: true,
          comment: 'Unique contact email',
        },
        created: { type: 'timestamp', notnull: true },
      },
      primary_key: { name: 'pk_customers', columns: ['customer_id'] },
      unique_constraints: {
        uq_customers_email: { columns: ['email'] },
      },
      auto_triggers: { created: true },
    },
    addresses: {
      columns: {
        address_id: { type: 'int', notnull: true },
        customer_id: {
          type: 'int',
          notnull: true,
          comment: 'Owning customer',
        },
        line1: { type: 'varchar', size: 255, notnull: true },
        city: { type: 'varchar', size: 128, notnull: true },
        country: { type: 'char', size: 2, notnull: true },
      },
      primary_key: { name: 'pk_addresses', columns: ['address_id'] },
      foreign_constraints: {
        fk_addresses_customer: {
          columns: ['customer_id'],
          table: 'customers',
          target_columns: ['customer_id'],
          on_delete: 'cascade',
        },
      },
      indexes: {
        ix_addresses_customer: { columns: ['customer_id'] },
      },
    },
  },
  sequences: {
    seq_customer_id: { start_with: 1000, increment: 1 },
  },
  reference_data: {
    mode: 'normal',
    tables: {
      countries: {
        columns: ['country', 'name'],
        rows: [
          ['US', 'United States'],
          ['GB', 'United Kingdom'],
        ],
      },
    },
  },
  migrations: [
    {
      version: '1.1',
      description: 'Add the email column to customers',
      pre_align: [],
      post_align: [
        {
          action: 'add_column',
          table: 'customers',
          column: 'email',
          type: { type: 'varchar', size: 320, notnull: true },
        },
      ],
    },
    {
      version: '1.2',
      description: 'Index addresses by owning customer',
      post_align: [
        {
          action: 'add_index',
          table: 'addresses',
          index: 'ix_addresses_customer',
        },
      ],
    },
  ],
};
