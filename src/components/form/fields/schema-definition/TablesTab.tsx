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
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
import { Hint } from './Hint';
import { TableEditor } from './TableEditor';
import { removeKey, renameKey, sectionCount, setKey, uniqueKey } from './helpers';
import { ICatalogMap } from './types';
import { useDestructiveButtonProps } from '../../../../hooks/useDestructiveButtonProps';

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
    const words = useReqraftLabels().schemaDefinition;
    // a destructive control's look, the same wherever reqraft draws one (`useDestructiveButtonProps`)
    const destructive = useDestructiveButtonProps();

    const addTable = useCallback(() => {
      onChange(setKey(value, uniqueKey(value, 'new_table'), {}));
    }, [value, onChange]);

    const confirmRemoveTable = useCallback(
      (tableName: string) => {
        const colCount = sectionCount(value[tableName]?.columns);
        confirmAction({
          title: words.removeTable,
          description: words.removeTableDescription(tableName, colCount),
          confirmLabel: words.removeTable,
          intent: 'danger',
          onConfirm: () => onChange(removeKey(value, tableName)),
        });
      },
      [value, onChange, confirmAction, words]
    );

    if (tables.length === 0) {
      return (
        <ReqoreControlGroup vertical fluid gapSize='normal'>
          <ReqoreCallout intent='info' flat icon='Table2'>
            {readOnly ? words.noTablesRead : words.noTables}
          </ReqoreCallout>
          {!readOnly ? (
            <ReqoreButton icon='AddLine' intent='info' minimal fixed onClick={addTable}>
              {words.addTable}
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
            title={words.tablesHintTitle}
            icon='Table2'
            text={words.tablesHint}
          />
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
              badge={[words.columnCount(columnCount)]}
              actions={
                readOnly
                  ? undefined
                  : [
                      {
                        icon: 'DeleteBinLine',
                        minimal: true,
                        flat: true,
                        ...destructive,
                        size: 'small',
                        tooltip: words.removeTable,
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
            {words.addTable}
          </ReqoreButton>
        ) : null}
      </ReqoreControlGroup>
    );
  }
);
