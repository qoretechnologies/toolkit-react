/**
 * The Tables tab — a stack of inline-expandable panels, one per table
 * (the locked "inline expanded panel per table" decision). Each panel
 * collapses to a one-line summary and expands in place to reveal the
 * full `TableEditor`.
 */
import {
  ReqoreButton,
  ReqoreCallout,
  ReqoreControlGroup,
  ReqorePanel,
  useReqoreProperty,
} from '@qoretechnologies/reqore';
import { memo, useCallback } from 'react';
import { Hint } from './Hint';
import { TableEditor } from './TableEditor';
import { removeKey, renameKey, sectionCount, setKey, uniqueKey } from './helpers';
import { ICatalogMap } from './types';

export interface ITablesTabProps {
  /** The `tables` map node from the catalogue. */
  node: ICatalogMap;
  value: Record<string, Record<string, unknown>>;
  onChange: (value: Record<string, Record<string, unknown>>) => void;
  readOnly?: boolean;
}

export const TablesTab = memo(
  ({ node, value, onChange, readOnly }: ITablesTabProps) => {
    const tables = Object.entries(value ?? {});
    const confirmAction = useReqoreProperty('confirmAction');

    const addTable = useCallback(() => {
      onChange(setKey(value, uniqueKey(value, 'new_table'), {}));
    }, [value, onChange]);

    const confirmRemoveTable = useCallback(
      (tableName: string) => {
        const colCount = sectionCount(value[tableName]?.columns);
        confirmAction({
          title: 'Remove table',
          description: `Remove the table "${tableName}"${
            colCount > 0
              ? ` and its ${colCount} column${colCount === 1 ? '' : 's'}`
              : ''
          }?`,
          confirmLabel: 'Remove table',
          intent: 'danger',
          onConfirm: () => onChange(removeKey(value, tableName)),
        });
      },
      [value, onChange, confirmAction]
    );

    if (tables.length === 0) {
      return (
        <ReqoreControlGroup vertical fluid gapSize='normal'>
          <ReqoreCallout intent='info' flat icon='Table2'>
            {readOnly
              ? 'This schema defines no tables.'
              : 'No tables yet. Add the first table to start building the schema.'}
          </ReqoreCallout>
          {!readOnly ? (
            <ReqoreButton icon='AddLine' intent='info' minimal fixed onClick={addTable}>
              Add table
            </ReqoreButton>
          ) : null}
        </ReqoreControlGroup>
      );
    }

    return (
      <ReqoreControlGroup vertical fluid gapSize='small'>
        {!readOnly ? (
          <Hint
            id='hint.schema-tables'
            title='Working with tables'
            icon='Table2'
          >
            Each row is a database table. Expand one to reach its
            columns, primary key, indexes, and constraints — each on its
            own sub-tab. <b>Click a column row to edit it in a side
            panel</b> where you set its full definition.
          </Hint>
        ) : null}
        {tables.map(([tableName, tableValue]) => {
          const columnCount = sectionCount(tableValue?.columns);
          return (
            <ReqorePanel
              key={tableName}
              raised
              collapsible
              isCollapsed
              icon='Table2'
              label={tableName}
              badge={[
                `${columnCount} column${columnCount === 1 ? '' : 's'}`,
              ]}
              actions={
                readOnly
                  ? undefined
                  : [
                      {
                        icon: 'DeleteBinLine',
                        minimal: true,
                        flat: true,
                        intent: 'danger',
                        size: 'small',
                        tooltip: 'Remove table',
                        onClick: () => confirmRemoveTable(tableName),
                      },
                    ]
              }
            >
              <TableEditor
                name={`table-${tableName}`}
                tableName={tableName}
                onRename={(next) =>
                  onChange(renameKey(value, tableName, next))
                }
                taken={(next) => value[next] !== undefined}
                options={node.options}
                value={tableValue ?? {}}
                onChange={(next) => onChange(setKey(value, tableName, next))}
                readOnly={readOnly}
              />
            </ReqorePanel>
          );
        })}
        {!readOnly ? (
          <ReqoreButton icon='AddLine' intent='info' minimal fixed onClick={addTable}>
            Add table
          </ReqoreButton>
        ) : null}
      </ReqoreControlGroup>
    );
  }
);
