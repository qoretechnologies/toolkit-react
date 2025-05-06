import { QorusAlert } from '@qoretechnologies/ts-toolkit';
import { QorusServiceApiEvent } from './services/events';

export interface QorusBaseApiEvent {
  class: number;
  classstr: string;
  compositeseverity: number;
  compositeseveritystr: string;
  event: number;
  id: number;
  severity: number;
  severitystr: string;
  time: string;
  timeus: number;
}

export interface QorusGlobalAlertRaisedEvent extends QorusBaseApiEvent {
  eventstr: typeof QorusGlobalEvents.AlertRaised;
  info: QorusAlert;
}

export interface QorusGlobalAlertClearedEvent extends QorusBaseApiEvent {
  eventstr: typeof QorusGlobalEvents.AlertCleared;
  info: QorusAlert;
}

export type QorusAlertApiEvent = QorusGlobalAlertRaisedEvent | QorusGlobalAlertClearedEvent;

export type QorusApiEvent = QorusServiceApiEvent | QorusAlertApiEvent;

export const QorusGlobalEvents = {
  AlertRaised: 'ALERT_ONGOING_RAISED',
  AlertCleared: 'ALERT_ONGOING_CLEARED',
} as const;
