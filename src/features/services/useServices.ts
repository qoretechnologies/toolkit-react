import { useReqoreProperty } from '@qoretechnologies/reqore';
import { useCallback, useMemo } from 'react';
import { useEffectOnce } from 'react-use';
import shortid from 'shortid';
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

  const handleCallError = useCallback((result: IReqraftFetchErrorResponse, callId?: string) => {
    if (isError(result)) {
      addNotification({
        type: 'danger',
        content: result.data,
        title: result.error,
        id: callId,
      });
    }
  }, []);

  const handleCallBefore = useCallback((callId?: string) => {
    addNotification({
      type: 'pending',
      content: 'Working on it...',
      duration: 10000,
      id: callId,
    });
  }, []);

  const handleCallSuccess = useCallback((callId?: string) => {
    addNotification({
      type: 'success',
      content: 'Operation completed successfully!',
      id: callId,
      duration: 2000,
    });
  }, []);

  const toggleEnabledWithNotification: UseQorusServicesResult['toggleEnabledWithNotification'] =
    useCallback(
      async (ids, enabled) => {
        const id = shortid.generate();
        const result = await toggleEnabledCall(ids, enabled, {
          onBefore: () => handleCallBefore(id),
          onError: (result) => handleCallError(result, id),
          onSuccess: ({ data }) => {
            let success = true;

            data?.forEach((resultItem) => {
              if (enabled && !resultItem.enabled) {
                addNotification({
                  size: 'small',
                  type: 'danger',
                  content: resultItem.info,
                  title: 'Error enabling service(s)',
                  id,
                });

                success = false;
              }

              if (!enabled && !resultItem.disabled) {
                addNotification({
                  size: 'small',
                  type: 'danger',
                  content: resultItem.info,
                  title: 'Error disabling service(s)',
                  id,
                });

                success = false;
              }
            });

            if (success) {
              handleCallSuccess(id);
            }
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
