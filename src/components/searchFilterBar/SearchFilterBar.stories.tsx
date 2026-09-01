import { StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import { StoryMeta } from '../../types';
import { SearchFilterBar } from './SearchFilterBar';

/*
 * The strip that sits above a list and narrows it: a search box plus the filter
 * dropdowns that go with it.
 */
const meta = {
  component: SearchFilterBar,
  title: 'Components/Search Filter Bar',
  args: {
    onChange: fn(),
    placeholder: 'Search tickets…',
    filters: [
      {
        icon: 'Filter3Line' as const,
        label: 'Any status',
        items: [
          { label: 'Any status', value: 'any', selected: true },
          { label: 'Open', value: 'open' },
          { label: 'Resolved', value: 'resolved' },
        ],
      },
    ],
  },
} as StoryMeta<typeof SearchFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { value: '' },
  parameters: {
    docs: {
      description: {
        story: 'Nothing typed — the bar is quiet, and the list below it is the whole list.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).getByPlaceholderText('Search tickets…')).toBeVisible();
  },
};

export const Filtering: Story = {
  args: { value: 'deploy', intent: 'info' },
  parameters: {
    docs: {
      description: {
        story:
          'A query is active, so the box carries `intent="info"`. Without it a filtered list and a genuinely short list look identical, and a reader who lands on three rows cannot tell which they are looking at.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByPlaceholderText('Search tickets…');
    expect(input).toHaveValue('deploy');
  },
};
