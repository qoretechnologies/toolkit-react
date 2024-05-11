import { StoryObj } from '@storybook/react';
import { expect, fn, within } from '@storybook/test';
import { useState } from 'react';

import styled from 'styled-components';
import { longStringText, markdown } from '../../../../mock/fields';
import { StoryMeta } from '../../../types';
import { TFormFieldType } from '../../../types/Form';
import { FormField, IFormFieldProps } from './Field';

const meta = {
  component: FormField,
  title: 'Components/Form/Field',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState<any>(args.value);
    return <FormField {...args} value={value} onChange={setValue} />;
  },
} as StoryMeta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

const DefaultStoryWrapper = styled.div`
  display: grid;
  gap: 32px;
  width: 100%;
  max-width: 850px;
  margin: 0 auto;
`;
export const Default: Story = {
  render() {
    const [values, setValues] = useState({
      name: 'Qore',
      sendNotifications: true,
      amount: 99,
      color: { r: 255, g: 255, b: 255, a: 1 },
      language: 'Java',
      description: longStringText,
      post: markdown,
    } as const);

    const onChange = (field: keyof typeof values) => (value) => {
      setValues((values) => ({ ...values, [field]: value }));
    };
    const getFieldProps = <T extends TFormFieldType>(name: T, key: keyof typeof values) =>
      ({
        'aria-label': name,
        label: name,
        type: name,
        value: values[key],
        onChange: onChange(key),
      }) as unknown as IFormFieldProps<T>;

    return (
      <DefaultStoryWrapper>
        <FormField {...getFieldProps('string', 'name')} />
        <FormField {...getFieldProps('boolean', 'sendNotifications')} />
        <FormField {...getFieldProps('number', 'amount')} />
        <FormField {...getFieldProps('color', 'color')} />
        <FormField
          {...getFieldProps('radio', 'language')}
          fieldProps={{
            items: [
              { label: 'Qore', value: 'Qore', 'aria-label': 'Qore' },
              { label: 'Java', value: 'Java', 'aria-label': 'Java' },
              { label: 'Python', value: 'Python', 'aria-label': 'Python' },
            ],
          }}
        />
        <FormField {...getFieldProps('longstring', 'description')} />
        <FormField {...getFieldProps('markdown', 'post')} />
      </DefaultStoryWrapper>
    );
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('string')).toBeInTheDocument();
    await expect(canvas.getByLabelText('boolean')).toBeInTheDocument();
    await expect(canvas.getByLabelText('number')).toBeInTheDocument();
    await expect(canvasElement.querySelector('.sketch-picker')).toBeInTheDocument();
    await expect(canvas.getByLabelText('radio')).toBeInTheDocument();
    await expect(canvas.getByLabelText('longstring')).toBeInTheDocument();
    await expect(canvas.getByLabelText('markdown')).toBeInTheDocument();
  },
};

export const String: Story = {
  args: {
    type: 'string',
    value: 'Qore',
    label: 'Label',
  },
};

export const Boolean: Story = {
  args: {
    type: 'boolean',
    value: true,
    label: 'Label',
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    value: 99,
    label: 'Label',
  },
};

export const Color: Story = {
  args: {
    type: 'color',
    value: { r: 0, g: 0, b: 0, a: 1 },
    label: 'Label',
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
    label: 'Label',
  },
};

export const LongString: Story = {
  args: {
    type: 'longstring',
    value: longStringText,
    label: 'Label',
  },
};

export const Markdown: Story = {
  args: {
    type: 'markdown',
    value: markdown,
    label: 'Label',
  },
};
