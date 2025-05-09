import { ReqoreIcon, ReqoreTable, ReqoreTag, ReqoreTimeAgo } from '@qoretechnologies/reqore';
import {
  IReqorePanelAction,
  IReqorePanelProps,
} from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreTableColumn } from '@qoretechnologies/reqore/dist/components/Table';
import { size } from 'lodash';
import { useMemo, useState } from 'react';
import { FEATURES_ICONS } from '../constants';
import { SERVICES_ACTIONS_PERMISSIONS } from './constants';
import { useQorusServices } from './useServices';

export interface QorusServiceTableProps extends IReqorePanelProps {}

export const QorusServicesTable = ({}: QorusServiceTableProps) => {
  const [selected, setSelected] = useState<any[]>([]);

  const services = useQorusServices({ loadOnMount: true });
  const actions = useMemo(
    (): IReqorePanelAction[] => [
      {
        label: 'With Selected',
        minimal: true,
        intent: 'info',
        badge: selected.length,
        show: selected.length > 0,
        tooltip: 'Manage Selected Items',
        loading: services.loading,
        loadingIconType: 4,
        actions: [
          {
            icon: 'ToggleFill',
            label: 'Enable',
            disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.toggleEnabled),
            onClick: async () => {
              services.toggleEnabledWithNotification(selected, true);
              setSelected([]);
            },
          },
          {
            icon: 'ToggleLine',
            label: 'Disable',
            disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.toggleEnabled),
            onClick: async () => {
              services.toggleEnabledWithNotification(selected, false);
              setSelected([]);
            },
          },
          {
            divider: true,
            dividerPadded: 'none',
          },
          {
            icon: 'ArrowUpLine',
            label: 'Load',
            disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.load),
            onClick: async () => {
              services.toggleLoadedCall(selected, true);
              setSelected([]);
            },
          },
          {
            icon: 'ArrowDownLine',
            label: 'Unload',
            disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.unload),
            onClick: async () => {
              services.toggleLoadedCall(selected, false);
              setSelected([]);
            },
          },
          {
            divider: true,
            dividerPadded: 'none',
          },
          {
            icon: 'HistoryLine',
            label: 'Reset',
            disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.reset),
            onClick: async () => {
              services.resetCall(selected);
              setSelected([]);
            },
          },
        ],
      },
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
    [services.loading, selected]
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
          content: ({ display_name, name, serviceid, short_desc, isSelected, alerts }) => (
            <ReqoreTag
              size='small'
              as='a'
              flat
              href={`/services/${serviceid}`}
              icon={FEATURES_ICONS.services}
              compact
              customTheme={{
                main:
                  size(alerts) > 0
                    ? 'warning:lighten:1:0.5'
                    : isSelected
                    ? 'info:lighten:1:0.5'
                    : undefined,
              }}
              shrink={1}
              tooltip={short_desc}
              rightIcon={size(alerts) > 0 ? 'AlertLine' : undefined}
              label={display_name || name}
            />
          ),
        },
      },
      {
        dataId: 'version',
        align: 'center',
        header: {
          label: 'V',
          tooltip: 'Version',
        },
        resizable: true,
        cell: {
          content: 'number',
        },
        sortable: true,
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
          label: 'Last Update',
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
                services.toggleEnabledWithNotification([serviceid], !enabled);
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
                services.toggleAutostartCall(serviceid, !autostart);
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
                services.toggleLoadedCall([serviceid], !loaded);
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
                services.toggleRemoteCall(serviceid);
              },
            },
            {
              icon: 'HistoryLine',
              compact: true,
              minimal: true,
              tooltip: 'Reset service',
              disabled: !services.hasPermissions(SERVICES_ACTIONS_PERMISSIONS.reset),
              onClick: async () => {
                services.resetCall(serviceid);
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
      onSelectedChange={setSelected}
      selected={selected}
    />
  );
};
