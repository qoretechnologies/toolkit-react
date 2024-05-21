import { StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, waitFor } from '@storybook/test';
import { storiesStorageMock, storiesStorageMockEmpty } from '../../../__tests__/ mock';
import { testsWaitForText } from '../../../__tests__/utils';
import menu from '../../../mock/menu';
import { StoryMeta } from '../../types';
import { ReqraftMenu, TReqraftMenu } from './Menu';

const typedMenu = menu as TReqraftMenu;

const meta = {
  component: ReqraftMenu,
  title: 'Components/Menu',
  render: (props) => <ReqraftMenu {...props} />,
  parameters: {
    mockData: [...storiesStorageMockEmpty],
  },
} as StoryMeta<typeof ReqraftMenu>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    menu: typedMenu,
  },
  play: async () => {
    await testsWaitForText('Developer Portal');
  },
};
export const ActivePath: Story = {
  args: {
    path: '/Interfaces/mapper',
    menu: typedMenu,
  },
  play: async () => {
    await testsWaitForText('Developer Portal');
  },
};

export const WithDefaultQuery: Story = {
  args: {
    menu: typedMenu,
    defaultQuery: 'mapper',
  },
  play: async () => {
    await testsWaitForText('Developer Portal');
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
    await testsWaitForText('Developer Portal');
    await fireEvent.change(document.querySelector('.reqore-input'), { target: { value: 'step' } });

    await waitFor(() => expect(document.querySelectorAll('.reqore-menu-item')).toHaveLength(2), {
      timeout: 1000,
    });
  },
};

export const WidthFromStorage: Story = {
  ...ActivePath,
  parameters: {
    mockData: [...storiesStorageMock],
  },
};
