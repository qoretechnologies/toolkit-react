import { ReqoreControlGroup } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { StoryMeta } from '../../../../types';
import { ReqraftBinaryFormField } from './Binary';

const meta = {
  component: ReqraftBinaryFormField,
  title: 'Components/Form/Binary',
  args: {
    onChange: fn(),
    'aria-label': 'Binary',
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <ReqoreControlGroup>
        <ReqraftBinaryFormField
          {...args}
          value={value}
          onChange={(value) => {
            args.onChange?.(value);
            setValue(value);
          }}
        />
      </ReqoreControlGroup>
    );
  },
} as StoryMeta<typeof ReqraftBinaryFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithValue: Story = {
  args: {
    value: 'cGFzc3dvcmQ=',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Binary field pre-populated with a base64 payload — the textarea shows the encoded string.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('Binary');

    await expect(textarea).toBeInTheDocument();
    await expect(textarea).toHaveValue('cGFzc3dvcmQ=');
  },
};

export const TypingUpdatesValue: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the empty Binary field. Typing a base64 string into the textarea updates the value and fires onChange after the debounce.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('Binary');

    await userEvent.type(textarea, 'YWJj');
    await expect(textarea).toHaveValue('YWJj');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('YWJj'), {
      timeout: 500,
    });
  },
};

export const UploadEncodesFileAsBase64: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Binary field with its file drop zone. Uploading a file encodes it as base64 (data-URL prefix stripped) and fires onChange with the encoded string.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const file = new File(['hello'], 'test.bin', { type: 'application/octet-stream' });
    // the hidden file input rendered by the reused ReqraftFileFormField drop zone
    const input = canvasElement.querySelector('input[type="file"]') as HTMLInputElement;

    await expect(input).toBeInTheDocument();
    await userEvent.upload(input, file);

    // base64 of "hello" is "aGVsbG8="; the data: URL prefix must be stripped
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('aGVsbG8='), {
      timeout: 1000,
    });
  },
};

export const Disabled: Story = {
  args: {
    value: 'cGFzc3dvcmQ=',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Binary field with a base64 value but disabled — the textarea is non-interactive.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('Binary');

    await expect(textarea).toBeDisabled();
  },
};
