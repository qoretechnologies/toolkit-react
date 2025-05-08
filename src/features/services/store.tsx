import { QorusService } from '@qoretechnologies/ts-toolkit';
import { create } from 'zustand';
import { currentUserStore } from '../../stores/currentUser/currentUser';
import { query, TReqraftFetchResponse } from '../../utils/fetch';
import {} from '../../utils/websocket';
import { FEATURES_API_URL, QorusFeatureStore } from '../constants';
import { QorusApiEvent, QorusGlobalEvents } from '../events';
import { createFeatureStore } from '../utils';
import { QorusServiceEnableCallResponse } from './api';
import { SERVICES_ACTIONS_PERMISSIONS } from './constants';
import { QorusServiceEvents } from './events';

export interface QorusServicesStore extends QorusFeatureStore<QorusService> {
  toggleEnabledCall: (
    ids: number[],
    enabled: true | false
  ) => Promise<TReqraftFetchResponse<QorusServiceEnableCallResponse[]>>;
  toggleAutostartCall: (
    ids: number,
    autostart: true | false
  ) => Promise<TReqraftFetchResponse<unknown>>;
  toggleLoadedCall: (
    ids: number[],
    loaded: true | false
  ) => Promise<TReqraftFetchResponse<unknown>>;
  resetCall: (id: number[]) => Promise<TReqraftFetchResponse<unknown>>;
  toggleRemoteCall: (id: string | number) => Promise<TReqraftFetchResponse<unknown>>;
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

        if (event.eventstr === QorusGlobalEvents.AlertRaised && event.info.type === 'SERVICE') {
          const service = get().itemById(event.info.id);
          const alerts = [...(service?.alerts || []), event.info];

          get().updateItem(event.info.id, { alerts });
        }

        if (event.eventstr === QorusGlobalEvents.AlertCleared && event.info.type === 'SERVICE') {
          const service = get().itemById(event.info.id);
          const alerts = service?.alerts?.filter((alert) => alert.alertid !== event.info.alertid);

          get().updateItem(event.info.id, { alerts });
        }
      });
    });
  },

  toggleEnabledCall: (
    ids: number[],
    enabled: true | false
  ): Promise<TReqraftFetchResponse<QorusServiceEnableCallResponse[]>> => {
    if (get().hasPermissions(SERVICES_ACTIONS_PERMISSIONS.toggleEnabled)) {
      console.log({ ids, enabled });
      return query({
        method: 'PUT',
        url: `${FEATURES_API_URL.services}?action=${enabled ? 'enable' : 'disable'}`,
        body: { ids: ids.join(',') },
        cache: false,
      });
    }

    return Promise.reject({
      ok: false,
      error: 'Permission denied',
      data: 'Insufficient permissions to perform the action',
    });
  },

  toggleAutostartCall: (id: number, autostart: boolean) => {
    if (get().hasPermissions(SERVICES_ACTIONS_PERMISSIONS.toggleAutostart)) {
      return query({
        method: 'PUT',
        url: `${FEATURES_API_URL.services}/${id}?action=setAutostart`,
        body: { autostart },
        cache: false,
      });
    }

    return Promise.reject({
      ok: false,
      error: 'Permission denied',
      data: 'Insufficient permissions to perform the action',
    } as TReqraftFetchResponse<unknown>);
  },

  toggleLoadedCall: (ids: number[], loaded: boolean) => {
    if (
      !get().hasPermissions(
        loaded ? SERVICES_ACTIONS_PERMISSIONS.load : SERVICES_ACTIONS_PERMISSIONS.unload
      )
    ) {
      return Promise.reject({
        ok: false,
        error: 'Permission denied',
        data: 'Insufficient permissions to perform the action',
      } as TReqraftFetchResponse<unknown>);
    }

    return query({
      method: 'PUT',
      url: `${FEATURES_API_URL.services}?action=${loaded ? 'load' : 'unload'}`,
      body: { loaded, ids: ids.join(',') },
      cache: false,
    });
  },

  toggleRemoteCall: (id: string | number) => {
    const service = get().itemById(id);
    const permissions = SERVICES_ACTIONS_PERMISSIONS.setRemote;

    if (!service || !get().hasPermissions(permissions)) {
      return Promise.reject({
        ok: false,
        error: 'Permission denied',
        data: 'Insufficient permissions to perform the action',
      } as TReqraftFetchResponse<unknown>);
    }

    return query({
      method: 'PUT',
      url: `${FEATURES_API_URL.services}/${id}?action=setRemote`,
      body: { remote: !service?.remote },
      cache: false,
    });
  },

  resetCall: (ids: number[]) => {
    const permissions = SERVICES_ACTIONS_PERMISSIONS.reset;

    if (!get().hasPermissions(permissions)) {
      return Promise.reject({
        ok: false,
        error: 'Permission denied',
        data: 'Insufficient permissions to perform the action',
      } as TReqraftFetchResponse<unknown>);
    }

    return query({
      method: 'PUT',
      url: `${FEATURES_API_URL.services}?action=reset`,
      body: { ids: ids.join(',') },
      cache: false,
    });
  },
}));
