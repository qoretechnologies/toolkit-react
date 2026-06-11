/**
 * One table's expanded editor body — the bespoke surface for the locked
 * "inline expanded panel per table" decision.
 *
 * A table has no leaf fields of its own (its catalogue children are all
 * maps / groups: columns, keys, FKs, indexes, triggers), so the body is
 * a nested `ReqoreTabs` — one tab per child section — with each tab
 * delegating to the generic `CatalogNodeEditor`.
 */
import {
  ReqoreControlGroup,
  ReqoreTabs,
  ReqoreTabsContent,
  ReqoreTag,
} from '@qoretechnologies/reqore';
import { memo, useMemo, useState } from 'react';
import { partitionCatalogOptions } from './catalog';
import { CatalogNodeEditor, RenameField } from './CatalogNodeEditor';
import { SECTION_ICONS, sectionCount } from './helpers';
import {
  buildTableSectionResolver,
  SuggestionProvider,
  TKnownSection,
  useSchemaDefinition,
} from './referenceSuggestions';
import { ICatalogOptions } from './types';

const SECTIONS_WITH_SUGGESTIONS: ReadonlySet<TKnownSection> = new Set<TKnownSection>([
  'primary_key',
  'unique_constraints',
  'foreign_constraints',
  'indexes',
]);

export interface ITableEditorProps {
  name: string;
  tableName: string;
  /** Rename the table — bubbles a key rename up to the Tables map. */
  onRename: (newName: string) => void;
  /** Returns `true` when a proposed table name collides with a sibling. */
  taken?: (next: string) => boolean;
  /** The per-table catalogue options (`tableOptions`). */
  options: ICatalogOptions;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export const TableEditor = memo(
  ({
    name,
    tableName,
    onRename,
    taken,
    options,
    value,
    onChange,
    readOnly,
  }: ITableEditorProps) => {
    const sections = useMemo(
      () => partitionCatalogOptions(options).nested,
      [options]
    );
    const [activeTab, setActiveTab] = useState<string | number>(
      sections[0]?.[0] ?? 'columns'
    );

    return (
      <ReqoreControlGroup vertical fluid gapSize='normal'>
        {readOnly ? (
          <ReqoreControlGroup verticalAlign='center' gapSize='small'>
            <ReqoreTag fixed minimal size='small' icon='Table2' label='Table' />
            <ReqoreTag size='small' label={tableName} />
          </ReqoreControlGroup>
        ) : (
          <RenameField
            value={tableName}
            taken={taken}
            onRename={onRename}
            label='Table name'
          />
        )}

        <ReqoreTabs
          flat
          size='small'
          tabsPadding='vertical'
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={sections.map(([key, node]) => {
            const count = node.type ? sectionCount(value?.[key]) : undefined;
            return {
              id: key,
              label: node.display_name,
              icon: SECTION_ICONS[key],
              badge: count || undefined,
              tooltip: node.short_desc,
            };
          })}
        >
          {sections.map(([key, node]) => {
            const editor = (
              <CatalogNodeEditor
                name={`${name}-${key}`}
                node={node}
                value={value?.[key]}
                onChange={(next) => onChange({ ...value, [key]: next })}
                readOnly={readOnly}
              />
            );
            return (
              <ReqoreTabsContent key={key} tabId={key}>
                {SECTIONS_WITH_SUGGESTIONS.has(key as TKnownSection) ? (
                  <SectionWithSuggestions
                    tableName={tableName}
                    section={key as TKnownSection}
                  >
                    {editor}
                  </SectionWithSuggestions>
                ) : (
                  editor
                )}
              </ReqoreTabsContent>
            );
          })}
        </ReqoreTabs>
      </ReqoreControlGroup>
    );
  }
);

/**
 * Wraps a table sub-section's editor with a suggestion resolver tied
 * to this table — so a primary key's `columns` list, a foreign
 * constraint's `table` / `target_columns`, and the like get
 * contextual `allowed_values` from the schema's own tree.
 */
const SectionWithSuggestions = memo(
  ({
    tableName,
    section,
    children,
  }: {
    tableName: string;
    section: TKnownSection;
    children: React.ReactNode;
  }) => {
    const definition = useSchemaDefinition();
    const resolver = useMemo(
      () => buildTableSectionResolver(definition, tableName, section),
      [definition, tableName, section]
    );
    return <SuggestionProvider resolver={resolver}>{children}</SuggestionProvider>;
  }
);
