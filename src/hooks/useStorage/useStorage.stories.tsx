import { ReqoreButton, ReqoreControlGroup, ReqoreP } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { useRef } from 'react';
import { fireEvent, within } from 'storybook/test';
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
    docs: {
      description: {
        story:
          'Renders a useReqraftStorage demo where the server returns no stored value — the hook falls back to the default and displays it.',
      },
    },
    mockData: [
      {
        url: 'https://hq.qoretechnologies.com:8092/api/latest/users?action=current',
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
    docs: {
      description: {
        story:
          'Renders a useReqraftStorage demo with a value already persisted on the server — the hook loads it and displays it in place of the default.',
      },
    },
    mockData: [...storiesStorageMock],
  },
  play: async () => {
    await testsWaitForText('This is a storage value');
  },
};

export const ValueCanBeUpdated: Story = {
  ...StorageValue,
  parameters: {
    ...StorageValue.parameters,
    docs: {
      description: {
        story:
          'Renders the useReqraftStorage demo with a stored value. When "Update storage" is clicked, the setter writes a new value and the display refreshes to match.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    //await sleep(1000);

    await testsWaitForText('This is a storage value');
    await testsWaitForText('Update storage');
    await fireEvent.click(canvas.getByText('Update storage'));
    await testsWaitForText('This is a NEW value');
  },
};

/**
 * Regression for the "stale updater clobbers other keys" bug: the storage
 * updater must persist onto the LATEST storage blob, not the one captured in
 * its closure. Long-lived callers (an imperative store subscription, a ref to
 * the mount-time setter) hold an old updater; writing through it must not wipe
 * keys other hooks wrote in the meantime.
 */
export const StaleUpdaterDoesNotClobberOtherKeys: Story = {
  args: { reqraftOptions: { waitForStorage: true } },
  parameters: {
    docs: {
      description: {
        story:
          "Renders two useReqraftStorage keys and captures the mount-time setter for the first one (a deliberately STALE updater). After a second key is written, writing through the stale updater must keep the second key intact — proving storage writes merge onto the latest blob rather than a closure copy. This is the regression test for page-visit tracking wiping other stored settings.",
      },
    },
    mockData: [...storiesStorageMock],
  },
  render: () => {
    const [someVal, setSomeVal] = useReqraftStorage<string>('some-path', 'default');
    const [keyB] = useReqraftStorage<string>('key-b', 'b-default');
    const [, setKeyB] = useReqraftStorage<string>('key-b', 'b-default');
    // Capture the mount-time setter — it stays stale once other keys change.
    const staleSetSomeVal = useRef(setSomeVal);

    return (
      <ReqoreControlGroup vertical>
        <ReqoreP>{`some-path: ${someVal}`}</ReqoreP>
        <ReqoreP>{`key-b: ${keyB}`}</ReqoreP>
        <ReqoreButton onClick={() => setKeyB('b-written')}>Write B</ReqoreButton>
        <ReqoreButton onClick={() => staleSetSomeVal.current('a-written')}>
          Write A (stale)
        </ReqoreButton>
      </ReqoreControlGroup>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await testsWaitForText('some-path: This is a storage value');
    // Write a second key through its own (fresh) updater.
    await fireEvent.click(canvas.getByText('Write B'));
    await testsWaitForText('key-b: b-written');
    // Write the first key through the STALE mount-time updater.
    await fireEvent.click(canvas.getByText('Write A (stale)'));
    await testsWaitForText('some-path: a-written');
    // The stale write must NOT have wiped the second key.
    await testsWaitForText('key-b: b-written');
  },
};

export const ValueCanBeRemoved: Story = {
  ...StorageValue,
  parameters: {
    ...StorageValue.parameters,
    docs: {
      description: {
        story:
          'Renders the useReqraftStorage demo with a stored value. When "Remove value" is clicked, the remover clears storage and the hook falls back to the default value.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await testsWaitForText('This is a storage value');
    await testsWaitForText('Remove value');
    await fireEvent.click(canvas.getByText('Remove value'));
    await testsWaitForText('This is a default value');
  },
};
