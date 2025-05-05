import { useCallback, useMemo } from 'react';
import { useEffectOnce } from 'react-use';
import { useReqraftWebSocket } from '../../hooks/useWebSocket/useWebSocket';
import { QorusApiEvent } from '../../utils/websocket';
import { QorusServiceEvent, SERVICE_ENABLE_TOGGLE_EVENT } from './events';
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
    updateItem,
  } = QorusServicesStore();

  useEffectOnce(() => {
    if (loadOnMount) {
      load();
    }
  });

  const items = useMemo(() => {
    return data.map((item) => ({
      ...item,
      lastUpdated: item.lastUpdated || 0,
      _selectId: item.serviceid,
    }));
  }, [data]);

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      const data: QorusApiEvent<QorusServiceEvent>[] = JSON.parse(e.data);

      data.forEach((event: QorusApiEvent<QorusServiceEvent>) => {
        if (event.eventstr === SERVICE_ENABLE_TOGGLE_EVENT) {
          updateItem(event.info.id, { enabled: event.info.enabled });
        }
      });
    },
    [updateItem]
  );

  useReqraftWebSocket({
    url: 'apievents',
    openOnMount: true,
    onMessage: handleMessage,
  });

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
