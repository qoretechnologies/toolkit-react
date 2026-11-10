/**
 * `SchemaDefinitionEditor` — the editor (and read-only viewer) for a
 * Qorus `schema` object's DataSchema `definition` document.
 *
 * Everything the editor renders comes from the server option catalogue
 * (`GET /schemas?action=options`, qorus#225) — there is no hard-coded
 * DataSchema shape and no FE fallback. If the catalogue cannot be
 * loaded the editor renders a blocking callout instead of a form.
 *
 * The same component is the read-only viewer the schema detail page
 * reuses: `readOnly` flips every input to a typeset display row.
 */
import {
  ReqoreCallout,
  ReqoreControlGroup,
  ReqoreP,
  ReqorePanel,
  ReqoreTabs,
  ReqoreTabsContent,
} from '@qoretechnologies/reqore';
import { memo, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useDescriptionTooltips } from '../../../../helpers/descriptionTooltip';
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
import { describedPanelProps } from '../../../Description/describedControl';
import { Hint } from './Hint';
import Loader from './Loader';
import { CatalogGroupBody, CatalogNodeEditor } from './CatalogNodeEditor';
import { SECTION_ICONS, sectionCount } from './helpers';
import { InlineValidationBanner } from './InlineValidationBanner';
import { TSchemaDefinitionTab } from './labels';
import { createMigrationBlock, MigrationsTab } from './MigrationsTab';
import { SchemaDefinitionProvider } from './referenceSuggestions';
import { createEmptyDefinition } from './starterTemplate';
import { TablesTab } from './TablesTab';
import {
  ICatalogList,
  ICatalogMap,
  ICatalogNode,
  IDataSchemaDefinition,
  ISchemaDefinitionEditorProps,
  ISchemaOptionCatalog,
} from './types';
import { useSchemaOptionCatalog } from './useSchemaOptionCatalog';

/**
 * Wraps a tab's editor with a one-line description of the section,
 * taken straight from the server catalogue — orientation help without
 * the operator having to learn the shape.
 */
const TabBody = ({
  node,
  children,
}: {
  node?: ICatalogNode;
  children: ReactNode;
}) => (
  <ReqoreControlGroup vertical fluid gapSize='normal'>
    {node?.desc ? (
      <ReqoreP size='small' effect={{ opacity: 0.6 }}>
        {node.desc}
      </ReqoreP>
    ) : null}
    {children}
  </ReqoreControlGroup>
);

/** Sections that get a dedicated primary tab; everything else is Advanced. */
const PRIMARY_SECTIONS = [
  'schema',
  'tables',
  'sequences',
  'reference_data',
  'migrations',
];

/**
 * Extracts a human-readable message from a catalogue fetch error: what the
 * server said, or `fallback` (the host's words) when it said nothing.
 */
const errorMessage = (error: unknown, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const e = error as { desc?: string; message?: string };
  return e.desc ?? e.message ?? fallback;
};

interface ISchemaEditorBodyProps
  extends Omit<ISchemaDefinitionEditorProps, 'catalogOverride'> {
  catalog: ISchemaOptionCatalog;
}

