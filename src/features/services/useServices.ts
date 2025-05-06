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
    toggleEnabledCall,
    toggleAutostartCall,
    toggleLoadedCall,
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
    }));
  }, [data]);

  return useMemo(
    () => ({
      data: items,
      load,
      toggleEnabledCall,
      toggleAutostartCall,
      toggleLoadedCall,
      hasPermissions,
      toggleRemote,
      reset,
      loading,
    }),
    [
      items,
      load,
      loading,
      toggleEnabledCall,
      toggleAutostartCall,
      toggleLoadedCall,
      toggleRemote,
      reset,
      hasPermissions,
    ]
  );
};
