/**
 * Mock schema option catalogue — a faithful TypeScript mirror of the
 * qorus#225 `SchemaMetadata.qc::getOptionCatalog` output.
 *
 * Stories and unit tests inject this through `catalogOverride` so the
 * editor renders without a live Qorus. `buildMockCatalog(sandboxed)`
 * reproduces the server's trusted / sandboxed split: sandboxed callers
 * lose the trusted-only sections, column types, and migration actions.
 */
import {
  ICatalogAllowedValue,
  ICatalogGroup,
  ICatalogLeaf,
  ICatalogList,
  ICatalogMap,
  ICatalogOptions,
  ISchemaOptionCatalog,
} from './types';

/** An enumerated allowed-value (`av` in the Qore source). */
const av = (value: string, display_name: string): ICatalogAllowedValue => ({
  value,
  display_name,
});

/** A scalar leaf option (`makeOption`). */
const opt = (
  display_name: string,
  short_desc: string,
  type: string,
  desc: string
): ICatalogLeaf => ({ display_name, short_desc, type, desc });

/** A scalar enum leaf (`makeEnumOption`). */
const enumOpt = (
  display_name: string,
  short_desc: string,
  type: string,
  desc: string,
  allowed_values: ICatalogAllowedValue[]
): ICatalogLeaf => ({ display_name, short_desc, type, desc, allowed_values });

/** A wrapper node carrying a nested `options` tree (`makeOptionGroup`). */
const group = (
  display_name: string,
  short_desc: string,
  desc: string,
  options: ICatalogOptions
): ICatalogGroup => ({ display_name, short_desc, desc, options });

/** A name-keyed map field (`makeMapOption`). */
const mapOpt = (
  display_name: string,
  short_desc: string,
  desc: string,
  options: ICatalogOptions
): ICatalogMap => ({
  display_name,
  short_desc,
  desc,
  type: '*hash<auto>',
  options,
});

/** A `*list<hash<auto>>` field with a per-element `options` shape. */
const listOpt = (
  display_name: string,
  short_desc: string,
  desc: string,
  options: ICatalogOptions
): ICatalogList => ({
  display_name,
  short_desc,
  desc,
  type: '*list<hash<auto>>',
  options,
});

/** Marks a node required (`requiredOption`). */
const req = <T extends { required?: boolean }>(node: T): T => ({
  ...node,
  required: true,
});

const primaryKeyOptions = (): ICatalogOptions => ({
  name: opt('Name', 'Primary key constraint name', '*string', 'Optional explicit primary key constraint name.'),
  columns: req(
    opt('Columns', 'Primary key columns', 'list<string>', 'Ordered list of column names that form the primary key.')
  ),
});

const uniqueConstraintEntryOptions = (): ICatalogOptions => ({
  columns: req(
    opt('Columns', 'Unique constraint columns', 'list<string>', 'Ordered list of column names covered by the unique constraint.')
  ),
});

const foreignConstraintEntryOptions = (): ICatalogOptions => {
  const fk = [
    av('cascade', 'Cascade'),
    av('set null', 'Set Null'),
    av('set default', 'Set Default'),
    av('restrict', 'Restrict'),
    av('no action', 'No Action'),
  ];
  return {
    columns: req(opt('Columns', 'Local columns', 'list<string>', 'Local column names that reference the target table.')),
    table: req(opt('Target Table', 'Referenced table', 'string', 'Name of the referenced (parent) table.')),
    target_columns: req(
      opt('Target Columns', 'Referenced columns', 'list<string>', 'Referenced column names in the target table.')
    ),
    on_delete: enumOpt('On Delete', 'ON DELETE referential action', '*select-string', 'Referential action applied when a referenced row is deleted.', fk),
    on_update: enumOpt('On Update', 'ON UPDATE referential action', '*select-string', 'Referential action applied when a referenced key is updated.', fk),
  };
};

const indexEntryOptions = (): ICatalogOptions => ({
  columns: req(opt('Columns', 'Indexed columns', 'list<string>', 'Ordered list of column names in the index.')),
  unique: opt('Unique', 'Unique index', '*bool', 'If true, the index enforces uniqueness.'),
  index_options: opt('Index Options', 'DB-specific index options', '*hash<auto>', 'Optional DB-specific index options.'),
});

const autoTriggerOptions = (): ICatalogOptions => ({
  created: opt('Created', 'Auto-populate a created timestamp', '*bool', 'If true, Schema generates a created-timestamp trigger.'),
  modified: opt('Modified', 'Auto-populate a modified timestamp', '*bool', 'If true, Schema generates a modified-timestamp trigger.'),
  sequence_columns: opt('Sequence Columns', 'Auto-populate columns from sequences', '*hash<auto>', 'Map of column name to sequence name.'),
});

