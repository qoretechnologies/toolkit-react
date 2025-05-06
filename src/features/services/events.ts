import { QorusService } from '@qoretechnologies/ts-toolkit';
import { QorusBaseApiEvent, QorusGlobalAlertClearedEvent } from '../events';

export const QorusServiceEvents = {
  ENABLE_TOGGLE: 'GROUP_STATUS_CHANGED',
  UPDATED: 'SERVICE_UPDATED',
  START: 'SERVICE_START',
  STOP: 'SERVICE_STOP',
} as const;

export interface QorusServiceEnableEventInfo extends QorusBaseApiEvent {
  eventstr: typeof QorusServiceEvents.ENABLE_TOGGLE;
  info: { id: number; enabled: boolean; name: string; synthetic: boolean; type: 'service' };
}

export interface QorusServiceUpdatedEventInfo extends QorusBaseApiEvent {
  eventstr: typeof QorusServiceEvents.UPDATED;
  info: {
    name: string;
    version: string;
    type: 'system' | 'user';
    serviceid: number;
    info: QorusService;
  };
}

export interface QorusServiceStartEventInfo extends QorusBaseApiEvent {
  eventstr: typeof QorusServiceEvents.START;
  info: {
    name: string;
    version: string;
    type: 'system' | 'user';
    serviceid: number;
  };
}

export interface QorusServiceStopEventInfo extends QorusBaseApiEvent {
  eventstr: typeof QorusServiceEvents.STOP;
  info: {
    name: string;
    version: string;
    type: 'system' | 'user';
    serviceid: number;
  };
}

export type QorusServiceApiEvent =
  | QorusServiceEnableEventInfo
  | QorusServiceUpdatedEventInfo
  | QorusServiceStartEventInfo
  | QorusServiceStopEventInfo
  | QorusGlobalAlertClearedEvent;
