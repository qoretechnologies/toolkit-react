import { ReqoreControlGroup } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, waitFor } from 'storybook/test';
import { expectAPlainAddButton } from '../../../../stories/addControl';
import { StoryMeta } from '../../../../types';
import { ArrayAuto } from './ArrayAuto';

/*
 * In a file of its own: React reports an unknown prop once per page, so a story that shares its
 * page with others rendering the same rows could not see it.
 */

/** What React reported through `console.error` since the story began. */
const reported: string[] = [];
const UNKNOWN_PROP = /Unknown event handler property|does not recognize the|non-boolean attribute/;

const meta = {
  title: 'Components/Form/Auto Array/Rows',
  component: ArrayAuto,
} as StoryMeta<typeof ArrayAuto>;

export default meta;
type Story = StoryObj<typeof meta>;

const RedirectUris = () => {
  const [value, setValue] = useState([
    'https://app.example.com/oauth/callback',
    'https://staging.example.com/oauth/callback',
  ]);

  return (
    <ReqoreControlGroup vertical className='story-field' style={{ maxWidth: 560 }}>
      <ArrayAuto
        name='redirect_uris'
        type='string'
        value={value}
        onChange={(_name: string, next: string[]) => setValue(next)}
      />
    </ReqoreControlGroup>
  );
};

export const AListOfStringsPassesNoUnknownProps: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "An OAuth2 client's redirect URIs: a list of two strings, one row each. React reports no prop it does not know: each row's `onSubFormAttentionChange` and `expandFirstRequired` reach only the row's field, never TemplateField's own text editor or wrapper, which put them on a div (\"Unknown event handler property `onSubFormAttentionChange`\", found by qorus-ide's React warning gate, 17 Nov).",
      },
    },
  },
  beforeEach: () => {
    reported.length = 0;
    const original = console.error;

    console.error = (...args: unknown[]) => {
      reported.push(args.map(String).join(' '));
      original(...args);
    };

    return () => {
      console.error = original;
    };
  },
  render: () => <RedirectUris />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.textContent).toContain('https://app.example.com/oauth/callback')
    );

    await expect(reported.filter((message) => UNKNOWN_PROP.test(message))).toEqual([]);
    // Its add control is an ordinary button as wide as its words, as every list field's is.
    await expectAPlainAddButton(canvasElement.querySelector('.story-field')!);
  },
};
