import { StoryObj } from '@storybook/react';
import { expect, fireEvent, fn } from '@storybook/test';
import { Server } from 'mock-socket';
import { sleep, testsClickButton, testsWaitForText } from '../../../__tests__/utils';
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
  parameters: {
    mockdate: new Date('2024-01-01T08:00:00.000Z'),
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
  play: async (args) => {
    await Basic.play(args);
    await fireEvent.change(document.querySelector('.reqore-input'), { target: { value: 'error' } });
    await expect(document.querySelectorAll('.reqraft-log-message')).toHaveLength(1);
  },
};

export const WithTimestamps: Story = {
  ...Basic,
  args: {
    showTimestamps: true,
  },
};

export const WithDefaultMessages: Story = {
  ...Basic,
  args: {
    showTimestamps: true,
    defaultMessages: [
      { message: 'This is a default message', timestamp: '08:00:00.000' },
      { message: 'This is another default message', timestamp: '08:00:00.000' },
    ],
  },
};

export const WithCopyableMessages: Story = {
  ...Basic,
  args: {
    allowMessageCopy: true,
  },
  play: async (args) => {
    await Basic.play(args);
  },
};

export const WithDeletableMessages: Story = {
  ...Basic,
  args: {
    allowMessageCopy: true,
    allowMessageDeletion: true,
  },
  play: async (args) => {
    await Basic.play(args);
    await testsClickButton({ selector: '.reqraft-log-delete-message', nth: 4 });
  },
};

export const Pause: Story = {
  ...Basic,
  args: {
    allowMessageDeletion: true,
  },
  play: async () => {
    await testsWaitForText('This is another message');
    await testsClickButton({ selector: '.reqraft-log-pause-resume' });
  },
};

export const Clear: Story = {
  ...Basic,
  args: {
    allowMessageDeletion: true,
  },
  play: async (args) => {
    await Basic.play(args);
    await testsClickButton({ selector: '.reqraft-log-clear' });
    await testsWaitForText('No messages');
  },
};

export const FormattedMessages: Story = {
  ...Basic,
  args: {
    messageFormatter: ({ message, ...rest }) => {
      if (message.includes('WARNING')) {
        return { message, intent: 'warning' };
      }

      if (message.includes('ERROR')) {
        return { message, intent: 'danger' };
      }

      if (message.includes('ALL CAPS')) {
        return { message, intent: 'info' };
      }

      return { message, ...rest };
    },
  },
  play: async (args) => {
    await Basic.play(args);
  },
};

export const CanSendMessages: Story = {
  ...Basic,
  args: {
    canSendMessages: true,
    showTimestamps: true,
  },
  play: async (args) => {
    await Basic.play(args);
  },
};

export const WithAutoScroll: Story = {
  ...Basic,
  args: {
    autoScroll: true,
    style: { height: '200px' },
  },
  play: async (args) => {
    await Basic.play(args);
  },
};

export const WithAutoScrollAndManualScroll: Story = {
  ...WithAutoScroll,
  args: {
    autoScroll: true,
    style: { height: '200px' },
  },
  play: async (args) => {
    await WithAutoScroll.play(args);
    await fireEvent.scroll(document.querySelector('.reqore-panel-content'), {
      target: { scrollTop: 100 },
    });
    await sleep(100);
  },
};
