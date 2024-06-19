import { ReqoreControlGroup, ReqoreP, ReqorePanel } from '@qoretechnologies/reqore';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { StoryObj } from '@storybook/react';
import { expect, fn, waitFor, within } from '@storybook/test';
import { Server } from 'mock-socket';
import { useEffect, useState } from 'react';
import { useMount } from 'react-use';
import { sleep, testsClickButton, testsWaitForText } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { ReqraftWebSocketsManager } from '../../utils/websocket';
import { IUseReqraftWebSocketOptions, useReqraftWebSocket } from './useWebSocket';

const CompWithHook = (args: IUseReqraftWebSocketOptions) => {
  const { status, open, close, send, messages, clear } = useReqraftWebSocket(args);

  return (
    <ReqorePanel
      minimal
      size='small'
      label={`Websocket Status: ${status}`}
      actions={[
        { label: 'Connect', icon: 'PlayLine', onClick: open },
        { label: 'Disconnect', icon: 'StopLine', onClick: close },
        { label: 'Clear', icon: 'CloseLine', onClick: clear },
        { label: 'Kill', icon: 'CloseLine', onClick: () => send('kill') },
        { label: 'Send', icon: 'MessageLine', onClick: () => send('This is a test message') },
      ]}
    >
      {args.includeLogMessagesInState || args.useState ?
        <ReqoreControlGroup vertical>
          {messages.map(({ message }, index) => (
            <ReqoreP key={index}>{message}</ReqoreP>
          ))}
        </ReqoreControlGroup>
      : null}
    </ReqorePanel>
  );
};

const meta = {
  title: 'Hooks/useWebSocket',
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
  args: {
    onOpen: fn(),
    onMessage: fn(),
    onClose: fn(),
    onReconnecting: fn(),
    onError: fn(),
    onReconnectFailed: fn(),
    reconnect: false,
    closeOnUnmount: true,
    url: 'log-test',
  },
  parameters: {
    chromatic: { disable: true },
  },
  render: (args) => {
    return <CompWithHook {...args} />;
  },
} as StoryMeta<any, IUseReqraftWebSocketOptions>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OpenManually: Story = {
  play: async ({ args }) => {
    await testsClickButton({ label: 'Connect' });
    await testsWaitForText('Websocket Status: OPEN');
    await expect(args.onOpen).toHaveBeenCalled();
  },
};
export const OpenOnMount: Story = {
  args: {
    openOnMount: true,
  },
  play: async ({ args }) => {
    await testsWaitForText('Websocket Status: OPEN');
    await expect(args.onOpen).toHaveBeenCalled();
  },
};

export const CloseManually: Story = {
  ...OpenOnMount,
  play: async ({ args, ...rest }) => {
    await OpenOnMount.play({ args, ...rest });
    await testsClickButton({ label: 'Disconnect' });
    await testsWaitForText('Websocket Status: CLOSED');
    await sleep(300);
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const Reconnects: Story = {
  args: {
    reconnect: true,
    maxReconnectTries: 5,
    openOnMount: true,
  },
  play: async ({ args, ...rest }) => {
    await OpenOnMount.play({ args, ...rest });
    await testsClickButton({ label: 'Kill' });
    await testsWaitForText('Websocket Status: CONNECTING');
    await expect(args.onReconnecting).toHaveBeenCalled();
    await testsWaitForText('Websocket Status: OPEN');
    await expect(args.onOpen).toHaveBeenCalled();
  },
};

export const ReconnectFails: Story = {
  args: {
    reconnect: true,
    maxReconnectTries: 3,
    openOnMount: true,
    reconnectInterval: 500,
  },
  play: async ({ args, ...rest }) => {
    await OpenOnMount.play({ args, ...rest });
    await testsClickButton({ label: 'Kill' });
    await testsWaitForText('Websocket Status: CONNECTING');
    await expect(args.onReconnecting).toHaveBeenCalled();
    await testsWaitForText('Websocket Status: CLOSED');
    await waitFor(() => expect(args.onReconnectFailed).toHaveBeenCalled(), { timeout: 10000 });
  },
};

export const SendMessage: Story = {
  args: {
    ...OpenOnMount.args,
    includeSentMessagesInState: true,
    useState: true,
  },
  play: async ({ args, ...rest }) => {
    await OpenOnMount.play({ args, ...rest });
    await testsClickButton({ label: 'Send' });

    await sleep(300);

    await expect(args.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'Received message: This is a test message' })
    );
  },
};

export const WithLogs: Story = {
  args: {
    ...Reconnects.args,
    includeLogMessagesInState: true,
    useState: true,
    reconnectInterval: 500,
  },
  play: async ({ args, ...rest }) => {
    await Reconnects.play({ args, ...rest });

    await testsWaitForText('Reconnecting... Attempt 4');
    await testsWaitForText('Connection opened');
  },
};

