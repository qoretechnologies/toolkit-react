import { useReqoreProperty } from '@qoretechnologies/reqore';
import { useCallback, useMemo } from 'react';
import { useEffectOnce } from 'react-use';
import { IReqraftFetchErrorResponse, isError } from '../../utils/fetch';
import { QorusServicesStore } from './store';

export interface UseQorusServicesConfig {
  loadOnMount?: boolean;
}

export interface UseQorusServicesResult extends Partial<QorusServicesStore> {
  toggleEnabledWithNotification: QorusServicesStore['toggleEnabledCall'];
}

export const useQorusServices = ({
  loadOnMount,
}: UseQorusServicesConfig): UseQorusServicesResult => {
  const addNotification = useReqoreProperty('addNotification');
  const { toggleEnabledCall, load, data, ...rest } = QorusServicesStore();

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

  const handleCallError = useCallback((result: IReqraftFetchErrorResponse) => {
    if (isError(result)) {
      addNotification({
        type: 'danger',
        content: result.data,
        title: result.error,
        opaque: false,
      });
    }
  }, []);

  const toggleEnabledWithNotification: UseQorusServicesResult['toggleEnabledWithNotification'] =
    useCallback(
      async (ids, enabled) => {
        const result = await toggleEnabledCall(ids, enabled, {
          onError: handleCallError,
          onSuccess: ({ data }) => {
            data?.forEach((resultItem) => {
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
          },
        });

        return result;
      },
      [toggleEnabledCall]
    );

  return useMemo(
    () => ({
      ...rest,
      data: items,
      toggleEnabledWithNotification,
    }),
    [rest, items, toggleEnabledWithNotification]
  );
};
