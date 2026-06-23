import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
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
  args: {
    customTheme: { main: '#1e0421' },
  },
} as StoryMeta<typeof ReqraftMenu>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    menu: typedMenu,
  },
  play: async () => {
    await testsWaitForText('Interfaces & More');
  },
};
export const ActivePath: Story = {
  args: {
    path: '/Interfaces/mapper',
    menu: typedMenu,
  },
  play: async () => {
    await testsWaitForText('Interfaces & More');
  },
};

export const ActiveMenuItemIntent: Story = {
  args: {
    path: '/Interfaces/mapper',
    menu: typedMenu,
    activeItemIntent: 'success',
  },
  play: async () => {
    await testsWaitForText('Interfaces & More');
  },
};

export const WithDefaultQuery: Story = {
  args: {
    menu: typedMenu,
    defaultQuery: 'mapper',
  },
  play: async () => {
    await testsWaitForText('Interfaces & More');
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
    await testsWaitForText('Interfaces & More');
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

export const WithCustomChildren: Story = {
  ...ActivePath,
  args: {
    ...ActivePath.args,
    topChildren: <div style={{ padding: 10 }}>Top Custom Child</div>,
    bottomChildren: <div style={{ padding: 10 }}>Bottom Custom Child</div>,
  },
  play: async () => {
    await testsWaitForText('Interfaces & More');
    await testsWaitForText('Top Custom Child');
    await testsWaitForText('Bottom Custom Child');
  },
};
