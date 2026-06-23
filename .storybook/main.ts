import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],

  addons: [
    '@storybook/addon-links',
    '@chromatic-com/storybook',
    'storybook-addon-mock',
    '@storybook/addon-docs',
    '@storybook/addon-vitest',
  ],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  // `false` (matching reqore) keeps the tree babel-free — react-docgen would
  // pull @babel/core back in just to auto-generate prop tables.
  typescript: { reactDocgen: false },
};

export default config;
