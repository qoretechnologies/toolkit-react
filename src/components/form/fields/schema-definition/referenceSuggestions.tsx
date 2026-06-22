/**
 * Contextual suggestions for the schema editor's reference fields.
 *
 * The qorus#225 catalogue declares fields like a primary-key's `columns`
 * or a foreign-constraint's `table` / `target_columns` as plain
 * `string` / `list<string>` — no `allowed_values`. The catalogue
 * *can't* enumerate them: a foreign constraint may legitimately target
 * a table that is not part of *this* schema (a table managed by
 * another schema or pre-existing in the database), so the server's
 * permissive shape is correct.
 *
 * But for the common case — references within the same schema — the
 * FE has every piece of context it needs to suggest valid values. This
 * module is the bespoke layer that adds those suggestions on top of
 * the generic catalogue: each suggestion is wired as `allowed_values`
 * (or `element_allowed_values`) plus `_creatable: true`, so the user
 * picks from the list for case-1 (sibling table in this schema) and
 * can still type a custom name for case-2 (external table).
 *
 * Two React contexts cooperate:
 *
 *   - **`SchemaDefinitionContext`** — set once at the top of the
 *     editor; carries the whole `IDataSchemaDefinition` so deep
 *     components can look up sibling tables / their columns without
 *     prop-drilling.
 *   - **`SuggestionContext`** — set per section; carries a
 *     `TSuggestionResolver` that maps a leaf key + the current entry
 *     value to a list of suggested string values. Each known section
 *     (primary key, unique / foreign constraints, indexes, …) wires
 *     its own resolver.
 *
 * If the catalogue ever grows a server-side `references` hint
 * (proposed follow-up), the per-section resolvers become a single
 * catalogue-driven walker and this module collapses to nothing.
 */
import { ReactElement, ReactNode } from 'react';
import { createContext, useContextSelector } from 'use-context-selector';
import { IDataSchemaDefinition } from './types';

// ---- definition context ----------------------------------------------

const SchemaDefinitionContext = createContext<IDataSchemaDefinition | null>(
  null
);

export const SchemaDefinitionProvider = SchemaDefinitionContext.Provider;

export const useSchemaDefinition = (): IDataSchemaDefinition | null =>
  useContextSelector(SchemaDefinitionContext, (v) => v);

// ---- suggestion resolver --------------------------------------------

/**
 * Returns suggested values for one leaf field in the current entry,
 * or `undefined` when no suggestion applies. `value` is the entry's
 * own hash — used by reference fields whose suggestions depend on a
 * sibling field (e.g. a foreign-constraint's `target_columns`
 * depends on the picked `table`).
 */
export type TSuggestionResolver = (
  leafKey: string,
  value: Record<string, unknown> | undefined
) => string[] | undefined;

const SuggestionContext = createContext<TSuggestionResolver | null>(null);

export const SuggestionProvider = ({
  resolver,
  children,
}: {
  resolver: TSuggestionResolver;
  children: ReactNode;
}): ReactElement => (
  <SuggestionContext.Provider value={resolver}>
    {children}
  </SuggestionContext.Provider>
);

export const useSuggestionResolver = (): TSuggestionResolver | null =>
  useContextSelector(SuggestionContext, (v) => v);

// ---- helpers --------------------------------------------------------

/** Column keys defined for one table in the schema, or `[]`. */
export const tableColumnNames = (
  definition: IDataSchemaDefinition | null,
  tableName: string | undefined
): string[] => {
  if (!definition || !tableName) return [];
  const table = definition.tables?.[tableName];
  if (!table) return [];
  const columns = table.columns;
  return columns && typeof columns === 'object' ? Object.keys(columns) : [];
};

/** Table names defined in the schema, minus the given current table. */
export const otherTableNames = (
  definition: IDataSchemaDefinition | null,
  currentTable: string | undefined
): string[] => {
  if (!definition) return [];
  const names = Object.keys(definition.tables ?? {});
  return currentTable ? names.filter((n) => n !== currentTable) : names;
};

// ---- per-section resolver builder -----------------------------------

/** Section keys for which we provide reference suggestions. */
export type TKnownSection =
  | 'primary_key'
  | 'unique_constraints'
  | 'foreign_constraints'
  | 'indexes';

/**
 * Builds a `TSuggestionResolver` for the named section of a single
 * table. The resolver knows which leaf keys of that section reference
 * the schema's tree (e.g. an `indexes[X].columns` leaf maps to the
 * parent table's column names; a `foreign_constraints[X].target_columns`
 * leaf maps to the picked target table's columns).
 */
export const buildTableSectionResolver = (
  definition: IDataSchemaDefinition | null,
  tableName: string,
  section: TKnownSection
): TSuggestionResolver => {
  const ownColumns = () => tableColumnNames(definition, tableName);

  return (leafKey, value) => {
    if (section === 'primary_key' && leafKey === 'columns') {
      return ownColumns();
    }
    if (section === 'unique_constraints' && leafKey === 'columns') {
      return ownColumns();
    }
    if (section === 'indexes' && leafKey === 'columns') {
      return ownColumns();
    }
    if (section === 'foreign_constraints') {
      if (leafKey === 'columns') return ownColumns();
      if (leafKey === 'table') return otherTableNames(definition, tableName);
      if (leafKey === 'target_columns') {
        const target = value?.table;
        if (typeof target === 'string' && target) {
          return tableColumnNames(definition, target);
        }
        return undefined;
      }
    }
    return undefined;
  };
};
