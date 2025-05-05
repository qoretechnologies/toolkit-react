import { create } from 'zustand';
import { query } from '../../utils/fetch';
import { toggleEnabled } from '../api';
import { FEATURES_API_URL, QorusFeatureStore } from '../constants';
import { createFeatureStore } from '../utils';
import { SERVICES_ACTIONS_PERMISSIONS } from './constants';

export interface QorusService {
  type: 'user' | 'system';
  name: string;
  version: string;
  desc: string;
  serviceid: number;
  enabled: boolean;
  autostart?: boolean;
  loaded?: string;
  remote?: boolean;
  lastUpdated?: number;
}
export interface QorusServicesStore extends QorusFeatureStore<QorusService> {
  toggleEnabled: (id: string | number) => Promise<void>;
  toggleAutostart: (id: string | number) => Promise<void>;
  toggleLoaded: (id: string | number) => Promise<void>;
  toggleRemote: (id: string | number) => Promise<void>;
  reset: (id: string | number) => Promise<void>;
}

export const QorusServicesStore = create<QorusServicesStore>((set, get) => ({
  ...createFeatureStore<QorusService>('services', set, get),
  idKey: 'serviceid',

  toggleEnabled: async (id: string | number) => {
    const service = get().itemById(id);
    const permissions = SERVICES_ACTIONS_PERMISSIONS.toggleEnabled;

    if (!service || !get().hasPermissions(permissions)) {
      return;
    }

    toggleEnabled<QorusService>({ type: 'services', id, enable: !service?.enabled });
  },
  toggleAutostart: async (id: string | number) => {
    if (get().hasPermissions(SERVICES_ACTIONS_PERMISSIONS.toggleAutostart)) {
      const service = get().itemById(id);

      if (!service) {
        return;
      }

      await query({
        method: 'PUT',
        url: `${FEATURES_API_URL.services}/${id}?action=setAutostart`,
        body: { autostart: !service?.autostart },
        cache: false,
      });
    }
  },
  toggleLoaded: async (id: string | number) => {
    const service = get().itemById(id);
    const permissions = service?.loaded
      ? SERVICES_ACTIONS_PERMISSIONS.unload
      : SERVICES_ACTIONS_PERMISSIONS.load;

    if (!service || !get().hasPermissions(permissions)) {
      return;
    }

    await query({
      method: 'PUT',
      url: `${FEATURES_API_URL.services}/${id}?action=${service.loaded ? 'unload' : 'load'}`,
      cache: false,
    });
  },
  toggleRemote: async (id: string | number) => {
    const service = get().itemById(id);
    const permissions = SERVICES_ACTIONS_PERMISSIONS.setRemote;

    if (!service || !get().hasPermissions(permissions)) {
      return;
    }

    await query({
      method: 'PUT',
      url: `${FEATURES_API_URL.services}/${id}?action=setRemote`,
      body: { remote: !service?.remote },
      cache: false,
    });
  },
  reset: async (id: string | number) => {
    const service = get().itemById(id);
    const permissions = SERVICES_ACTIONS_PERMISSIONS.reset;

    if (!service || !get().hasPermissions(permissions)) {
      return;
    }

    await query({
      method: 'PUT',
      url: `${FEATURES_API_URL.services}/${id}?action=reset`,
      cache: false,
    });
  },
}));
