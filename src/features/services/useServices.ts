import { useReqoreProperty } from '@qoretechnologies/reqore';
import { useCallback, useMemo } from 'react';
import { useEffectOnce } from 'react-use';
import { isError } from '../../utils/fetch';
import { QorusServicesStore } from './store';

export interface UseQorusServicesConfig {
  loadOnMount?: boolean;
}

export const useQorusServices = ({
  loadOnMount,
}: UseQorusServicesConfig): Partial<QorusServicesStore> => {
  const addNotification = useReqoreProperty('addNotification');
  const services = QorusServicesStore();

  useEffectOnce(() => {
    if (loadOnMount) {
      services.load();
    }
  });

  const items = useMemo(() => {
    return services.data.map((item) => ({
      ...item,
      lastUpdated: item.lastUpdated,
      _selectId: item.serviceid,
    }));
  }, [services.data]);

  const toggleEnabledCall: QorusServicesStore['toggleEnabledCall'] = useCallback(
    async (ids, enabled) => {
      const result = await services.toggleEnabledCall(ids, enabled);

      console.log({ result });

      if (isError(result)) {
        // Check if the call resulted in an error
        addNotification({
          type: 'danger',
          content: result.data,
          title: result.error,
        });
      } else {
        // Check if the call was successful but some items were not enabled
        result.data?.forEach((resultItem) => {
          if (enabled && !resultItem.enabled) {
            addNotification({
              size: 'small',
              type: 'danger',
              content: resultItem.info,
              title: 'Error enabling service(s)',
            });
          }

          if (!enabled && !resultItem.disabled) {
            addNotification({
              size: 'small',
              type: 'danger',
              content: resultItem.info,
              title: 'Error disabling service(s)',
            });
          }
        });
      }

      return result;
    },
    [services.toggleEnabledCall]
  );

  return useMemo(
    () => ({
      ...services,
      data: items,
      toggleEnabledCall,
    }),
    [services, items, toggleEnabledCall]
  );
};
