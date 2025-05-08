import { StoryObj } from '@storybook/react';
import { expect, fireEvent } from '@storybook/test';
import { GetServices, ToggleEnableServices } from '../../../__tests__/services/api';
import { sleep, testsClickButton, testsWaitForText } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { QorusServicesTable } from './table';

const meta = {
  title: 'Features/Services',
  excludeStories: ['ServicesSocket'],
  render: () => {
    return <QorusServicesTable />;
  },
} as StoryMeta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const ServicesCanBeLoaded: Story = {
  parameters: {
    mockData: [GetServices],
  },
  play: async () => {
    await testsWaitForText('Enabled Service');
    await sleep(1000);
    await expect(document.querySelectorAll('.reqore-table-body .reqore-table-row')).toHaveLength(
      15
    );
  },
};

export const ServicesCanBeSelected: Story = {
  ...ServicesCanBeLoaded,
  parameters: {
    mockData: [...ServicesCanBeLoaded.parameters.mockData, ToggleEnableServices],
  },
  play: async (args) => {
    await ServicesCanBeLoaded.play(args);
    // ??? No idea why this is needed, but it is
    await fireEvent.click(document.querySelectorAll('.reqore-table-header-cell')[0]);
    await fireEvent.click(document.querySelectorAll('.reqore-table-header-cell')[0]);
    await sleep(1000);
    await testsWaitForText('With Selected');
    await testsClickButton({ label: 'With Selected' });
    await testsWaitForText('Reset');
  },
};
