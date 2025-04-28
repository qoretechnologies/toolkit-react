import { QorusQog } from '@qoretechnologies/ts-toolkit';
import { create } from 'zustand';
import { isError, query } from '../../utils/fetch';
import { QorusFeatureStore } from '../constants';
import { createFeatureStore } from '../utils';
import { QOGS_API_URL } from './constants';

export interface IQorusQogsStore extends QorusFeatureStore<QorusQog[]> {}

export const QorusQogsStore = create<IQorusQogsStore>((set, get) => ({
  ...createFeatureStore<QorusQog[]>('qogs', set, get),
  update: async (idOrName: QorusQog['fsmid'] | QorusQog['name'], data: Partial<QorusQog>) => {
    const update = await query({ url: `${QOGS_API_URL}/${idOrName}`, method: 'PUT', body: data });

    if (isError(update)) {
      return Promise.reject(update);
    }

    return update;
  },
}));
