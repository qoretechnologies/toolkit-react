import withMockdate from '@netsells/storybook-mockdate';
import {
  ReqoreContent,
  ReqoreLayoutContent,
  ReqoreModalsWrapper,
  ReqoreUIProvider,
} from '@qoretechnologies/reqore';
import { initializeReqraft } from '../src';
import { fetchConfig } from '../src/utils/fetch';

export const parameters = {
  // No `actions.argTypesRegex` (removed in SB10): stories that assert on
  // handlers define explicit `fn()` spies from `storybook/test` instead.
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
    // A live story hitting Qorus without a valid token gets a 401, which
    // Reqraft answers by navigating window.location to `/?next=…`. Inside the
    // preview iframe that loads the Storybook MANAGER into the canvas, whose own
    // canvas reloads /iframe.html → 401 → redirect → Storybook-in-Storybook
    // recursion. Clear the redirect so a 401 stays a failed request here.
    fetchConfig.unauthorizedRedirect = undefined;

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
          {/* Renders reqore's global modal queue (modalStore.addModal) — apps
              mount this at their root (see qorus-ide providers/Interfaces);
              without it, anything using the queue (e.g. the template picker's
              full example-value modal) enqueues into the void in stories. */}
          <ReqoreModalsWrapper />
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
