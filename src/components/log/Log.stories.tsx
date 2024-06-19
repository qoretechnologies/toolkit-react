import { StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Server } from 'mock-socket';
import { testsWaitForText } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { ReqraftLog } from './Log';

const meta = {
  component: ReqraftLog,
  title: 'Components/Log',
  args: {
    url: 'log-test',
    label: 'Testing Log',
    socketOptions: {
      openOnMount: true,
      closeOnUnmount: true,
    },
    onConnect: fn(),
    onMessage: fn(),
    onDisconnect: fn(),
    onConnectionError: fn(),
  },
  async beforeEach() {
    const url = `wss://hq.qoretechnologies.com:8092/log-test?token=${process.env.REACT_APP_QORUS_TOKEN}`;
    let server = new Server(url);
    let killTimeout: NodeJS.Timeout;
    let fakeInterval: NodeJS.Timeout;
    const fakeMessages = [
      'This is a message',
      'WARNING: This is a warning message',
      'This is another message',
      'This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature,',
      'ERROR: This is an error message',
      'This is a new message',
      'THIS IS A MESSAGE IN ALL CAPS',
      'This is a message with a link: https://www.qoretechnologies.com',
    ];
    let fakeMessageIndex = 0;

    server.on('connection', (socket) => {
      if (killTimeout) {
        server.close();
        return;
      }

      fakeInterval = setInterval(() => {
        socket.send(fakeMessages[fakeMessageIndex]);
        fakeMessageIndex = (fakeMessageIndex + 1) % fakeMessages.length;

        if (fakeMessageIndex === 0) {
          clearInterval(fakeInterval);
          fakeInterval = null;
        }
      }, 100);

      socket.on('message', (data) => {
        if (data === 'ping') {
          socket.send('pong');
          return;
        }

        if (data === 'kill') {
          server.close();

          killTimeout = setTimeout(() => {
            server = new Server(url);
            killTimeout = null;
          }, 3000);

          return;
        }

        socket.send(`Received message: ${data}`);
      });
    });

    return () => {
      killTimeout && clearTimeout(killTimeout);
      killTimeout = null;
      fakeInterval && clearInterval(fakeInterval);
      fakeInterval = null;
      fakeMessageIndex = 0;

      server.close();
    };
  },
} as StoryMeta<typeof ReqraftLog>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  play: async () => {
    await testsWaitForText('This is a message with a link: https://www.qoretechnologies.com');
  },
};

export const Filterable: Story = {
  ...Basic,
  args: {
    filterable: true,
  },
};
