import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { UrlFormField } from './Url';

const meta = {
  component: UrlFormField,
  title: 'Components/Form/Url',
  args: {
    onChange: fn(),
    'aria-label': 'URL address',
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <UrlFormField
        {...args}
        value={value}
        onChange={(v) => {
          args.onChange?.(v);
          setValue(v);
        }}
      />
    );
  },
} as StoryMeta<typeof UrlFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Url field with no value. Typing into the address input recomposes the URL and fires onChange after the debounce; because no protocol is selected, the composed value keeps a bare "://" prefix.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('URL address');
    await expect(input).toBeInTheDocument();
    // Nothing fires on mount — onChange is edge-triggered; the first user
    // edit recomposes and emits. Protocol-less, so the bare `://` prefix,
    // which the `url` validator flags rather than rewrites.
    await expect(args.onChange).not.toHaveBeenCalled();
    await userEvent.type(input, 'example.com');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('://example.com'), {
      timeout: 5000,
    });
  },
};

export const WithValue: Story = {
  args: {
    value: 'https://example.com',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Url field pre-populated with "https://example.com" — the URL is split across the https protocol selector and the example.com address input.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByDisplayValue('example.com')).toBeInTheDocument();
    await expect(canvas.getByText('https')).toBeInTheDocument();
  },
};

export const KeepsSeparatorInsideAddress: Story = {
  args: {
    value: 'https://proxy/forward?to=http://inner',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Url field with a URL whose query-string embeds a second "://". The protocol split only consumes the leading separator; the inner "://" survives inside the address input.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `://` inside the address survives the protocol/address split.
    await expect(
      await canvas.findByDisplayValue('proxy/forward?to=http://inner')
    ).toBeInTheDocument();
  },
};