export const ClearsMessages: Story = {
  ...SendMessage,
  play: async ({ args, ...rest }) => {
    await SendMessage.play({ args, ...rest });
    await testsClickButton({ label: 'Clear' });
    await sleep(300);
  },
};

interface IConnectionProps extends IUseReqraftWebSocketOptions {
  onPanelClose?: () => void;
}

const ConnectionOne = ({ onPanelClose, ...args }: IConnectionProps) => {
  const { status, open, close, send, messages, clear, on, addMessage } = useReqraftWebSocket({
    ...args,
  });

  useEffect(() => {
    if (status === 'OPEN') {
      on('message', () => {
        addMessage('I HAVE JUST RECEIVED A MESSAGE HA!');
      });
    }
  }, [status]);

  return (
    <ReqorePanel
      minimal
      fluid
      onClose={onPanelClose}
      closeButtonProps={{
        className: 'close-button',
      }}
      size='small'
      label={`First Connection Status: ${status}`}
      actions={[
        { label: 'Connect', icon: 'PlayLine', onClick: open },
        { label: 'Disconnect', icon: 'StopLine', onClick: close },
        { label: 'Clear', icon: 'CloseLine', onClick: clear },
        { label: 'Kill', icon: 'CloseLine', onClick: () => send('kill') },
        { label: 'Send', icon: 'MessageLine', onClick: () => send('This is a test message') },
      ]}
    >
      {args.includeLogMessagesInState || args.useState ?
        <ReqoreControlGroup vertical>
          {messages.map(({ message }, index) => (
            <ReqoreP key={index}>{message}</ReqoreP>
          ))}
        </ReqoreControlGroup>
      : null}
    </ReqorePanel>
  );
};

const ConnectionTwo = ({ onPanelClose, ...args }: IConnectionProps) => {
  const { status, open, close, send, messages, clear, on, addMessage } = useReqraftWebSocket(args);

  useEffect(() => {
    if (status === 'OPEN') {
      on('close', () => {
        addMessage('Why did you close it?!');
      });
    }
  }, [status]);

  return (
    <ReqorePanel
      minimal
      fluid
      size='small'
      onClose={onPanelClose}
      closeButtonProps={{
        className: 'close-button',
      }}
      label={`Second Connection Status: ${status}`}
      actions={[
        { label: 'Connect', icon: 'PlayLine', onClick: open },
        { label: 'Disconnect', icon: 'StopLine', onClick: close },
        { label: 'Clear', icon: 'CloseLine', onClick: clear },
        { label: 'Kill', icon: 'CloseLine', onClick: () => send('kill') },
        { label: 'Send', icon: 'MessageLine', onClick: () => send('This is a test message') },
      ]}
    >
      {args.includeLogMessagesInState || args.useState ?
        <ReqoreControlGroup vertical>
          {messages.map(({ message }, index) => (
            <ReqoreP key={index}>{message}</ReqoreP>
          ))}
        </ReqoreControlGroup>
      : null}
    </ReqorePanel>
  );
};

const ConnectionThree = ({ onPanelClose, ...args }: IConnectionProps) => {
  const { status, open, close, send, messages, clear, on, addMessage } = useReqraftWebSocket({
    ...args,
  });

  useEffect(() => {
    if (status === 'OPEN') {
      on('message', () => {
        addMessage('I ALSO HAVE A CUSTOM HANDLER FOR MESSAGES!');
      });
    }
  }, [status]);

  return (
    <ReqorePanel
      minimal
      fluid
      intent={
        status === 'CLOSED' ? 'danger'
        : status === 'CONNECTING' ?
          'pending'
        : ('success' as TReqoreIntent)
      }
      size='small'
      closeButtonProps={{
        className: 'close-button',
      }}
      onClose={onPanelClose}
      label={`Third Connection Status: ${status}`}
      actions={[
        { label: 'Connect', icon: 'PlayLine', onClick: open },
        { label: 'Disconnect', icon: 'StopLine', onClick: close },
        { label: 'Clear', icon: 'CloseLine', onClick: clear },
        { label: 'Kill', icon: 'CloseLine', onClick: () => send('kill') },
        { label: 'Send', icon: 'MessageLine', onClick: () => send('This is a test message') },
      ]}
    >
      {args.includeLogMessagesInState || args.useState ?
        <ReqoreControlGroup vertical>
          {messages.map(({ message }, index) => (
            <ReqoreP key={index}>{message}</ReqoreP>
          ))}
        </ReqoreControlGroup>
      : null}
    </ReqorePanel>
  );
};