const triggerOptions = (): ICatalogOptions => ({
  driver: req(opt('Driver Bodies', 'Per-driver trigger bodies', 'hash<auto>', 'Trusted-only. Map of driver name to raw trigger definition.')),
});

const sequenceOptions = (): ICatalogOptions => ({
  start_with: opt('Start With', 'Initial sequence value', '*int', 'Optional initial value for the sequence.'),
  increment: opt('Increment', 'Sequence increment', '*int', 'Optional increment between successive values.'),
  min_value: opt('Minimum Value', 'Sequence minimum', '*int', 'Optional minimum sequence value.'),
  max_value: opt('Maximum Value', 'Sequence maximum', '*int', 'Optional maximum sequence value.'),
  cache: opt('Cache', 'Cached sequence values', '*int', 'Optional number of values to cache.'),
  cycle: opt('Cycle', 'Cycle on overflow', '*bool', 'If true, the sequence restarts after reaching its limit.'),
});

/** Column shape — trusted callers also get pgvector types + driver overrides. */
const columnOptions = (sandboxed: boolean): ICatalogOptions => {
  const types = [
    av('int', 'Integer'),
    av('varchar', 'Variable-length string'),
    av('char', 'Fixed-length string'),
    av('timestamp', 'Timestamp with time zone'),
    av('date', 'Date'),
    av('number', 'Numeric'),
    av('float', 'Floating point'),
    av('text', 'Native TEXT / CLOB'),
    av('clob', 'Character large object'),
    av('blob', 'Binary large object'),
    av('binary', 'Binary data'),
  ];
  if (!sandboxed) {
    types.push(
      av('vector', 'pgvector dense vector (trusted-only)'),
      av('halfvec', 'pgvector half-precision vector (trusted-only)'),
      av('sparsevec', 'pgvector sparse vector (trusted-only)')
    );
  }
  const opts: ICatalogOptions = {
    type: req(enumOpt('Column Type', 'Portable column type', 'select-string', 'Portable DataSchema column type.', types)),
    size: opt('Size', 'Column size', '*int', 'Column size; required for varchar and char.'),
    scale: opt('Scale', 'Numeric scale', '*int', 'Numeric scale for number columns.'),
    notnull: opt('Not Null', 'NOT NULL constraint', '*bool', 'If true, the column is NOT NULL.'),
    default_value: opt('Default Value', 'Column default', '*auto', 'Optional default value applied by the database.'),
    comment: opt('Comment', 'Column comment', '*string', 'Optional column comment.'),
    populate: opt('Populate', 'Backfill expression for new NOT NULL columns', '*auto', 'Backfill used only when the column is genuinely new.'),
  };
  if (!sandboxed) {
    opts.driver = opt('Driver Overrides', 'Per-driver column overrides', '*hash<auto>', 'Trusted-only. Per-driver native type / attribute overrides.');
  }
  return opts;
};

const tableOptions = (sandboxed: boolean): ICatalogOptions => {
  const opts: ICatalogOptions = {
    columns: mapOpt('Columns', 'Columns keyed by column name', 'Column definitions keyed by column name.', columnOptions(sandboxed)),
    primary_key: group('Primary Key', 'Table primary key', 'Optional primary key definition.', primaryKeyOptions()),
    unique_constraints: mapOpt('Unique Constraints', 'Unique constraints keyed by name', 'Unique constraints keyed by constraint name.', uniqueConstraintEntryOptions()),
    foreign_constraints: mapOpt('Foreign Constraints', 'Foreign-key constraints keyed by name', 'Foreign-key constraints keyed by constraint name.', foreignConstraintEntryOptions()),
    indexes: mapOpt('Indexes', 'Indexes keyed by index name', 'Index definitions keyed by index name.', indexEntryOptions()),
    auto_triggers: group('Auto Triggers', 'Schema-generated trigger helpers', 'Requests Schema module trigger generation for common cases.', autoTriggerOptions()),
  };
  if (!sandboxed) {
    opts.triggers = mapOpt('Triggers', 'Raw triggers keyed by trigger name', 'Trusted-only. Driver-specific trigger bodies.', triggerOptions());
  }
  return opts;
};

