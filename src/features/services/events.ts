export interface QorusServiceEnableEventInfo {
  id: number;
  enabled: boolean;
  name: string;
  synthetic: boolean;
  type: 'service';
}

export type QorusServiceEvent = QorusServiceEnableEventInfo;

export const SERVICE_ENABLE_TOGGLE_EVENT = 'GROUP_STATUS_CHANGED';
