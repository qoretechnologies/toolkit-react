import { ReqoreMessage, ReqorePanel, ReqoreSpinner, ReqoreTree } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react';
import { fireEvent } from '@storybook/test';
import { sleep, testsClickButton, testsWaitForText } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { QorusQogsStore } from './QogsStore';

const meta = {
  title: 'Features/Qogs',
  render: () => {
    const { load, loading, data, error, errorData } = QorusQogsStore();

    return loading ? (
      <ReqoreSpinner />
    ) : (
      <ReqorePanel bottomActions={[{ label: 'Refetch', onClick: load }]} fill>
        {error ? (
          <ReqoreMessage intent='danger' title='Error loading Qogs' opaque={false}>
            {errorData}
          </ReqoreMessage>
        ) : (
          <ReqoreTree data={data} fill />
        )}
      </ReqorePanel>
    );
  },
} as StoryMeta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const QogsCanBeLoaded: Story = {
  play: async () => {
    await testsClickButton({ label: 'Refetch' });
    await testsWaitForText('0:');
    await sleep(1000);
    await fireEvent.click(document.querySelector('.reqore-tree-toggle') as HTMLElement);
    await testsWaitForText('"fsm3"');
  },
};
