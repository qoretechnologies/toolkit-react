import { StoryObj } from '@storybook/react';
import { expect, fn, within } from '@storybook/test';
import { useState } from 'react';

import { longStringText, markdown } from '../../../../mock/fields';
import { StoryMeta } from '../../../types';
import { FormField } from './Field';

const meta = {
  component: FormField,
  title: 'Components/Form/Field',
  args: {
    onChange: fn(),
  },
} as StoryMeta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render() {
    const [values, setValues] = useState({
      name: 'Qore',
      sendNotifications: true,
      amount: 99,
      color: { r: 255, g: 255, b: 255, a: 1 },
      language: 'Java',
      description: longStringText,
      markdown: markdown,
    } as const);

    const onChange = (field: keyof typeof values) => (value) => {
      setValues((values) => ({ ...values, [field]: value }));
    };

    return (
      <div style={{ display: 'grid', gap: '32px', maxWidth: '1024px', margin: 'auto' }}>
        <FormField
          aria-label='String'
          type='string'
          value={values.name as string}
          onChange={onChange('name') as any}
        />

        <FormField
          aria-label='Boolean'
          type='boolean'
          value={values.sendNotifications}
          onChange={onChange('sendNotifications')}
        />

        <FormField
          aria-label='Number'
          type='number'
          value={values.amount}
          onChange={onChange('amount')}
        />

        <FormField
          aria-label='Color'
          type='color'
          value={values.color}
          onChange={onChange('color')}
        />

        <FormField
          aria-label='Radio'
          type='radio'
          value={values.language}
          onChange={onChange('language')}
          fieldProps={{
            items: [
              { label: 'Qore', value: 'Qore', 'aria-label': 'Qore' },
              { label: 'Java', value: 'Java', 'aria-label': 'Java' },
              { label: 'Python', value: 'Python', 'aria-label': 'Python' },
            ],
          }}
        />

        <FormField
          aria-label='LongString'
          type='longstring'
          value={values.description}
          onChange={onChange('description')}
        />

        <FormField
          aria-label='Markdown'
          type='markdown'
          value={values.markdown}
          onChange={onChange('markdown')}
        />
      </div>
    );
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('String')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Boolean')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Number')).toBeInTheDocument();
    await expect(canvasElement.querySelector('.sketch-picker')).toBeInTheDocument();
    await expect(canvas.getByLabelText('LongString')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Markdown')).toBeInTheDocument();
  },
};

export const String: Story = {
  args: {
    type: 'string',
    value: 'Qore',
  },
};

export const Boolean: Story = {
  args: {
    type: 'boolean',
    value: true,
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    value: 99,
  },
};

export const Color: Story = {
  args: {
    type: 'color',
    value: { r: 0, g: 0, b: 0, a: 1 },
  },
};

export const Radio: Story = {
  args: {
    type: 'radio',
    value: 'Qore',
    items: [
      { label: 'Qore', value: 'Qore', 'aria-label': 'Qore' },
      { label: 'Java', value: 'Java', 'aria-label': 'Java' },
      { label: 'Python', value: 'Python', 'aria-label': 'Python' },
    ],
  },
};

export const LongString: Story = {
  args: {
    type: 'longstring',
    value: longStringText,
  },
};

export const Markdown: Story = {
  args: {
    type: 'markdown',
    value: markdown,
  },
};
