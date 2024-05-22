import { set } from 'lodash';

export const storiesStorageMockEmpty = [
  {
    url: 'https://hq.qoretechnologies.com:8092/api/latest/users/_current_/storage',
    method: 'GET',
    status: 200,
    response: {},
  },
];

export const storiesStorageMock = [
  {
    url: 'https://hq.qoretechnologies.com:8092/api/latest/users/_current_/storage',
    method: 'GET',
    status: 200,
    response: {
      'sidebar-size': 350,
      storybook: {
        'some-path': 'This is a storage value',
      },
    },
  },
  {
    url: 'https://hq.qoretechnologies.com:8092/api/latest/users/_current_/',
    method: 'PUT',
    status: 200,
    response: (request) => {
      const body = JSON.parse(request.body);

      if (body.storage_path && !body.value) {
        body.storage = {
          'sidebar-size': 350,
          storybook: {
            'some-path': 'This is a NEW value',
          },
        };
        set(body.storage, body.storage_path, null);
      }

      return body.storage;
    },
  },
];
