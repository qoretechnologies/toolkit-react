import { ReqorePanel, ReqoreTag } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { codeSizeTagProps, ReqraftCodeSizeTag } from './index';

const SOURCE = `%new-style
%strict-args

class Hello inherits QorusService {
    init() {
    }
}
`;

const meta = {
  component: ReqraftCodeSizeTag,
  title: 'Components/CodeSizeTag',
  args: { code: SOURCE },
} as StoryMeta<typeof ReqraftCodeSizeTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InAPanelHeader: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the size of a source as a panel badge beside its language, where read-only source views put it: quiet words ("82 chars · 8 lines") in the soft shade of the text, not a colored chip, because how much code there is is metadata.',
      },
    },
  },
  render: (args) => (
    <ReqorePanel
      label='Source code'
      flat
      badge={[{ label: 'Qore', icon: 'CodeSLine', size: 'small', minimal: true }, codeSizeTagProps(args.code)]}
      padded
    >
      <pre style={{ margin: 0 }}>{args.code}</pre>
    </ReqorePanel>
  ),
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('8 lines')).toBeInTheDocument();
    await expect(canvas.getByText('82 chars')).toBeInTheDocument();
  },
};

export const OnItsOwn: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Renders the tag element on its own, beside a default tag for comparison.',
      },
    },
  },
  render: (args) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <ReqoreTag label='Qore' icon='CodeSLine' size='small' minimal />
      <ReqraftCodeSizeTag {...args} />
    </div>
  ),
};
