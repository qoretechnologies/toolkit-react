import { QorusService } from '@qoretechnologies/ts-toolkit';
import { size } from 'lodash';
import { ApiEventsWebSocket } from '../../.storybook/preview';
import { QorusServiceEnableCallResponse } from '../../src/features/services/api';
import { QorusServiceEnableEventInfo } from '../../src/features/services/events';
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

    const getResponseData = (service: QorusService) => {
      switch (action) {
        case 'enable':
          return {
            info: size(service.alerts)
              ? `Service ${service.serviceid} was NOT enabled`
              : `Service ${service.serviceid} enabled`,
            enabled: size(service.alerts) ? false : true,
          } satisfies Partial<QorusServiceEnableCallResponse>;
        case 'disable':
          return {
            info: `Service ${service.serviceid} was disabled`,
            disabled: true,
          } satisfies Partial<QorusServiceEnableCallResponse>;
      }
    };

    let responseEvents: unknown;
    let result: unknown;

    switch (action) {
      case 'enable':
      case 'disable': {
        responseEvents = affectedServices
          .filter((service) => (action === 'enable' ? !size(service.alerts) : true))
          .map((service) => ({
            eventstr: 'GROUP_STATUS_CHANGED',
            info: {
              id: service.serviceid,
              enabled: action === 'enable' ? (size(service.alerts) ? false : true) : false,
              name: service.name,
              synthetic: false,
              type: 'service',
            },
          })) satisfies Partial<QorusServiceEnableEventInfo>[];

        result = affectedServices.map((service) => ({
          arg: 'any',
          serviceid: service.serviceid,
          name: service.name,
          type: service.type,
          version: service.version,
          ...getResponseData(service),
        })) satisfies QorusServiceEnableCallResponse[];

        break;
      }
    }

    // Send events to the WebSocket
    ApiEventsWebSocket.send(JSON.stringify(responseEvents));

    // Return the result (this is a 200 response with the data)
    return result;
  },
};
