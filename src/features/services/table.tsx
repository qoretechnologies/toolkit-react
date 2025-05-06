import { ReqoreButton, ReqoreIcon, ReqoreTable, ReqoreTimeAgo } from '@qoretechnologies/reqore';
import {
  IReqorePanelAction,
  IReqorePanelProps,
} from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreTableColumn } from '@qoretechnologies/reqore/dist/components/Table';
import { size } from 'lodash';
import { useMemo } from 'react';
import { FEATURES_ICONS } from '../constants';
import { SERVICES_ACTIONS_PERMISSIONS } from './constants';
import { useQorusServices } from './useServices';

export interface QorusServiceTableProps extends IReqorePanelProps {}

export const QorusServicesTable = ({}: QorusServiceTableProps) => {
  const services = useQorusServices({ loadOnMount: true });
  const actions = useMemo(
    (): IReqorePanelAction[] => [
      {
        icon: 'RefreshLine',
        tooltip: 'Refresh',
        loading: services.loading,
        loadingIconType: 4,
        onClick: () => {
          services.load();
        },
      },
    ],
    [services.loading]
  );
  const columns = useMemo(
    (): IReqoreTableColumn[] => [
      {
        filterable: true,
        dataId: 'name',
        header: {
          label: 'Name',
        },
        sortable: true,
        width: 400,
        grow: 2,
        cell: {
          padded: 'none',
          content: ({ display_name, name, serviceid, short_desc, isSelected, alerts }) => (
            <ReqoreButton
              size='small'
              as='a'
              transparent
              flat
              href={`/services/${serviceid}`}
              icon={FEATURES_ICONS.services}
              compact
              intent={isSelected ? 'info' : undefined}
              shrink={1}
              tooltip={short_desc}
              rightIcon={size(alerts) > 0 ? 'AlertLine' : undefined}
              labelEffect={{
                underline: true,
              }}
            >
              {display_name || name}
            </ReqoreButton>
          ),
        },
      },
      {
        dataId: 'type',
        align: 'center',
        header: {
          label: 'Type',
        },
        resizable: false,
        cell: {
          tooltip: (type) => (type === 'user' ? 'User' : 'System'),
          content: (data) => (
            <ReqoreIcon icon={data.type === 'user' ? 'UserLine' : 'ServerLine'} size='tiny' />
          ),
        },
        sortable: true,
      },
      {
        dataId: 'lastUpdated',
        align: 'center',
        width: 100,
        header: {
          label: 'Updated',
        },
        resizable: true,
        cell: {
          tooltip: (lastUpdated) => `Last updated: ${lastUpdated}`,
          content: ({ lastUpdated }) => {
            return <ReqoreTimeAgo time={lastUpdated} emptyMessage={'-'} />;
          },
        },
        sortable: true,
      },
      {
        dataId: 'actions',
        header: {
          icon: 'SettingsLine',
        },
        pin: 'right',
        width: 190,
        resizable: false,
        cell: {
          padded: 'none',
          actions: ({ enabled, autostart, loaded, remote, serviceid }) => [
            {
              icon: enabled ? 'ToggleFill' : 'ToggleLine',
              compact: true,
              intent: enabled ? 'info' : undefined,
              minimal: true,
              tooltip: enabled ? 'Enabled, click to disable' : 'Disabled, click to enable',
              disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.toggleEnabled),
              onClick: async () => {
                services.toggleEnabled(serviceid);
              },
            },
            {
              icon: autostart ? 'PauseLine' : 'PlayLine',
              compact: true,
              intent: autostart ? 'info' : undefined,
              minimal: true,
              tooltip: autostart
                ? 'Autostart is enabled, click to disable'
                : 'Autostart is disabled, click to enable',
              disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.toggleAutostart),
              onClick: async () => {
                services.toggleAutostart(serviceid);
              },
            },
            {
              icon: 'ArrowUpLine',
              compact: true,
              intent: loaded ? 'info' : undefined,
              minimal: true,
              tooltip: loaded
                ? 'Service is loaded, click to unload'
                : 'Service is unloaded, click to load',
              onClick: async () => {
                services.toggleLoaded(serviceid);
              },
              disabled: loaded
                ? !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.unload)
                : !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.load),
            },
            {
              icon: 'GlobeLine',
              compact: true,
              intent: remote ? 'info' : undefined,
              minimal: true,
              tooltip: remote
                ? 'Remote service, click to change to local'
                : 'Local service, click to change to remote',
              disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.setRemote),
              onClick: async () => {
                services.toggleRemote(serviceid);
              },
            },
            {
              icon: 'HistoryLine',
              compact: true,
              minimal: true,
              tooltip: 'Reset service',
              disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.reset),
              onClick: async () => {
                services.reset(serviceid);
              },
            },
          ],
        },
      },
    ],
    []
  );

  return (
    <ReqoreTable
      size='small'
      showHelp
      selectable
      sort={{
        by: 'name',
        direction: 'asc',
      }}
      loading={services.loading}
      data={services.data}
      columns={columns}
      fill
      wrapperSize='small'
      filterable
      striped
      exportable
      actions={actions}
    />
  );
};
