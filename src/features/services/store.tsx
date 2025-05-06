import { QorusService } from '@qoretechnologies/ts-toolkit';
import { create } from 'zustand';
import { currentUserStore } from '../../stores/currentUser/currentUser';
import { query } from '../../utils/fetch';
import {} from '../../utils/websocket';
import { toggleEnabled } from '../api';
import { FEATURES_API_URL, QorusFeatureStore } from '../constants';
import { QorusApiEvent, QorusGlobalEvents } from '../events';
import { createFeatureStore } from '../utils';
import { SERVICES_ACTIONS_PERMISSIONS } from './constants';
import { QorusServiceEvents } from './events';

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

  registerApiEvents: () => {
    currentUserStore.getState().apiEvents.addHandler('message', (e) => {
      if (e.data === 'pong') {
        return;
      }

      const data: QorusApiEvent[] = JSON.parse(e.data);

      data.forEach((event: QorusApiEvent) => {
        if (event.eventstr === QorusServiceEvents.ENABLE_TOGGLE) {
          get().updateItem(event.info.id, { enabled: event.info.enabled });
        }

        if (event.eventstr === QorusServiceEvents.UPDATED) {
          get().updateItem(event.info.serviceid, { ...event.info.info });
        }

        if (event.eventstr === QorusServiceEvents.START) {
          get().updateItem(event.info.serviceid, { loaded: event.time });
        }

        if (event.eventstr === QorusServiceEvents.STOP) {
          get().updateItem(event.info.serviceid, { loaded: undefined });
        }

        if (event.eventstr === QorusGlobalEvents.AlertCleared) {
          const service = get().itemById(event.info.id);
          get().updateItem(event.info.id, { enabled: event.info.enabled });
        }
      });
    });
  },

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