const referenceDataOptions = (): ICatalogOptions => ({
  mode: req(
    enumOpt('Mode', 'Reference-data alignment mode', 'select-string', 'Controls how reference rows are aligned.', [
      av('strict', 'Strict'),
      av('normal', 'Normal'),
      av('create_only', 'Create Only'),
      av('insert_only', 'Insert Only'),
    ])
  ),
  tables: mapOpt('Tables', 'Reference rows keyed by table name', 'Per-table reference-data definitions keyed by table name.', {
    columns: req(opt('Columns', 'Row column order', 'list<string>', 'Column names matching the order of values in each row.')),
    rows: req(opt('Rows', 'Reference rows', 'list<auto>', 'List of rows; each row is a list of cell values aligned to columns.')),
  }),
});

const migrationStepOptions = (sandboxed: boolean): ICatalogOptions => {
  const actions = [
    av('insert', 'Insert Row'),
    av('update', 'Update Rows'),
    av('delete', 'Delete Rows'),
    av('insert_from_select', 'Insert From Select'),
    av('add_column', 'Add Column'),
    av('drop_column', 'Drop Column'),
    av('modify_column', 'Modify Column'),
    av('rename_column', 'Rename Column'),
    av('rename_table', 'Rename Table'),
    av('add_index', 'Add Index'),
    av('drop_index', 'Drop Index'),
    av('add_constraint', 'Add Constraint'),
    av('drop_constraint', 'Drop Constraint'),
  ];
  if (!sandboxed) {
    actions.push(
      av('add_trigger', 'Add Trigger (trusted-only)'),
      av('drop_trigger', 'Drop Trigger (trusted-only)'),
      av('sql', 'Raw SQL (trusted-only)'),
      av('script', 'Raw Script (trusted-only)')
    );
  }
  const opts: ICatalogOptions = {
    action: req(enumOpt('Action', 'Migration action discriminator', 'select-string', 'Selects which migration operation this step performs.', actions)),
    id: opt('Step ID', 'Optional step identifier', '*string', 'Optional identifier for this step.'),
    depends_on: opt('Depends On', 'Step dependencies', '*list<string>', 'IDs of steps that must complete before this step.'),
    table: opt('Table', 'Target table', '*string', 'Target table for table / row / column / index / constraint actions.'),
    column: opt('Column', 'Target column', '*string', 'Target column for add / drop / modify column.'),
    from: opt('From', 'Old name', '*string', 'Old column name for rename_column.'),
    to: opt('To', 'New name', '*string', 'New name for rename_column / rename_table.'),
    index: opt('Index', 'Index name', '*string', 'Index name for add_index / drop_index.'),
    constraint: opt('Constraint', 'Constraint name', '*string', 'Constraint name for add_constraint / drop_constraint.'),
    row: opt('Row', 'Row to insert', '*hash<auto>', 'Column/value hash for insert.'),
    set: opt('Set', 'Columns to set', '*hash<auto>', 'Column/value hash for update.'),
    where: opt('Where', 'Row selector', '*hash<auto>', 'Selector hash for update / delete.'),
    select: opt('Select', 'Source select', '*hash<auto>', 'Source select definition for insert_from_select.'),
    target_columns: opt('Target Columns', 'Insert target columns', '*list<string>', 'Target column names for insert_from_select.'),
    type: group('Column Definition', 'Column definition for column actions', 'Column-options subtree for add_column / modify_column.', columnOptions(sandboxed)),
    populate: opt('Populate', 'Backfill for add_column', '*auto', 'Optional populate expression for add_column.'),
    options: opt('Options', 'Index or constraint options', '*hash<auto>', 'Index-options or constraint-options hash.'),
  };
  if (!sandboxed) {
    opts.statement = opt('Statement / Body', 'Raw SQL or script body', '*string', 'Trusted-only. Raw statement/body for sql / script actions.');
  }
  return opts;
};

const migrationBlockOptions = (sandboxed: boolean): ICatalogOptions => ({
  version: req(opt('Version', 'Migration version', 'string', 'Version marker this migration block applies to.')),
  description: opt('Description', 'Migration description', '*string', 'Optional human-readable description of the migration.'),
  pre_align: listOpt('Pre-Align Steps', 'Action steps run before schema alignment', 'Ordered list of migration action steps executed before alignment.', migrationStepOptions(sandboxed)),
  post_align: listOpt('Post-Align Steps', 'Action steps run after schema alignment', 'Ordered list of migration action steps executed after alignment.', migrationStepOptions(sandboxed)),
});

const dbSpecificBodyOptions = (): ICatalogOptions => ({
  driver: req(opt('Driver', 'Target database driver', 'string', 'Trusted-only. Database driver this definition targets.')),
  body: req(opt('Body', 'Definition body', 'string', 'Trusted-only. Raw definition body; rendered as a code-editor field.')),
});

