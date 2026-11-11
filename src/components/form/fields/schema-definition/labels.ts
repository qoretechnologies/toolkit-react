// Copyright 2026 Qore Technologies, s.r.o.
import type { ReactNode } from 'react';

/** The editor's tabs, by the section each one shows. */
export type TSchemaDefinitionTab =
  | 'schema'
  | 'tables'
  | 'sequences'
  | 'reference_data'
  | 'migrations'
  | 'advanced';

/**
 * A hint's text, as one whole: `strong` sets a part of it apart (drawn bold) and gives what to put in its place.
 * Returns the text and those parts, in a list or a fragment.
 */
export type TSchemaDefinitionHintText = (strong: (text: string) => ReactNode) => ReactNode;

/**
 * The words of the schema-definition editor: its tables, migrations, catalogue and messages. A host that translates
 * its interface gives its own (`setReqraftLabels`); the rest stay English. The names of sections and fields, their
 * descriptions and their choices come from the server's catalogue and are not words of this part.
 */
export interface ISchemaDefinitionLabels {
  /** The editor's tabs. */
  tabs: Record<TSchemaDefinitionTab, string>;
  /** Beside the spinner, while a part of the editor is loading. */
  loading: string;
  /** Beside the spinner, while the editor is loading. */
  loadingEditor: string;
  /** The heading of what is shown in place of the editor when the server could not describe a schema. */
  catalogUnavailable: string;
  /** Under that heading, when the server gave no reason. */
  catalogUnavailableReason: string;

  /** The hint at the top of the editor: its heading and its text. */
  editorHintTitle: string;
  editorHint: TSchemaDefinitionHintText;
  /** The hint on the reference data tab: its heading and its text. */
  referenceDataHintTitle: string;
  referenceDataHint: TSchemaDefinitionHintText;

  /** The warning shown when the schema's own name differs from the name of the object it is saved as. */
  nameMismatch: string;
  /** Under that warning: the schema's own name and the object's name. */
  nameMismatchDescription: (schemaName: string, objectName: string) => string;
  /** The action that gives the schema the object's name. */
  syncName: string;
  /** The warning shown when tables, sequences or reference data changed and the version did not. */
  versionStale: string;
  /** Under that warning; `version` is the version the schema still has. */
  versionStaleDescription: (version: string) => string;
  /** The action that adds a migration block, on the migrations tab and under that warning. */
  addMigrationBlock: string;
  /** The heading of what the server said when it refused the last save. */
  saveRejected: string;

  /** The hint on the tables tab: its heading and its text. */
  tablesHintTitle: string;
  tablesHint: TSchemaDefinitionHintText;
  /** The tables tab of a schema without tables, where tables can be added. */
  noTables: string;
  /** The tables tab of a schema without tables, read only. */
  noTablesRead: string;
  addTable: string;
  /** The action that removes a table, the heading of the question it asks and the button that confirms it. */
  removeTable: string;
  /** The question asked before a table is removed; `columns` is how many columns it has (0 for none). */
  removeTableDescription: (table: string, columns: number) => string;
  /** A table's badge: how many columns it has. */
  columnCount: (count: number) => string;
  /** Beside a table's name, read only. */
  table: string;
  /** Beside the field that renames a table. */
  tableName: string;

  /** The hint on the migrations tab: its heading and its text. */
  migrationsHintTitle: string;
  migrationsHint: TSchemaDefinitionHintText;
  /** The migrations tab of a schema without migrations, where they can be added. */
  noMigrations: string;
  /** The migrations tab of a schema without migrations, read only. */
  noMigrationsRead: string;
  /** A migration block's heading; `version` is the version it targets, undefined when it has none yet. */
  migrationBlock: (version: string | undefined) => string;
  /** A migration block's badge: how many steps it runs. */
  stepCount: (count: number) => string;
  /** The actions that move a migration block earlier and later in the list. */
  moveEarlier: string;
  moveLater: string;
  /** The action that removes a migration block, and the heading of the question it asks. */
  removeMigrationBlock: string;
  /**
   * The question asked before a migration block is removed: the version it targets (undefined when it has none) and
   * its position in the list, counted from 1.
   */
  removeMigrationBlockDescription: (version: string | undefined, position: number) => string;
  /** The button that confirms removing a migration block. */
  removeBlock: string;

