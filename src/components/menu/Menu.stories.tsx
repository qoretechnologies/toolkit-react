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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftMenu with the mock Qorus navigation — sections and items appear in the sidebar with no active path highlighted.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftMenu with the /Interfaces/mapper path — the matching menu entry is highlighted as active.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftMenu with the /Interfaces/mapper path and a "success" activeItemIntent — the active entry uses the success intent for its highlight colour.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftMenu with a defaultQuery of "mapper" — the search input is pre-filled and the visible items are narrowed to those matching the query.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftMenu with an onQueryChange handler. Typing "step" into the search filter narrows the visible items to just the matching entries.',
      },
    },
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
    docs: {
      description: {
        story:
          'Renders ReqraftMenu backed by user storage that already holds a persisted width — the menu mounts at the stored width rather than the default.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftMenu with topChildren and bottomChildren slots — custom nodes appear above and below the menu list.',
      },
    },
  },
  play: async () => {
    await testsWaitForText('Interfaces & More');
    await testsWaitForText('Top Custom Child');
    await testsWaitForText('Bottom Custom Child');
  },
};
