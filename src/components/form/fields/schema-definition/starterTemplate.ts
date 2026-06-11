/**
 * Starter templates for the schema-definition editor.
 *
 * `createEmptyDefinition` is the shape the editor falls back to when it
 * receives no value — just the mandatory `schema` block. `STARTER_DEFINITION`
 * adds one fully-formed example table so a brand-new schema opens on a
 * viable, editable starting point rather than a blank slate.
 */
import { IDataSchemaDefinition } from './types';

/** The minimal valid definition — mandatory `schema` block only. */
export const createEmptyDefinition = (
  schemaName?: string
): IDataSchemaDefinition => ({
  schema: {
    name: schemaName ?? '',
    version: '1.0',
  },
});

/**
 * A viable one-table starter. The example table carries an integer
 * primary key, a `NOT NULL` name column, and created/modified
 * timestamps wired to auto-triggers — the shape most new schemas grow
 * from.
 */
export const createStarterDefinition = (
  schemaName?: string
): IDataSchemaDefinition => ({
  schema: {
    name: schemaName ?? 'example_schema',
    version: '1.0',
  },
  tables: {
    example_table: {
      columns: {
        id: {
          type: 'int',
          notnull: true,
          comment: 'Surrogate primary key',
        },
        name: {
          type: 'varchar',
          size: 255,
          notnull: true,
          comment: 'Human-readable name',
        },
        created: {
          type: 'timestamp',
          notnull: true,
          comment: 'Row creation timestamp',
        },
        modified: {
          type: 'timestamp',
          comment: 'Row last-modified timestamp',
        },
      },
      primary_key: {
        name: 'pk_example_table',
        columns: ['id'],
      },
      auto_triggers: {
        created: true,
        modified: true,
      },
    },
  },
});
