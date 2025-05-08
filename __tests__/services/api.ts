import { QorusService } from '@qoretechnologies/ts-toolkit';
import { size } from 'lodash';
import { QorusServiceEnableCallResponse } from '../../src/features/services/api';
import { QorusServiceEnableEventInfo } from '../../src/features/services/events';
import { ServicesSocket } from '../../src/features/services/Services.stories';
import { MockServicesData } from './data';

export const GetServices = {
  url: 'https://hq.qoretechnologies.com:8092/api/latest/services/',
  method: 'GET',
  status: 200,
  response: MockServicesData,
};

export const ToggleEnableServices = {
  url: 'https://hq.qoretechnologies.com:8092/api/latest/services/',
  method: 'PUT',
  status: 200,
  response: (request) => {
    const { searchParams, body } = request;
    const { ids } = JSON.parse(body);
    const affectedServices = MockServicesData.filter((service) => ids.includes(service.serviceid));

    const action = searchParams.action;
    const key = action === 'enable' ? 'enabled' : 'disabled';

    const getResponseData = (service: QorusService): Partial<QorusServiceEnableCallResponse> =>
      action === 'enable'
        ? {
            info: size(service.alerts)
              ? `Service ${service.serviceid} was NOT enabled`
              : `Service ${service.serviceid} enabled`,
            [key]: size(service.alerts) ? false : true,
          }
        : {
            info: `Service ${service.serviceid} was disabled`,
            [key]: true,
          };

    const responseEvents: Partial<QorusServiceEnableEventInfo>[] = affectedServices
      .filter((service) => service.serviceid !== 3)
      .map((service) => ({
        eventstr: 'GROUP_STATUS_CHANGED',
        info: {
          id: service.serviceid,
          enabled: action === 'enable' ? (size(service.alerts) ? false : true) : false,
          name: service.name,
          synthetic: false,
          type: 'service',
        },
      }));

    ServicesSocket.send(JSON.stringify(responseEvents));

    return affectedServices.map((service) => ({
      arg: 'any',
      serviceid: service.serviceid,
      name: service.name,
      type: service.type,
      version: service.version,
      ...getResponseData(service),
    })) as QorusServiceEnableCallResponse[];
  },
};
