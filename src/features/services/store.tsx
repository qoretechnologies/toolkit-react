import { create } from 'zustand';
import { QorusFeatureStore } from '../constants';
import { createFeatureStore } from '../utils';

export interface QorusService {
  type: 'user' | 'system';
  name: string;
  version: string;
  desc: string;
  serviceid: number;
}
export interface QorusServicesStore extends QorusFeatureStore<QorusService[]> {}

export const QorusServicesStore = create<QorusServicesStore>((set, get) => ({
  ...createFeatureStore<QorusService[]>('services', set, get),
}));
