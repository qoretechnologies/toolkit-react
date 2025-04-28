import { load } from './api';
import { FEATURES_API_URL, QorusFeatureStore } from './constants';

export const createFeatureStore = <Data>(
  type: keyof typeof FEATURES_API_URL,
  set,
  get
): QorusFeatureStore<Data> => {
  return {
    loading: false,
    data: [] as Data,
    error: undefined,
    errorData: undefined,
    load: async () => {
      const result = await load<Data>({
        type,
        onBefore: () => set({ loading: true, error: undefined }),
        onSuccess: (data) => {
          set({ loading: false, data: data.data, error: undefined });
        },
        onError: (data) => {
          set({ loading: false, error: data.error, errorData: data.data });
        },
      });

      return result.data;
    },
  };
};
