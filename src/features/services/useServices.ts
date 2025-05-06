import { size } from 'lodash';
import { useMemo } from 'react';
import { useEffectOnce } from 'react-use';
import { QorusServicesStore } from './store';

export interface UseQorusServicesConfig {
  loadOnMount?: boolean;
}

export const useQorusServices = ({
  loadOnMount,
}: UseQorusServicesConfig): Partial<QorusServicesStore> => {
  const {
    data,
    load,
    toggleEnabled,
    toggleAutostart,
    toggleLoaded,
    toggleRemote,
    reset,
    hasPermissions,
    loading,
  } = QorusServicesStore();

  useEffectOnce(() => {
    if (loadOnMount) {
      load();
    }
  });

  const items = useMemo(() => {
    return data.map((item) => ({
      ...item,
      lastUpdated: item.lastUpdated,
      _selectId: item.serviceid,
      _intent: size(item.alerts) > 0 ? 'danger' : undefined,
    }));
  }, [data]);

  return useMemo(
    () => ({
      data: items,
      load,
      toggleEnabled,
      toggleAutostart,
      toggleLoaded,
      hasPermissions,
      toggleRemote,
      reset,
      loading,
    }),
    [
      items,
      load,
      loading,
      toggleEnabled,
      toggleAutostart,
      toggleLoaded,
      toggleRemote,
      reset,
      hasPermissions,
    ]
  );
};
