import { ReqoreSpinner, ReqoreTree } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react';
import { useEffectOnce } from 'react-use';
import { StoryMeta } from '../../types';
import { useGet } from './fetch';

const meta = {
  title: 'Hooks/Fetch',
  render: () => {
    const { data = {}, load, loading } = useGet<any>({ url: 'public/info' });

    useEffectOnce(() => {
      load();
    });

    return loading ? <ReqoreSpinner /> : <ReqoreTree data={data} />;
  },
} as StoryMeta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const get: Story = {
  args: {},
};
