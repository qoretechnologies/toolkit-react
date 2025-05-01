import { ReqoreIcon, ReqoreTable } from '@qoretechnologies/reqore';
import { IReqorePanelProps } from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreTableColumn } from '@qoretechnologies/reqore/dist/components/Table';
import { useMemo } from 'react';
import { useQorusServices } from './useServices';

export interface QorusServiceTableProps extends IReqorePanelProps {}

export const QorusServicesTable = ({}: QorusServiceTableProps) => {
  const services = useQorusServices({ loadOnMount: true });
  const columns = useMemo(
    (): IReqoreTableColumn[] => [
      {
        dataId: 'serviceid',
        header: {
          label: 'ID',
        },
        sortable: true,
        pin: 'left',
        align: 'center',
      },
      {
        filterable: true,
        dataId: 'name',
        header: {
          label: 'Name',
        },
        sortable: true,
        grow: 1,
      },
      {
        dataId: 'type',
        align: 'center',
        header: {
          label: 'Type',
        },
        cell: {
          content: (data) =>
            data.type === 'user' ? (
              <ReqoreIcon icon='UserLine' size='small' />
            ) : (
              <ReqoreIcon icon='ServerLine' size='small' />
            ),
        },
        sortable: true,
      },
    ],
    []
  );
  return (
    <ReqoreTable
      //size='small'
      selectable
      loading={services.loading}
      data={services.data}
      columns={columns}
      fill
      filterable
      striped
    />
  );
};
