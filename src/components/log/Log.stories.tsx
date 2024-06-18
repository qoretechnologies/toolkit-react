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

    server.on('connection', (socket) => {
      if (killTimeout) {
        server.close();
        return;
      }

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
      server.close();
    };
  },
} as StoryMeta<typeof ReqraftLog>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  play: async () => {
    await testsWaitForText('Connection opened');
  },
};
