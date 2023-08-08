import { keys } from 'lodash';
import { useMemo } from 'react';
import { SIZE_TO_PX } from '../../constants/sizes';
import { TReqoreIntent } from '../../constants/theme';
import { IReqoreIconName } from '../../types/icons';
import { IReqoreButtonProps } from '../Button';
import { IReqorePanelProps } from '../Panel';
import ReqoreTable, { IReqoreTableColumn, IReqoreTableProps, IReqoreTableRowData } from '../Table';
import { IReqoreTableValueProps, ReqoreTableValue } from '../Table/value';

export type TReqoreKeyValueTablePrimitiveValue = string | number | boolean | null | undefined;
export type TReqoreKeyValueTableValue =
  | TReqoreKeyValueTablePrimitiveValue
  | TReqoreKeyValueTablePrimitiveValue[]
  | { [key: string]: TReqoreKeyValueTableValue };

export interface IReqoreKeyValueTableProps
  extends IReqorePanelProps,
    Pick<
      IReqoreTableProps,
      | 'striped'
      | 'width'
      | 'height'
      | 'fill'
      | 'filterable'
      | 'exportable'
      | 'filter'
      | 'onFilterChange'
      | 'filterProps'
      | 'zoomable'
      | 'wrapperSize'
      | 'paging'
    > {
  data: { [key: string | number]: TReqoreKeyValueTableValue };

  keyLabel?: string;
  keyIcon?: IReqoreIconName;
  keyColumnIntent?: TReqoreIntent;
  keyAlign?: IReqoreTableColumn['align'];
  maxKeyWidth?: number;

  sortable?: boolean;

  rowActions?: (key: string, value: TReqoreKeyValueTableValue) => IReqoreButtonProps[];

  valueLabel?: string;
  valueIcon?: IReqoreIconName;
  valueAlign?: IReqoreTableColumn['align'];
  minValueWidth?: number;
  defaultValueFilter?: string | number;

  valueRenderer?: (
    data: IReqoreTableRowData,
    defaultComponent?: ({ value }: IReqoreTableValueProps) => any
  ) => any;
}

export const ReqoreKeyValueTable = ({
  data,
  keyLabel,
  keyIcon,
  valueLabel,
  valueIcon,
  valueRenderer,
  keyColumnIntent = 'muted',
  minValueWidth = 100,
  maxKeyWidth = 200,
  keyAlign = 'left',
  valueAlign = 'left',
  defaultValueFilter,
  sortable,
  rowActions,
  ...rest
}: IReqoreKeyValueTableProps) => {
  const { columns, items } = useMemo(() => {
    let columns: IReqoreTableColumn[] = [
      {
        dataId: 'tableKey',
        grow: 1,
        sortable,
        width: maxKeyWidth < 150 ? maxKeyWidth : 150,
        pin: 'left',
        hideable: false,
        intent: keyColumnIntent,
        maxWidth: maxKeyWidth,
        align: keyAlign,

        header: {
          icon: keyIcon,
          label: keyLabel,
        },

        cell: {
          content: 'title',
        },
      },
      {
        dataId: 'value',
        grow: 3,
        sortable,
        hideable: false,
        filterable: true,
        pinnable: false,
        minWidth: minValueWidth,
        filter: defaultValueFilter,
        align: valueAlign,

        header: {
          icon: valueIcon,
          label: valueLabel,
        },

        cell: {
          tooltip: (value) => ({
            content: JSON.stringify(value),
            noArrow: true,
            useTargetWidth: true,
          }),
          content: (data) =>
            valueRenderer?.(data, ReqoreTableValue) || <ReqoreTableValue value={data.value} />,
        },
      },
    ];

    if (rowActions) {
      columns.push({
        dataId: 'actions',
        hideable: false,
        pin: 'right',
        header: {
          icon: 'SettingsLine',
        },
        width: SIZE_TO_PX[rest.size || 'normal'] * 2,
        align: 'center',
        cell: {
          padded: 'none',
          actions: (data) => rowActions(data.tableKey, data.value),
        },
      });
    }

    let items: IReqoreTableRowData[] = [];

    keys(data).map((key) => {
      items.push({
        tableKey: key,
        value: data[key],
      });
    });

    return { columns, items };
  }, [data]);

  return (
    <ReqoreTable
      columns={columns}
      data={items}
      {...rest}
      sort={
        sortable
          ? {
              by: 'tableKey',
              thenBy: 'value',
              direction: 'asc',
            }
          : undefined
      }
      className={`${rest.className || ''} reqore-key-value-table`}
    />
  );
};
