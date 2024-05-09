import { ReqoreContent, ReqoreLayoutContent, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { ReqraftProvider } from '../src';

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
  (Story, context) => (
    <ReqoreUIProvider
      options={{
        animations: {
          buttons: false,
          dialogs: false,
        },
        ...context.args?.reqoreOptions,
      }}
    >
      <ReqraftProvider
        instanceToken={process.env.REACT_APP_QORUS_TOKEN}
        instance='https://hq.qoretechnologies.com:8092/'
      >
        <ReqoreLayoutContent style={{ height: '100%' }}>
          <ReqoreContent style={{ padding: '20px', display: 'flex', flexFlow: 'column' }}>
            <Story />
          </ReqoreContent>
        </ReqoreLayoutContent>
      </ReqraftProvider>
    </ReqoreUIProvider>
  ),
];
