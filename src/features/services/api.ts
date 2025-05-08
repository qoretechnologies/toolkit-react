import { QorusService } from '@qoretechnologies/ts-toolkit';

export interface QorusServiceEnableCallResponse {
  arg: string;
  enabled?: boolean;
  disabled?: boolean;
  info: string;
  name: string;
  serviceid: number;
  type: QorusService['type'];
  version: string;
}
