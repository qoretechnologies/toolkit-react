import { ReqoreSpinner, ReqoreTree } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react';
import { testsWaitForText } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { useFetch } from './useFetch';

const meta = {
  title: 'Hooks/useFetch',
  render: (args) => {
    const {
      data = {},
      load,
      loading,
    } = useFetch<any>({ url: 'public/info', method: args.method, loadOnMount: true });

    return loading ?
        <ReqoreSpinner />
      : <ReqoreTree data={data} bottomActions={[{ label: 'Refetch', onClick: load }]} />;
  },
} as StoryMeta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const get: Story = {
  args: {
    method: 'GET',
  },
  parameters: {
    mockData: [
      {
        // An array of mock objects which will add in every story
        url: 'https://hq.qoretechnologies.com:8092/api/latest/public/info',
        method: 'GET',
        status: 200,
        delay: 200,
        response: {
          'instance-key': 'rippy-dev1',
          'omq-version': '6.1.0_prod',
          'omq-build': 'd115c45fbed95c03327aea880be455137e9778ba',
          'qore-version': '2.0.0',
          'omq-schema': 'omq@omq',
          edition: 'Enterprise',
          tz_region: 'Europe/Prague',
          tz_utc_offset: 3600,
          noauth: false,
        },
      },
    ],
  },
  play: async () => {
    await testsWaitForText('"rippy-dev1"');
  },
};

export const put: Story = {
  args: {
    method: 'PUT',
  },
  parameters: {
    mockData: [
      {
        // An array of mock objects which will add in every story
        url: 'https://hq.qoretechnologies.com:8092/api/latest/public/info',
        method: 'PUT',
        status: 200,
        response: {
          status: 'Successfuly updated',
        },
      },
    ],
  },
  play: async () => {
    await testsWaitForText('"Successfuly updated"');
  },
};

export const post: Story = {
  args: {
    method: 'POST',
  },
  parameters: {
    mockData: [
      {
        // An array of mock objects which will add in every story
        url: 'https://hq.qoretechnologies.com:8092/api/latest/public/info',
        method: 'POST',
        status: 200,
        response: {
          status: 'Successfuly created',
        },
      },
    ],
  },
  play: async () => {
    await testsWaitForText('"Successfuly created"');
  },
};

export const del: Story = {
  args: {
    method: 'DELETE',
  },
  parameters: {
    mockData: [
      {
        // An array of mock objects which will add in every story
        url: 'https://hq.qoretechnologies.com:8092/api/latest/public/info',
        method: 'DELETE',
        status: 200,
        response: {
          status: 'Successfuly deleted',
        },
      },
    ],
  },
  play: async () => {
    await testsWaitForText('"Successfuly deleted"');
  },
};
