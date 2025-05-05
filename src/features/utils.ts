import { currentUserStore } from '../stores/currentUser/currentUser';
import { load } from './api';
import { FEATURES_API_URL, QorusFeatureStore } from './constants';

export const createFeatureStore = <Data>(
  type: keyof typeof FEATURES_API_URL,
  set,
  get
): QorusFeatureStore<Data> => {
  return {
    loading: false,
    idKey: 'id',
    itemById: (id: string | number): Data | undefined => {
      const { data, idKey } = get();

      if (!data) {
        return undefined;
      }

      return data.find((item: Data) => item[idKey] === id);
    },
    data: [] as Data[],
    error: undefined,
    errorData: undefined,
    updateItem: (id: string | number, data: Partial<Data>) => {
      const { data: currentData, idKey } = get();

      if (!currentData) {
        return;
      }

      const itemIndex = currentData.findIndex((item: Data) => item[idKey] === id);

      if (itemIndex === -1) {
        return;
      }

      const updatedData = [...currentData];
      updatedData[itemIndex] = { ...updatedData[itemIndex], ...data, lastUpdated: Date.now() };

      set({ data: updatedData });
    },
    hasPermissions: (permissions: string[]): boolean => {
      return currentUserStore.getState().hasAnyPermission(permissions);
    },
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
