import { ReqoreControlGroup, ReqoreP } from '@qoretechnologies/reqore';
import { Meta, StoryObj } from '@storybook/react';
import { _testsClickText, _testsWaitForText } from '../../stories/Tests/utils';
import { ReqraftCollapsibleContent } from './CollapsibleContent';

const meta: Meta<typeof ReqraftCollapsibleContent> = {
  component: ReqraftCollapsibleContent,
  title: 'Components/CollapsibleContent',
};

export default meta;
type Story = StoryObj<typeof meta>;

// Many lines of content — taller than the threshold, so it clips behind the
// gradient fade with a "Show more" button that surfaces on hover.
const Lines = ({ count, prefix = 'Line' }: { count: number; prefix?: string }) => (
  <ReqoreControlGroup vertical fluid gapSize='small'>
    {Array.from({ length: count }, (_, i) => (
      <ReqoreP key={i} size='small'>
        {prefix} {i + 1} — some revealed content in the collapsible region.
      </ReqoreP>
    ))}
  </ReqoreControlGroup>
);

// Tall content → clipped + faded, with a hover-revealed "Show more".
export const Overflowing: Story = {
  args: {
    maxCollapsedHeight: 120,
    children: <Lines count={20} />,
  },
  play: async () => {
    // Clipped content is still in the DOM (overflow:hidden, not unmounted).
    await _testsWaitForText('Line 1 — some revealed content in the collapsible region.');
    await _testsWaitForText('Show more');
    // Expanding swaps in the "Show less" affordance.
    await _testsClickText('Show more');
    await _testsWaitForText('Show less');
  },
};

// Short content → shown whole, no fade, no buttons.
export const FitsWithoutFade: Story = {
  args: {
    maxCollapsedHeight: 300,
    children: <Lines count={2} />,
  },
  play: async () => {
    await _testsWaitForText('Line 1 — some revealed content in the collapsible region.');
  },
};

// A custom fade colour (e.g. when the content sits on a tinted surface).
export const CustomFadeColour: Story = {
  args: {
    maxCollapsedHeight: 120,
    fadeColor: '#1a1330',
    accentColor: '#9a749a',
    children: <Lines count={20} prefix='Row' />,
  },
  play: async () => {
    await _testsWaitForText('Show more');
  },
};
