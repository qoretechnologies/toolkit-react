import { ReqoreButton, ReqoreControlGroup, ReqoreP } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react';
import { fireEvent, within } from '@storybook/test';
import { storiesStorageMock } from '../../../__tests__/ mock';
import { testsWaitForText } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { useReqraftStorage } from './useStorage';

const meta = {
  title: 'Hooks/useStorage',
  render: () => {
    const [storage, setStorage, removeValue] = useReqraftStorage<string>(
      'some-path',
      'This is a default value'
    );

    return (
      <ReqoreControlGroup>
        <ReqoreP>{storage}</ReqoreP>
        <ReqoreButton onClick={() => setStorage('This is a NEW value')}>
          Update storage
        </ReqoreButton>
        <ReqoreButton onClick={() => removeValue()}>Remove value</ReqoreButton>
      </ReqoreControlGroup>
    );
  },
  args: { reqraftOptions: { waitForStorage: true } },
} as StoryMeta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const DefaultValue: Story = {
  args: {
    method: 'GET',
  },
  parameters: {
    mockData: [
      {
        url: 'https://hq.qoretechnologies.com:8092/api/latest/users/_current_/storage',
        method: 'GET',
        status: 200,
        response: {},
      },
    ],
  },
  play: async () => {
    await testsWaitForText('This is a default value');
  },
};

export const StorageValue: Story = {
  parameters: {
    mockData: [...storiesStorageMock],
  },
  play: async () => {
    await testsWaitForText('This is a storage value');
  },
};

export const ValueCanBeUpdated: Story = {
  ...StorageValue,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    //await sleep(1000);

    await testsWaitForText('This is a storage value');
    await testsWaitForText('Update storage');
    await fireEvent.click(canvas.getByText('Update storage'));
    await testsWaitForText('This is a NEW value');
  },
};

export const ValueCanBeRemoved: Story = {
  ...StorageValue,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await testsWaitForText('This is a storage value');
    await testsWaitForText('Remove value');
    await fireEvent.click(canvas.getByText('Remove value'));
    await testsWaitForText('This is a default value');
  },
};
