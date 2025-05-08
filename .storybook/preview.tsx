import withMockdate from '@netsells/storybook-mockdate';
import { ReqoreContent, ReqoreLayoutContent, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { Client, Server } from 'mock-socket';
import { initializeReqraft } from '../src';

export const parameters = {
  mockAddonConfigs: {
    ignoreQueryParams: true,
    globalMockData: [],
  },
  actions: { argTypesRegex: '^on[A-Z].*' },
  layout: 'fullscreen',
  options: {
    panelPosition: 'right',
    sidebar: {
      showRoots: true,
    },
  },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
    expanded: true,
  },
  chromatic: {
    pauseAnimationAtEnd: true,
    viewports: [1440],
  },
};

export const argTypes = {
  mainTheme: {
    control: 'color',
    description: 'The overall theme for all ReQore components',
    name: 'Main Theme',
    defaultValue: '#333333',
    table: {
      type: {
        summary: 'hex color of 6 characters',
      },
      defaultValue: { summary: '#333333' },
    },
  },
};

export let ApiEventsWebSocket: Client;

const url = `wss://hq.qoretechnologies.com:8092/apievents?token=${process.env.REACT_APP_QORUS_TOKEN}`;
let server = new Server(url);

server.on('connection', (socket) => {
  ApiEventsWebSocket = socket;

  socket.on('message', (data) => {
    if (data === 'ping') {
      socket.send('pong');
      return;
    }
  });
});

export const decorators = [
  withMockdate,
  (Story, context) => {
    const Reqraft = initializeReqraft({
      instance: 'https://hq.qoretechnologies.com:8092/',
      instanceToken: process.env.REACT_APP_QORUS_TOKEN,
    });

    return (
      <ReqoreUIProvider
        options={{
          animations: {
            buttons: false,
            dialogs: false,
          },
          ...context.args?.reqoreOptions,
        }}
      >
        <Reqraft appName='storybook' waitForStorage={false} {...context.args.reqraftOptions}>
          <ReqoreLayoutContent style={{ height: '100%' }}>
            <ReqoreContent style={{ padding: '20px', display: 'flex', flexFlow: 'column' }}>
              <Story />
            </ReqoreContent>
          </ReqoreLayoutContent>
        </Reqraft>
      </ReqoreUIProvider>
    );
  },
];
