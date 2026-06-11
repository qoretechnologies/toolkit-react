/**
 * Types for the `schema-definition` editor.
 *
 * Two distinct shapes live here:
 *
 *   1. The **option catalogue** returned by `GET /schemas?action=options`
 *      (`ISchemaOptionCatalog`) — the server contract the editor renders
 *      its forms from. Mirrors `Classes/SchemaMetadata.qc::getOptionCatalog`
 *      shipped by qorus#225.
 *   2. The **DataSchema definition document** (`IDataSchemaDefinition`) —
 *      the value the editor reads and writes. Only the well-known top
 *      level is typed; deeper structures stay loose because the editor is
 *      catalogue-driven, not shape-driven.
 */

/** A single enumerated value on a `select-string` catalogue leaf. */
export interface ICatalogAllowedValue {
  value: string;
  display_name: string;
}

/** Fields shared by every catalogue node regardless of kind. */
export interface ICatalogNodeBase {
  display_name: string;
  short_desc: string;
  desc: string;
  /** `True` when the server marks the field/section mandatory. */
  required?: boolean;
}

/**
 * A scalar leaf — has a Qore `type` and no nested `options`. Rendered as
 * a single form field. `allowed_values` is present for `select-string`
 * enums.
 */
export interface ICatalogLeaf extends ICatalogNodeBase {
  type: string;
  options?: undefined;
  allowed_values?: ICatalogAllowedValue[];
}

/**
 * A wrapper node — carries a nested `options` tree and no scalar `type`
 * (`makeOptionGroup`). One structured sub-object (e.g. `schema`,
 * `primary_key`, a migration step's `type`).
 */
export interface ICatalogGroup extends ICatalogNodeBase {
  type?: undefined;
  options: ICatalogOptions;
}

/**
 * A name-keyed map (`makeMapOption`) — `type` is `*hash<auto>` and
 * `options` describes the shape of *every* entry. Rendered as an
 * add/remove list of named entries (tables, columns, indexes, …).
 */
export interface ICatalogMap extends ICatalogNodeBase {
  type: string;
  options: ICatalogOptions;
}

/**
 * An ordered list of hashes — `type` is `*list<hash<auto>>` and
 * `options` describes the shape of *every* element. Rendered as an
 * add/remove/reorder list (migration blocks, pre/post-align steps).
 */
export interface ICatalogList extends ICatalogNodeBase {
  type: string;
  options: ICatalogOptions;
}

/** Any catalogue node — discriminate with the `catalog.ts` helpers. */
export type ICatalogNode =
  | ICatalogLeaf
  | ICatalogGroup
  | ICatalogMap
  | ICatalogList;

/** A hash of named catalogue nodes — one editable section's children. */
export type ICatalogOptions = Record<string, ICatalogNode>;

/** A schema action's option catalogue (`validate` / `diff` / `align` / `drop`). */
export interface ICatalogAction {
  display_name: string;
  short_desc: string;
  desc: string;
  options: ICatalogOptions;
}

/**
 * The full `GET /schemas?action=options` response (qorus#225).
 *
 * - `fields` — the wrapper metadata form (name, datasource, …).
 * - `definition` — the DataSchema editor catalogue; keys are the
 *   definition sections (`schema`, `tables`, `sequences`, `migrations`,
 *   …). Trusted-only sections are omitted entirely for sandboxed callers.
 * - `actions` — per-action option catalogues.
 */
export interface ISchemaOptionCatalog {
  fields: ICatalogOptions;
  definition: ICatalogOptions;
  actions: Record<string, ICatalogAction>;
}

/** Top-level DataSchema metadata (`definition.schema`). */
export interface IDataSchemaMeta {
  name?: string;
  version?: string;
  version_table?: string;
  version_column?: string;
  version_where?: Record<string, unknown>;
}

/**
 * The DataSchema definition document — the editor's value. Only the
 * top level is typed; section bodies stay loose (`Record<string,
 * unknown>` / `unknown[]`) because their shape is validated by the
 * server and rendered from the catalogue.
 */
export interface IDataSchemaDefinition {
  schema: IDataSchemaMeta;
  tables?: Record<string, Record<string, unknown>>;
  columns?: Record<string, Record<string, unknown>>;
  indexes?: Record<string, Record<string, unknown>>;
  constraints?: Record<string, unknown>;
  auto_triggers?: Record<string, unknown>;
  sequences?: Record<string, Record<string, unknown>>;
  reference_data?: Record<string, unknown>;
  migrations?: Array<Record<string, unknown>>;
  /** Trusted-only sections — present only for non-sandboxed schemas. */
  triggers?: Record<string, Record<string, unknown>>;
  materialized_views?: Record<string, Record<string, unknown>>;
  types?: Record<string, Record<string, unknown>>;
  functions?: Record<string, Record<string, unknown>>;
  procedures?: Record<string, Record<string, unknown>>;
  packages?: Record<string, Record<string, unknown>>;
}

/** Sandbox flag — drives which catalogue sections / options render. */
export type TSchemaAccessLevel = 'trusted' | 'untrusted';

/**
 * A backend save rejection the editor surfaces in the inline banner.
 * `path` is the dotted definition path the server complained about
 * (e.g. `tables.customer.columns.id.type`) when it could be derived.
 */
export interface ISchemaSaveError {
  message: string;
  path?: string;
}

export interface ISchemaDefinitionEditorProps {
  /** The `definition` hash. */
  value?: IDataSchemaDefinition;
  /** Always called with the full updated definition. */
  onChange: (value: IDataSchemaDefinition) => void;
  /**
   * When `true`, every editable input renders as a typeset display row
   * instead. The viewer the schema detail page reuses.
   */
  readOnly?: boolean;
  /**
   * Sandbox flag from the wrapper's `access_level` field. When
   * `'untrusted'` the Advanced tab is hidden and trusted-only options
   * never render.
   */
  accessLevel?: TSchemaAccessLevel;
  /**
   * Wrapper name — used by the inline banner to flag a
   * `definition.schema.name` mismatch.
   */
  wrapperName?: string;
  /** Last backend save rejection — surfaced in the inline banner. */
  saveError?: ISchemaSaveError;
  /**
   * Test seam — inject the catalogue directly instead of fetching it.
   * Stories and unit tests pass this; production callers omit it.
   */
  catalogOverride?: ISchemaOptionCatalog;
  /**
   * Test seam — simulate a catalogue fetch failure with this message.
   * Stories and unit tests use it to exercise the error state.
   */
  catalogError?: string;
}
