import withMockdate from '@netsells/storybook-mockdate';
import { ReqoreContent, ReqoreLayoutContent, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { initializeReqraft } from '../src';

export const parameters = {
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

export const decorators = [
  withMockdate,
  (Story, context) => {
    // Live stories (`parameters: { live: true }`) hit this instance. Override
    // it to point at your own Qorus for live data, e.g.
    //   REACT_APP_QORUS_INSTANCE=https://localhost:8012/ \
    //   REACT_APP_QORUS_TOKEN=<token> yarn storybook
    // (the instance must allow the storybook origin via CORS).
    const Reqraft = initializeReqraft({
      instance: process.env.REACT_APP_QORUS_INSTANCE || 'https://hq.qoretechnologies.com:8092/',
      instanceToken: process.env.REACT_APP_QORUS_TOKEN,
    });

    return (
      <ReqoreUIProvider
        theme={{
          main: '#121212',
          intents: {
            success: '#4a7110',
            custom1: '#762f7e',
            custom2: '#b34e1d',
          },
        }}
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