export const MultipleConnections: Story = {
  args: {
    includeLogMessagesInState: true,
    useState: true,
  },
  // @ts-expect-error customprops
  render: (args: IUseReqraftWebSocketOptions) => {
    const [conectionStatus, setConnectionStatus] = useState<string>('CLOSED');
    const [panels, setPanels] = useState({ 1: true, 2: true, 3: true });

    useMount(() => {
      setConnectionStatus(
        ReqraftWebSocketsManager.connections[args.url]?.socket ? 'OPEN' : 'CLOSED'
      );
    });

    useEffect(() => {
      setTimeout(() => {
        setConnectionStatus(
          ReqraftWebSocketsManager.connections[args.url]?.socket ? 'OPEN' : 'CLOSED'
        );
      }, 500);
    }, [panels]);

    const handlePanelClose = (panel: number) => {
      setPanels((prev) => ({ ...prev, [panel]: false }));
    };

    return (
      <ReqorePanel
        minimal
        flat
        size='small'
        label={`Multiple Connections: ${conectionStatus}`}
        actions={[
          {
            label: 'Close All',
            onClick: () => ReqraftWebSocketsManager.connections[args.url].socket.close(),
          },
        ]}
      >
        <ReqoreControlGroup vertical>
          {panels[1] && <ConnectionOne {...args} onPanelClose={() => handlePanelClose(1)} />}
          {panels[2] && <ConnectionTwo {...args} onPanelClose={() => handlePanelClose(2)} />}
          {panels[3] && <ConnectionThree {...args} onPanelClose={() => handlePanelClose(3)} />}
        </ReqoreControlGroup>
      </ReqorePanel>
    );
  },
};

export const MultipleConnectionsOpenOnMount: Story = {
  ...MultipleConnections,
  args: {
    ...MultipleConnections.args,
    openOnMount: true,
  },
  play: async ({ args }) => {
    await testsWaitForText('First Connection Status: OPEN');
    await testsWaitForText('Second Connection Status: OPEN');
    await testsWaitForText('Third Connection Status: OPEN');

    await expect(args.onOpen).toHaveBeenCalled();
  },
};

export const MultipleConnectionsClosedAtOnce: Story = {
  ...MultipleConnections,
  args: {
    ...MultipleConnections.args,
    openOnMount: true,
  },
  play: async (args) => {
    await MultipleConnectionsOpenOnMount.play(args);

    await testsClickButton({ label: 'Close All' });

    await testsWaitForText('Multiple Connections: CLOSED');
    await testsWaitForText('Why did you close it?!');
  },
};

export const ConnectionIsClosedWhenAllUsersAreClosed: Story = {
  ...MultipleConnections,
  args: {
    ...MultipleConnections.args,
    openOnMount: true,
  },
  play: async (args) => {
    await MultipleConnectionsOpenOnMount.play(args);

    await testsClickButton({ selector: '.close-button' });
    await testsWaitForText('Multiple Connections: OPEN');
    await testsClickButton({ selector: '.close-button' });
    await testsWaitForText('Multiple Connections: OPEN');
    await testsClickButton({ selector: '.close-button' });
    await testsWaitForText('Multiple Connections: CLOSED');
  },
};

export const MultipleConnectionsHaveCustomHandlers: Story = {
  ...MultipleConnections,
  args: {
    ...MultipleConnections.args,
    openOnMount: true,
  },
  play: async (args) => {
    const canvas = within(args.canvasElement);

    await MultipleConnectionsOpenOnMount.play(args);

    await testsClickButton({ label: 'Send' });

    await testsWaitForText('I HAVE JUST RECEIVED A MESSAGE HA!');
    await testsWaitForText('I ALSO HAVE A CUSTOM HANDLER FOR MESSAGES!');

    // Disconnect the 3rd connection
    await testsClickButton({ label: 'Disconnect', nth: 2 });
    await testsClickButton({ label: 'Send' });
    await testsClickButton({ label: 'Send' });

    await sleep(500);

    await expect(canvas.queryAllByText('I HAVE JUST RECEIVED A MESSAGE HA!')).toHaveLength(3);
    await expect(canvas.queryAllByText('I ALSO HAVE A CUSTOM HANDLER FOR MESSAGES!')).toHaveLength(
      1
    );
  },
};

export const MultipleConnectionsCanBeDisconnectedAndReconnected: Story = {
  ...MultipleConnectionsHaveCustomHandlers,
  play: async (args) => {
    await MultipleConnectionsHaveCustomHandlers.play(args);

    await testsClickButton({ label: 'Disconnect', nth: 1 });
    await testsClickButton({ label: 'Connect', nth: 2 });

    await testsWaitForText('Second Connection Status: CLOSED');
    await testsWaitForText('Third Connection Status: OPEN');
  },
};