const getDefinitionOptions = (sandboxed: boolean): ICatalogOptions => {
  const rv: ICatalogOptions = {
    schema: group('Schema Metadata', 'Top-level DataSchema metadata', 'Defines the DataSchema name, version, and optional version-table settings.', {
      name: req(opt('Schema Name', 'DataSchema schema name', 'string', 'Must match the public Qorus schema object name.')),
      version: req(opt('Version', 'DataSchema version', 'string', 'Version marker used by Schema module alignment.')),
      version_table: opt('Version Table', 'Optional schema version table', '*string', 'Table used to record applied schema versions.'),
      version_column: opt('Version Column', 'Optional version column', '*string', 'Column in the version table containing the applied version.'),
      version_where: opt('Version Row Filter', 'Optional version row selector', '*hash<auto>', 'Hash used to identify the version row for this schema.'),
    }),
    tables: mapOpt('Tables', 'Tables keyed by table name', "Table definitions keyed by table name.", tableOptions(sandboxed)),
    columns: mapOpt('Columns', 'Column definitions keyed by column name', 'Shared column definitions keyed by column name.', columnOptions(sandboxed)),
    indexes: mapOpt('Indexes', 'Secondary indexes keyed by index name', 'Shared index definitions keyed by index name.', indexEntryOptions()),
    constraints: group('Constraints', 'Primary, unique, and foreign constraints', 'Portable constraint definitions.', {
      primary_key: group('Primary Key', 'Primary key', 'Optional primary key definition.', primaryKeyOptions()),
      unique_constraints: mapOpt('Unique Constraints', 'Unique constraints keyed by name', 'Unique constraints keyed by constraint name.', uniqueConstraintEntryOptions()),
      foreign_constraints: mapOpt('Foreign Constraints', 'Foreign constraints keyed by name', 'Foreign-key constraints keyed by constraint name.', foreignConstraintEntryOptions()),
    }),
    auto_triggers: group('Auto Triggers', 'Schema-generated trigger helpers', 'Requests Schema module trigger generation for supported common cases.', autoTriggerOptions()),
    sequences: mapOpt('Sequences', 'Database sequences keyed by sequence name', 'Sequence definitions keyed by sequence name.', sequenceOptions()),
    reference_data: group('Reference Data', 'Seed and verify reference rows', 'Reference-data alignment mode plus per-table column/row definitions.', referenceDataOptions()),
    migrations: listOpt('Migrations', 'Ordered list of migration blocks', 'Each migration block carries a version, optional description, and pre/post alignment action steps.', migrationBlockOptions(sandboxed)),
  };
  if (!sandboxed) {
    rv.triggers = mapOpt('Triggers', 'Raw trigger definitions keyed by trigger name', 'Trusted-only. Driver-specific trigger bodies.', triggerOptions());
    rv.materialized_views = mapOpt('Materialized Views', 'Materialized views keyed by view name', 'Trusted-only. Materialized-view definitions.', dbSpecificBodyOptions());
    rv.types = mapOpt('Types', 'Database type definitions keyed by name', 'Trusted-only. DB-specific type definitions.', dbSpecificBodyOptions());
    rv.functions = mapOpt('Functions', 'Stored function definitions keyed by name', 'Trusted-only. DB-specific stored function definitions.', dbSpecificBodyOptions());
    rv.procedures = mapOpt('Procedures', 'Stored procedure definitions keyed by name', 'Trusted-only. DB-specific stored procedure definitions.', dbSpecificBodyOptions());
    rv.packages = mapOpt('Packages', 'Package definitions keyed by name', 'Trusted-only. DB-specific package definitions.', dbSpecificBodyOptions());
  }
  return rv;
};

/** Builds the full mock catalogue for a trusted or sandboxed caller. */
export const buildMockCatalog = (sandboxed = false): ISchemaOptionCatalog => ({
  fields: {
    name: req(opt('Name', 'Schema object name', 'string', 'Public Qorus schema object name.')),
    definition: req(opt('Definition', 'DataSchema document', 'hash<auto>', 'Structured Qore DataSchema document.')),
  },
  definition: getDefinitionOptions(sandboxed),
  actions: {
    validate: {
      display_name: 'Validate Schema',
      short_desc: 'Validate the DataSchema definition without connecting to a database',
      desc: 'Checks that the stored DataSchema definition can be parsed and normalized.',
      options: {},
    },
  },
});

/** The trusted-caller catalogue — the default stories / tests fixture. */
export const mockSchemaCatalog: ISchemaOptionCatalog = buildMockCatalog(false);

/** The sandboxed-caller catalogue — trusted-only sections omitted. */
export const mockSchemaCatalogSandboxed: ISchemaOptionCatalog =
  buildMockCatalog(true);
