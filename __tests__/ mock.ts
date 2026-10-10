import { set } from 'lodash';
import { storyApiUrl } from '../src/stories/storyNetwork';

// Built from the configured instance (storyApiUrl), as every story mock is: a URL written for one host stopped
// matching when the stories ran against another, and the request went to that instance instead.

export const storiesStorageMockEmpty = [
  {
    url: storyApiUrl('users?action=current'),
    method: 'GET',
    status: 200,
    response: {},
  },
];

export const storiesStorageMock = [
  {
    url: storyApiUrl('users?action=current'),
    method: 'GET',
    status: 200,
    response: {
      storage: {
        'sidebar-size': 350,
        storybook: {
          'some-path': 'This is a storage value',
        },
      },
    },
  },
  {
    url: storyApiUrl('users/_current_/'),
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
