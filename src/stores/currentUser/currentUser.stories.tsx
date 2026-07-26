import { ReqoreP, ReqoreSpinner, ReqoreTree } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { testsWaitForText } from '../../../__tests__/utils';
import { StoryMeta } from '../../types';
import { currentUserStore } from './currentUser';

const meta = {
  title: 'Stores/Current User',
  render: () => {
    const { load, loading, currentUser = {}, errorData } = currentUserStore();

    return loading ? (
      <ReqoreSpinner />
    ) : (
      <>
        <ReqoreTree
          data={errorData || currentUser}
          bottomActions={[{ label: 'Refetch', onClick: load }]}
        />
      </>
    );
  },
} as StoryMeta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const CurrentUserCanBeLoaded: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a demo that reads currentUserStore — the store loads /users?action=current and the returned user object is displayed as a tree.',
      },
    },
  },
  play: async () => {
    await testsWaitForText('"David Nichols"');
  },
};

export const CurrentUserHasPermissions: Story = {
  ...CurrentUserCanBeLoaded,
  parameters: {
    ...CurrentUserCanBeLoaded.parameters,
    docs: {
      description: {
        story:
          'Renders a demo that calls currentUserStore().hasAnyPermission — the affirmative message renders because the loaded user carries at least one of the requested permissions.',
      },
    },
  },
  render: () => {
    const { hasAnyPermission } = currentUserStore();

    return (
      <ReqoreP>
        {hasAnyPermission(['USER-CONTROL', 'RANDOM-PERM'])
          ? 'Yes, user has "SERVER-CONTROL" permission'
          : 'No'}
      </ReqoreP>
    );
  },
  play: async () => {
    await testsWaitForText('Yes, user has "SERVER-CONTROL" permission');
  },
};
