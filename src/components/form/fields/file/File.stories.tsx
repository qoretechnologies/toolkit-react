import { StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { ReqraftFileFormField } from './File';

const meta = {
  component: ReqraftFileFormField,
  title: 'Components/Form/File',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <ReqraftFileFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof ReqraftFileFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the File field with no value — the "Click or drop files here to upload" drop zone is visible.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Click or drop files here to upload')).toBeInTheDocument();
  },
};

export const WithValue: Story = {
  args: {
    value: {
      name: 'report.pdf',
      content: 'data:application/pdf;base64,abc123',
      size: 28736,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the File field pre-populated with a PDF value — the file name is displayed in place of the drop zone.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('report.pdf')).toBeInTheDocument();
  },
};

export const WithImageValue: Story = {
  args: {
    value: {
      name: 'photo.png',
      content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      size: 1024,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the File field pre-populated with a PNG image value — the file name and an inline preview thumbnail are shown.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('photo.png')).toBeInTheDocument();
    await expect(canvasElement.querySelector('img')).toBeInTheDocument();
  },
};

export const WithAcceptedExtensions: Story = {
  args: {
    options: {
      accept: {
        'image/png': ['.png'],
        'image/jpeg': ['.jpg', '.jpeg'],
        'application/pdf': ['.pdf'],
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the File field with an accept option limiting uploads to PNG, JPEG and PDF — the allowed extensions are listed below the drop zone.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Click or drop files here to upload')).toBeInTheDocument();
    await expect(canvas.getByText('.png, .jpg, .jpeg, .pdf')).toBeInTheDocument();
  },
};

export const Multiple: Story = {
  args: {
    multiple: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the File field with multiple-selection enabled — the underlying input carries the multiple attribute and the drop zone stays visible after files are added.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Click or drop files here to upload')).toBeInTheDocument();
    // Even when a value is set externally, the click-or-drop area
    // stays visible so the user can keep adding files. Multi-file
    // consumers render their own picked-file list above the field.
    const input = canvasElement.querySelector('input[type="file"]') as HTMLInputElement | null;
    await expect(input).not.toBeNull();
    await expect(input?.multiple).toBe(true);
  },
};

export const WithBuildTab: Story = {
  args: {
    argSchema: {
      filename: { type: 'string', ui_type: 'string', display_name: 'Filename', required: true },
      content: { type: 'string', ui_type: 'string', display_name: 'Content', required: true },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the File field with an argSchema — a "Build a File" tab appears alongside the "Upload a File" drop zone so the user can synthesize a file from schema fields.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Upload a File')).toBeInTheDocument();
    await expect(canvas.getByText('Build a File')).toBeInTheDocument();
  },
};
