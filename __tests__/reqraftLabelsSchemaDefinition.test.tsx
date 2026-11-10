// Copyright 2026 Qore Technologies, s.r.o.
/* The schema-definition editor says a host's words: its tabs, its hints (bold where the words say), its warnings and
 * its counts, and the English it always did when a host gives nothing. */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SchemaDefinitionEditor from '../src/components/form/fields/schema-definition';
import { MigrationsTab } from '../src/components/form/fields/schema-definition/MigrationsTab';
import { mockSchemaCatalog } from '../src/components/form/fields/schema-definition/mockCatalog';
import { mockPopulatedDefinition } from '../src/components/form/fields/schema-definition/mockDefinition';
import { TablesTab } from '../src/components/form/fields/schema-definition/TablesTab';
import { ICatalogList, ICatalogMap } from '../src/components/form/fields/schema-definition/types';
import { FetchContext } from '../src/contexts/FetchContext';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';
import { emptyFetchContext } from './support/fetchContext';

afterEach(() => {
  setReqraftLabels();
});

const drawn = (children: ReactNode) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>{children}</FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** The editor, on a schema whose own name differs from the object's, so the name warning shows. */
const editor = () =>
  drawn(
    <SchemaDefinitionEditor
      catalogOverride={mockSchemaCatalog}
      value={mockPopulatedDefinition}
      wrapperName='renamed_schema'
      onChange={vi.fn()}
    />
  );

const text = () => document.body.textContent ?? '';
const bold = () => Array.from(document.querySelectorAll('b')).map((each) => each.textContent);

describe('the schema-definition editor', () => {
  it('says the English it always did when a host gives nothing', async () => {
    editor();
    await waitFor(() => expect(text()).toContain('Reference data'));
    expect(text()).toContain('Tables');
    expect(text()).toContain('Migrations');
    expect(text()).toContain('Schema name does not match the interface name');
    expect(text()).toContain('Building a database schema');
    // the hint reads as one sentence, its parts set apart in bold
    expect(text()).toContain(
      'This editor builds a DataSchema document — the definition of the tables, sequences, and reference data this schema manages.'
    );
    expect(text()).toContain(
      'can be upgraded. Click any row to edit it in a side panel. Once saved, the schema'
    );
    expect(bold()).toEqual(
      expect.arrayContaining(['DataSchema document', 'Click any row to edit it in a side panel.'])
    );
  });

  it('says a host’s words, the rest English, and others when the language changes', async () => {
    setReqraftLabels({
      schemaDefinition: {
        tabs: { tables: 'Tabellen' },
        nameMismatch: 'Der Name des Schemas passt nicht',
        editorHint: (strong) => ['Dieser Editor baut ein ', strong('DataSchema-Dokument'), '.'],
      },
    });
    editor();
    await waitFor(() => expect(text()).toContain('Tabellen'));
    // a tab the host did not give stays English
    expect(text()).toContain('Migrations');
    expect(text()).toContain('Der Name des Schemas passt nicht');
    expect(text()).not.toContain('Schema name does not match');
    expect(text()).toContain('Dieser Editor baut ein DataSchema-Dokument.');
    expect(bold()).toContain('DataSchema-Dokument');
    expect(bold()).not.toContain('DataSchema document');

    act(() => setReqraftLabels({ schemaDefinition: { tabs: { tables: 'Tableaux' } } }));
    await waitFor(() => expect(text()).toContain('Tableaux'));
    expect(text()).not.toContain('Tabellen');
  });

  it('says why it cannot show a schema in the host’s words', async () => {
    const { unmount } = drawn(<SchemaDefinitionEditor catalogError='Not here' onChange={vi.fn()} />);
    await waitFor(() => expect(text()).toContain('Could not load schema options'));
    unmount();

    setReqraftLabels({ schemaDefinition: { catalogUnavailable: 'Schema-Optionen nicht geladen' } });
    drawn(<SchemaDefinitionEditor catalogError='Not here' onChange={vi.fn()} />);
    await waitFor(() => expect(text()).toContain('Schema-Optionen nicht geladen'));
    // the server's own reason is the server's, whatever the language
    expect(text()).toContain('Not here');
  });
});

describe('the tables and migrations tabs', () => {
  const tablesNode = mockSchemaCatalog.definition.tables as ICatalogMap;
  const migrationsNode = mockSchemaCatalog.definition.migrations as ICatalogList;

  const tables = () =>
    drawn(
      <TablesTab
        node={tablesNode}
        value={{ customers: { columns: { id: {}, name: {} } } }}
        onChange={vi.fn()}
      />
    );
  const migrations = (value: Array<Record<string, unknown>>) =>
    drawn(<MigrationsTab node={migrationsNode} value={value} onChange={vi.fn()} />);

  it('count and name in English when a host gives nothing', async () => {
    tables();
    await waitFor(() => expect(text()).toContain('2 columns'));
    expect(text()).toContain('Add table');
  });

  it('count and name in the host’s words', async () => {
    setReqraftLabels({
      schemaDefinition: {
        columnCount: (count) => `${count} Spalten`,
        addTable: 'Tabelle hinzufügen',
      },
    });
    tables();
    await waitFor(() => expect(text()).toContain('2 Spalten'));
    expect(text()).toContain('Tabelle hinzufügen');
    expect(text()).not.toContain('2 columns');
  });

  it('name a migration block without a version, in English and in the host’s words', async () => {
    const { unmount } = migrations([{ description: 'first' }]);
    await waitFor(() => expect(text()).toContain('v(no version)'));
    expect(text()).toContain('0 steps');
    unmount();

    setReqraftLabels({
      schemaDefinition: {
        migrationBlock: (version) => (version ? `Version ${version}` : 'Ohne Version'),
        stepCount: (count) => `${count} Schritte`,
      },
    });
    migrations([{ description: 'first' }, { version: '1.1' }]);
    await waitFor(() => expect(text()).toContain('Ohne Version'));
    expect(text()).toContain('Version 1.1');
    expect(text()).toContain('0 Schritte');
  });

  it('say there are no migrations in the host’s words', async () => {
    setReqraftLabels({ schemaDefinition: { noMigrations: 'Noch keine Migrationen.' } });
    migrations([]);
    await waitFor(() => expect(text()).toContain('Noch keine Migrationen.'));
    // a word the host did not give stays English
    expect(text()).toContain('Add migration block');
  });
});
