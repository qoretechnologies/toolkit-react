import { ReqoreControlGroup, ReqoreP, ReqorePanel } from '@qoretechnologies/reqore';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
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
      {args.includeLogMessagesInState || args.useState ? (
        <ReqoreControlGroup vertical>
          {messages.map(({ message }, index) => (
            <ReqoreP key={index}>{message}</ReqoreP>
          ))}
        </ReqoreControlGroup>
      ) : null}
    </ReqorePanel>
  );
};

const meta = {
  title: 'Hooks/useWebSocket',
  async beforeEach({ parameters }: { parameters: Record<string, any> }) {
    const url = `wss://hq.qoretechnologies.com:8092/log-test?token=${process.env.REACT_APP_QORUS_TOKEN}`;
    let server = new Server(url);
    let killTimeout: NodeJS.Timeout;
    /** Set while the server is dead: every connection that lands is closed. */
    let killed = false;

    server.on('connection', (socket) => {
      if (killed) {
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
          killed = true;

          // Whether a killed server ever comes back is the story's choice, not
          // a timer's. `Reconnects` needs it back to prove the socket recovers;
          // `ReconnectFails` needs it gone for good to prove the socket gives
          // up. Reviving on a fixed delay made the second one a race: it wins
          // only if three attempts finish inside those three seconds, and each
          // attempt first awaits an HTTP probe whose latency on CI is unbounded.
          // When the probes ran slow the third attempt landed after the revival
          // and CONNECTED, so `onReconnectFailed` never fired and the story
          // failed — on CI only, and only sometimes.
          if (parameters.killedServerReturns === false) {
            return;
          }

          killTimeout = setTimeout(() => {
            server = new Server(url);
            killTimeout = null;
            killed = false;
          }, 3000);

          return;
        }

        socket.send(`Received message: ${data}`);
      });
    });

    return () => {
      killTimeout && clearTimeout(killTimeout);
      killTimeout = null;
      killed = false;
      server.close({
        code: 4999,
        reason: 'Test ended',
        wasClean: true,
      });
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
    jest: {
      timeout: 60000,
    },
  },
  render: (args) => {
    return <CompWithHook {...args} />;
  },
} as StoryMeta<any, IUseReqraftWebSocketOptions>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the useReqraftWebSocket demo with no lifecycle options — the socket stays CLOSED until the operator clicks Connect.',
      },
    },
  },
};
export const OpenManually: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the useReqraftWebSocket demo and clicks the Connect action — the socket opens and the onOpen callback fires.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the useReqraftWebSocket demo with openOnMount enabled — the socket opens immediately after mount without any user action.',
      },
    },
  },
  play: async ({ args }) => {
    await testsWaitForText('Websocket Status: OPEN');
    await expect(args.onOpen).toHaveBeenCalled();
  },
};

export const CloseManually: Story = {
  ...OpenOnMount,
  parameters: {
    ...OpenOnMount.parameters,
    docs: {
      description: {
        story:
          'Renders the useReqraftWebSocket demo opened on mount. When Disconnect is clicked, the socket transitions to CLOSED and the onClose callback fires.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the useReqraftWebSocket demo with reconnect enabled. When the server is killed, the socket transitions to CONNECTING and then back to OPEN once the server returns.',
      },
    },
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
  parameters: {
    killedServerReturns: false,
    // The server stays dead, so exhausting the attempts is the only outcome
    // available no matter how long each one takes.
    docs: {
      description: {
        story:
          'Renders the useReqraftWebSocket demo with a low maxReconnectTries. When the server never returns, the socket exhausts its reconnect attempts and fires onReconnectFailed.',
      },
    },
    jest: {
      timeout: 60000,
    },
  },
  play: async ({ args, ...rest }) => {
    await OpenOnMount.play({ args, ...rest });
    await testsClickButton({ label: 'Kill' });
    await testsWaitForText('Websocket Status: CONNECTING');
    await expect(args.onReconnecting).toHaveBeenCalled();
    await waitFor(() => expect(args.onReconnectFailed).toHaveBeenCalled(), { timeout: 20000 });
  },
};

export const SendMessage: Story = {
  args: {
    ...OpenOnMount.args,
    includeSentMessagesInState: true,
    useState: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the useReqraftWebSocket demo with useState enabled. When Send is clicked, the message is dispatched and the echoed reply appears in the accumulated message list.',
      },
    },
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
    reconnectInterval: 1500,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the useReqraftWebSocket demo with includeLogMessagesInState. Connect / disconnect / reconnect lifecycle events are captured as log entries alongside regular messages.',
      },
    },
  },
  play: async ({ args, ...rest }) => {
    await Reconnects.play({ args, ...rest });

    await testsWaitForText('Connection opened');
  },
};

