import { ReqoreSpinner, ReqoreTree } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react';
import { useEffectOnce } from 'react-use';
import { StoryMeta } from '../../types';
import { useFetch } from './fetch';

const meta = {
  title: 'Hooks/Fetch',
  render: () => {
    const { data = {}, load, loading } = useFetch<any>({ url: 'public/info' });

    useEffectOnce(() => {
      load();
    });

    return loading ? (
      <ReqoreSpinner />
    ) : (
      <ReqoreTree data={data} bottomActions={[{ label: 'Refetch', onClick: load }]} />
    );
  },
} as StoryMeta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const get: Story = {
  args: {},
};
