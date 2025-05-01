import { StoryObj } from '@storybook/react';
import { fireEvent } from '@storybook/test';
import { sleep, testsClickButton, testsWaitForText } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { QorusServicesTable } from './table';

const meta = {
  title: 'Features/Services',
  render: () => {
    return <QorusServicesTable />;
  },
} as StoryMeta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const ServicesCanBeLoaded: Story = {
  play: async () => {
    await testsClickButton({ label: 'Refetch' });
    await testsWaitForText('0:');
    await sleep(1000);
    await fireEvent.click(document.querySelector('.reqore-tree-toggle') as HTMLElement);
    await testsWaitForText('"fsm3"');
  },
};