/** The editor body — only rendered once the catalogue has loaded. */
const SchemaEditorBody = memo(
  ({
    catalog,
    value,
    onChange,
    readOnly = false,
    accessLevel = 'trusted',
    wrapperName,
    saveError,
  }: ISchemaEditorBodyProps) => {
    // a section's description card: markdown drawn, opened by a tap on touch (`descriptionTooltip`)
    const descriptions = useDescriptionTooltips();
    const words = useReqraftLabels().schemaDefinition;
    const definition = useMemo<IDataSchemaDefinition>(
      () => value ?? createEmptyDefinition(wrapperName),
      [value, wrapperName]
    );

    // Baseline snapshots captured once on mount — drive the inline
    // banner's "structure changed, bump the version" hint.
    const baselineVersion = useRef(definition.schema?.version ?? '');
    const baselineStructure = useRef(
      JSON.stringify({
        tables: definition.tables,
        sequences: definition.sequences,
        reference_data: definition.reference_data,
      })
    );

    const structureDirty = useMemo(
      () =>
        JSON.stringify({
          tables: definition.tables,
          sequences: definition.sequences,
          reference_data: definition.reference_data,
        }) !== baselineStructure.current,
      [definition.tables, definition.sequences, definition.reference_data]
    );

    const [activeTab, setActiveTab] = useState<string | number>('schema');

    /** Replaces a single top-level definition section. */
    const setSection = useCallback(
      (key: keyof IDataSchemaDefinition, sectionValue: unknown) => {
        onChange({ ...definition, [key]: sectionValue });
      },
      [definition, onChange]
    );

    const syncName = useCallback(() => {
      onChange({
        ...definition,
        schema: { ...definition.schema, name: wrapperName ?? '' },
      });
    }, [definition, onChange, wrapperName]);

    const addMigration = useCallback(() => {
      const blocks = definition.migrations ?? [];
      onChange({
        ...definition,
        migrations: [
          ...blocks,
          createMigrationBlock(definition.schema?.version ?? ''),
        ],
      });
      setActiveTab('migrations');
    }, [definition, onChange]);

    // Advanced = every catalogue section without a dedicated tab.
    const advancedSections = useMemo(
      () =>
        Object.entries(catalog.definition).filter(
          ([key]) => !PRIMARY_SECTIONS.includes(key)
        ),
      [catalog.definition]
    );
    const showAdvanced =
      accessLevel === 'trusted' && advancedSections.length > 0;

    const schemaNode = catalog.definition.schema;
    const tablesNode = catalog.definition.tables as ICatalogMap | undefined;
    const sequencesNode = catalog.definition.sequences;
    const referenceNode = catalog.definition.reference_data;
    const migrationsNode = catalog.definition.migrations as
      | ICatalogList
      | undefined;

    const tabs = useMemo(() => {
      const list: Array<{
        id: TSchemaDefinitionTab;
        label: string;
        icon: (typeof SECTION_ICONS)[string];
        badge?: number;
      }> = [
        { id: 'schema', label: words.tabs.schema, icon: SECTION_ICONS.schema },
        {
          id: 'tables',
          label: words.tabs.tables,
          icon: SECTION_ICONS.tables,
          badge: sectionCount(definition.tables) || undefined,
        },
        {
          id: 'sequences',
          label: words.tabs.sequences,
          icon: SECTION_ICONS.sequences,
          badge: sectionCount(definition.sequences) || undefined,
        },
        {
          id: 'reference_data',
          label: words.tabs.reference_data,
          icon: SECTION_ICONS.reference_data,
        },
        {
          id: 'migrations',
          label: words.tabs.migrations,
          icon: SECTION_ICONS.migrations,
          badge: definition.migrations?.length || undefined,
        },
      ];
      if (showAdvanced) {
        list.push({
          id: 'advanced',
          label: words.tabs.advanced,
          icon: SECTION_ICONS.advanced,
        });
      }
      return list;
    }, [definition, showAdvanced, words]);

    return (
      <SchemaDefinitionProvider value={definition}>
        <ReqoreControlGroup vertical fluid gapSize='normal'>
          <InlineValidationBanner
            definition={definition}
            wrapperName={wrapperName}
            structureDirty={structureDirty}
            baselineVersion={baselineVersion.current}
            saveError={saveError}
            onSyncName={syncName}
            onAddMigration={addMigration}
            readOnly={readOnly}
          />

          {!readOnly ? (
            <Hint
              id='hint.schema-editor'
              title={words.editorHintTitle}
              icon='Database2Line'
              text={words.editorHint}
            />
          ) : null}

          <ReqoreTabs
            flat
            fill
            tabsPadding='vertical'
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabs}
          >
            <ReqoreTabsContent tabId='schema'>
              {schemaNode ? (
                <TabBody node={schemaNode}>
                  <CatalogGroupBody
                    name='schema'
                    options={
                      'options' in schemaNode ? schemaNode.options : {}
                    }
                    value={
                      (definition.schema ?? {}) as Record<string, unknown>
                    }
                    onChange={(next) => setSection('schema', next)}
                    readOnly={readOnly}
                  />
                </TabBody>
              ) : null}
            </ReqoreTabsContent>

            <ReqoreTabsContent tabId='tables'>
              {tablesNode ? (
                <TabBody node={tablesNode}>
                  <TablesTab
                    node={tablesNode}
                    value={definition.tables ?? {}}
                    onChange={(next) => setSection('tables', next)}
                    readOnly={readOnly}
                  />
                </TabBody>
              ) : null}
            </ReqoreTabsContent>

            <ReqoreTabsContent tabId='sequences'>
              {sequencesNode ? (
                <TabBody node={sequencesNode}>
                  <CatalogNodeEditor
                    name='sequences'
                    node={sequencesNode}
                    value={definition.sequences}
                    onChange={(next) => setSection('sequences', next)}
                    readOnly={readOnly}
                  />
                </TabBody>
              ) : null}
            </ReqoreTabsContent>

            <ReqoreTabsContent tabId='reference_data'>
              {referenceNode ? (
                <TabBody node={referenceNode}>
                  {!readOnly ? (
                    <Hint
                      id='hint.schema-reference-data'
                      title={words.referenceDataHintTitle}
                      icon='SeedlingLine'
                      text={words.referenceDataHint}
                    />
                  ) : null}
                  <CatalogNodeEditor
                    name='reference_data'
                    node={referenceNode}
                    value={definition.reference_data}
                    onChange={(next) => setSection('reference_data', next)}
                    readOnly={readOnly}
                  />
                </TabBody>
              ) : null}
            </ReqoreTabsContent>

            <ReqoreTabsContent tabId='migrations'>
              {migrationsNode ? (
                <TabBody node={migrationsNode}>
                  <MigrationsTab
                    node={migrationsNode}
                    value={definition.migrations ?? []}
                    onChange={(next) => setSection('migrations', next)}
                    readOnly={readOnly}
                  />
                </TabBody>
              ) : null}
            </ReqoreTabsContent>

            {showAdvanced ? (
              <ReqoreTabsContent tabId='advanced'>
                <ReqoreControlGroup vertical fluid gapSize='small'>
                  {advancedSections.map(([key, node]) => (
                    <ReqorePanel
                      key={key}
                      flat
                      minimal
                      padded={false}
                      collapsible
                      isCollapsed
                      label={node.display_name}
                      {...describedPanelProps(node.short_desc, descriptions, node.display_name)}
                      icon={SECTION_ICONS[key]}
                      size='small'
                    >
                      <CatalogNodeEditor
                        name={key}
                        node={node}
                        value={
                          definition[key as keyof IDataSchemaDefinition]
                        }
                        onChange={(next) =>
                          setSection(key as keyof IDataSchemaDefinition, next)
                        }
                        readOnly={readOnly}
                      />
                    </ReqorePanel>
                  ))}
                </ReqoreControlGroup>
              </ReqoreTabsContent>
            ) : null}
          </ReqoreTabs>
        </ReqoreControlGroup>
      </SchemaDefinitionProvider>
    );
  }
);

/**
 * Public entry point — fetches the catalogue, then renders the editor
 * body. Handles the loading and catalogue-unavailable states.
 */
export const SchemaDefinitionEditor = memo(
  ({
    catalogOverride,
    catalogError,
    ...rest
  }: ISchemaDefinitionEditorProps) => {
    const { catalog, loading, error } = useSchemaOptionCatalog(
      catalogOverride,
      catalogError
    );
    const words = useReqraftLabels().schemaDefinition;

    if (loading) {
      return <Loader text={words.loadingEditor} />;
    }

    if (error || !catalog) {
      return (
        <ReqoreCallout
          intent='danger'
          icon='ErrorWarningLine'
          flat
          label={words.catalogUnavailable}
          description={errorMessage(error, words.catalogUnavailableReason)}
        />
      );
    }

    return <SchemaEditorBody catalog={catalog} {...rest} />;
  }
);

export default SchemaDefinitionEditor;
export type { ISchemaDefinitionEditorProps } from './types';
