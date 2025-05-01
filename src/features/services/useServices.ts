import { useMemo } from 'react';
import { useEffectOnce } from 'react-use';
import { QorusServicesStore } from './store';

export interface UseQorusServicesConfig {
  loadOnMount?: boolean;
}

export const useQorusServices = ({ loadOnMount }: UseQorusServicesConfig): QorusServicesStore => {
  const { data, load, loading } = QorusServicesStore();

  useEffectOnce(() => {
    if (loadOnMount) {
      load();
    }
  });

  const items = useMemo(() => {
    return data.map((item) => ({
      ...item,
      _selectId: item.serviceid,
    }));
  }, [data]);

  return useMemo(() => ({ data: items, load, loading }), [items, load, loading]);
};
