export default {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],

  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-webpack5-compiler-babel',
    '@chromatic-com/storybook',
    'storybook-addon-mock',
  ],

  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },

  features: {
    interactionsDebugger: true,
  },

  env: (config) => ({
    ...config,
    NODE_ENV: 'storybook',
    BROWSER: 'chrome',
    ...(process.env.REACT_APP_QORUS_TOKEN
      ? { REACT_APP_QORUS_TOKEN: process.env.REACT_APP_QORUS_TOKEN }
      : {}),
    ...(process.env.REACT_APP_QORUS_INSTANCE
      ? { REACT_APP_QORUS_INSTANCE: process.env.REACT_APP_QORUS_INSTANCE }
      : {}),
  }),

  typescript: { reactDocgen: 'react-docgen' },
};
