import { StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, waitFor } from '@storybook/test';
import menu from '../../../mock/menu';
import { StoryMeta } from '../../types';
import { ReqraftMenu, TReqraftMenu } from './Menu';

const typedMenu = menu as TReqraftMenu;

const meta = {
  component: ReqraftMenu,
  title: 'Components/Menu',
  render: (props) => <ReqraftMenu {...props} />,
} as StoryMeta<typeof ReqraftMenu>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    menu: typedMenu,
  },
};
export const ActivePath: Story = {
  args: {
    path: '/Interfaces/mapper',
    menu: typedMenu,
  },
};

export const WithDefaultQuery: Story = {
  args: {
    menu: typedMenu,
    defaultQuery: 'mapper',
  },
  play: async () => {
    await expect(document.querySelector('.reqore-input')).toHaveValue('mapper');
    await expect(document.querySelectorAll('.reqore-menu-item')).toHaveLength(2);
  },
};

export const Filtered: Story = {
  args: {
    menu: typedMenu,
    onQueryChange: fn(),
  },
  play: async () => {
    await fireEvent.change(document.querySelector('.reqore-input'), { target: { value: 'step' } });

    await waitFor(() => expect(document.querySelectorAll('.reqore-menu-item')).toHaveLength(2), {
      timeout: 1000,
    });
  },
};