export const ClearsMessages: Story = {
  ...SendMessage,
  parameters: {
    ...SendMessage.parameters,
    docs: {
      description: {
        story:
          'Renders the useReqraftWebSocket demo after sending a message. When Clear is clicked, the accumulated message list is emptied.',
      },
    },
  },
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
      {args.includeLogMessagesInState || args.useState ? (
        <ReqoreControlGroup vertical>
          {messages.map(({ message }, index) => (
            <ReqoreP key={index}>{message}</ReqoreP>
          ))}
        </ReqoreControlGroup>
      ) : null}
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
      {args.includeLogMessagesInState || args.useState ? (
        <ReqoreControlGroup vertical>
          {messages.map(({ message }, index) => (
            <ReqoreP key={index}>{message}</ReqoreP>
          ))}
        </ReqoreControlGroup>
      ) : null}
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
        status === 'CLOSED'
          ? 'danger'
          : status === 'CONNECTING'
          ? 'pending'
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
      {args.includeLogMessagesInState || args.useState ? (
        <ReqoreControlGroup vertical>
          {messages.map(({ message }, index) => (
            <ReqoreP key={index}>{message}</ReqoreP>
          ))}
        </ReqoreControlGroup>
      ) : null}
    </ReqorePanel>
  );
};

export const MultipleConnections: Story = {
  args: {
    includeLogMessagesInState: true,
    useState: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders three panels that each call useReqraftWebSocket against the same URL — proves the connections share one pooled underlying WebSocket while keeping independent message state.',
      },
    },
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
  parameters: {
    ...MultipleConnections.parameters,
    docs: {
      description: {
        story:
          'Renders three pooled useReqraftWebSocket panels with openOnMount — all three transition to OPEN over the shared underlying socket without any user action.',
      },
    },
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
  parameters: {
    ...MultipleConnections.parameters,
    docs: {
      description: {
        story:
          'Renders three pooled useReqraftWebSocket panels. When Close All closes the shared socket, every consumer transitions to CLOSED at once and each panel logs its close handler.',
      },
    },
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
  parameters: {
    ...MultipleConnections.parameters,
    docs: {
      description: {
        story:
          'Renders three pooled useReqraftWebSocket panels. Closing them one by one keeps the shared socket OPEN until the last consumer unmounts, then it closes.',
      },
    },
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
  parameters: {
    ...MultipleConnections.parameters,
    docs: {
      description: {
        story:
          'Renders three pooled useReqraftWebSocket panels. Each panel attaches its own message handler, and sending a message triggers the handlers of only the connections still open.',
      },
    },
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
  parameters: {
    ...MultipleConnectionsHaveCustomHandlers.parameters,
    docs: {
      description: {
        story:
          'Renders three pooled useReqraftWebSocket panels after custom handlers have fired. Disconnecting one and reconnecting another proves individual consumers can toggle without disturbing peers.',
      },
    },
  },
  play: async (args) => {
    await MultipleConnectionsHaveCustomHandlers.play(args);

    await testsClickButton({ label: 'Disconnect', nth: 1 });
    await testsClickButton({ label: 'Connect', nth: 2 });

    await testsWaitForText('Second Connection Status: CLOSED');
    await testsWaitForText('Third Connection Status: OPEN');
  },
};