  /** The name of an entry (a column, an index …): its column in a list, its field and the label of a rename. */
  name: string;
  /** The name field's short description and its description. */
  nameShortDescription: string;
  nameDescription: string;
  /** A yes/no value, read. */
  yes: string;
  no: string;
  /** A read-only entry with no values. */
  noValues: string;
  /** The badge of a section that must be filled in. */
  required: string;
  /** A section without entries; `section` is its name as the server writes it (`Columns`). */
  noEntries: (section: string) => string;
  /**
   * The action that adds an entry to a section. `noun`, here and below, is one entry of the section, made from its
   * name as the server writes it (`Column`).
   */
  addEntry: (noun: string) => string;
  /** The heading of an entry of an ordered list, which has no name: its position, counted from 1. */
  listEntry: (noun: string, position: number) => string;
  /** The action that removes an entry, the heading of the question it asks and the button that confirms it. */
  removeEntry: (noun: string) => string;
  /** The question asked before an entry is removed; `name` is the entry's name or heading. */
  removeEntryDescription: (noun: string, name: string) => string;
  /** The notice shown when an entry is renamed to a name another entry of the section has. */
  nameTaken: string;
  nameTakenDescription: (noun: string, name: string) => string;
  /** The column of an ordered list that numbers its entries. */
  positionColumn: string;
  /** The column of an ordered list that holds the actions moving an entry. */
  orderColumn: string;
  moveUp: string;
  moveDown: string;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** The English words, the ones a host gets when it gives none. */
export const DEFAULT_SCHEMA_DEFINITION_LABELS: ISchemaDefinitionLabels = {
  tabs: {
    schema: 'Schema',
    tables: 'Tables',
    sequences: 'Sequences',
    reference_data: 'Reference data',
    migrations: 'Migrations',
    advanced: 'Advanced',
  },
  loading: 'Loading…',
  loadingEditor: 'Loading schema editor…',
  catalogUnavailable: 'Could not load schema options',
  catalogUnavailableReason: 'The schema option catalog could not be loaded.',

  editorHintTitle: 'Building a database schema',
  editorHint: (strong) => [
    'This editor builds a ',
    strong('DataSchema document'),
    ' — the definition of the tables, sequences, and reference data this schema manages. Each tab is one section: lay out your tables and their columns, add sequences, seed reference data, and record migrations so databases on an older version can be upgraded. ',
    strong('Click any row to edit it in a side panel.'),
    ' Once saved, the schema can be aligned to a datasource to create or update those objects.',
  ],
  referenceDataHintTitle: 'Reference data modes',
  referenceDataHint: (strong) => [
    'Reference data is the set of rows the schema guarantees exist in a table — lookup values, enums, seed records. The ',
    strong('mode'),
    ' decides how an align treats rows already in the database: ',
    strong('strict'),
    ' removes any row not in the schema, ',
    strong('normal'),
    ' inserts and updates, ',
    strong('create_only'),
    ' only inserts missing rows, and ',
    strong('insert_only'),
    ' inserts but never updates existing rows.',
  ],

  nameMismatch: 'Schema name does not match the interface name',
  nameMismatchDescription: (schemaName, objectName) =>
    `The DataSchema name is "${schemaName}" but the schema object is named "${objectName}". The server requires them to match.`,
  syncName: 'Sync name',
  versionStale: 'Structure changed — bump the schema version',
  versionStaleDescription: (version) =>
    `Tables, sequences, or reference data changed but schema.version is still "${version}". Bump the version and add a migration block so existing databases can be aligned.`,
  addMigrationBlock: 'Add migration block',
  saveRejected: 'The last save was rejected',

  tablesHintTitle: 'Working with tables',
  tablesHint: (strong) => [
    'Each row is a database table. Expand one to reach its columns, primary key, indexes, and constraints — each on its own sub-tab. ',
    strong('Click a column row to edit it in a side panel'),
    ' where you set its full definition.',
  ],
  noTables: 'No tables yet. Add the first table to start building the schema.',
  noTablesRead: 'This schema defines no tables.',
  addTable: 'Add table',
  removeTable: 'Remove table',
  removeTableDescription: (table, columns) =>
    `Remove the table "${table}"${columns > 0 ? ` and its ${plural(columns, 'column')}` : ''}?`,
  columnCount: (count) => plural(count, 'column'),
  table: 'Table',
  tableName: 'Table name',

  migrationsHintTitle: 'When to add a migration',
  migrationsHint: (strong) => [
    'Aligning a schema to an empty datasource just creates everything. A datasource already running an older version needs ',
    strong('upgrading'),
    ' — that is what migrations are for. When you change tables, columns, or reference data, bump ',
    strong('schema.version'),
    ' and add a migration block: an ordered list of steps (add column, rename, …) run before and after alignment. Each block targets one version.',
  ],
  noMigrations:
    'No migrations yet. Add a migration block when a schema change needs to be applied to existing databases.',
  noMigrationsRead: 'This schema defines no migrations.',
  migrationBlock: (version) => `v${version ?? '(no version)'}`,
  stepCount: (count) => plural(count, 'step'),
  moveEarlier: 'Move earlier',
  moveLater: 'Move later',
  removeMigrationBlock: 'Remove migration block',
  removeMigrationBlockDescription: (version, position) =>
    `Remove migration block "v${version ?? `#${position}`}" and any steps it contains?`,
  removeBlock: 'Remove block',

  name: 'Name',
  nameShortDescription: 'Unique name within the schema',
  nameDescription: 'The unique name identifying this entry.',
  yes: 'yes',
  no: 'no',
  noValues: 'No values set.',
  required: 'required',
  noEntries: (section) => `No ${section.toLowerCase()} defined yet.`,
  addEntry: (noun) => `Add ${noun.toLowerCase()}`,
  listEntry: (noun, position) => `${noun} ${position}`,
  removeEntry: (noun) => `Remove ${noun.toLowerCase()}`,
  removeEntryDescription: (noun, name) =>
    `Remove the ${noun.toLowerCase()} "${name}"? This cannot be undone from inside the editor — re-add or revert the form to restore it.`,
  nameTaken: 'Name already in use',
  nameTakenDescription: (noun, name) =>
    `A ${noun.toLowerCase()} named "${name}" already exists in this section.`,
  positionColumn: '#',
  orderColumn: 'Order',
  moveUp: 'Move up',
  moveDown: 'Move down',
};
