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
      cron: '* * * * *',
    } as const);

    const getFieldProps = <T extends TFormFieldType>(type: T, key: keyof typeof values) =>
      ({
        'aria-label': type,
        label: type,
        type: type,
        value: values[key],
        onChange: (value) => {
          setValues((values) => ({ ...values, [key]: value }));
        },
        labelProps: {
          style: { textTransform: 'capitalize' },
        },
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
        <FormField {...getFieldProps('long-string', 'description')} />
        <FormField {...getFieldProps('markdown', 'post')} />
        <FormField
          {...getFieldProps('cron', 'cron')}
          fieldProps={{ wrapperProps: { 'aria-label': 'Cron' } }}
        />
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
    await expect(canvas.getByLabelText('long-string')).toBeInTheDocument();
    await expect(canvas.getByLabelText('markdown')).toBeInTheDocument();
    await expect(canvas.getByLabelText('cron')).toBeInTheDocument();
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
    label: 'Boolean',
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    value: 99,
    label: 'Number',
  },
};

export const Color: Story = {
  args: {
    type: 'color',
    value: { r: 0, g: 0, b: 0, a: 1 },
    label: 'Color',
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
    label: 'Radio',
  },
};

export const LongString: Story = {
  args: {
    type: 'long-string',
    value: longStringText,
    label: 'Long String',
  },
};

export const Markdown: Story = {
  args: {
    type: 'markdown',
    value: markdown,
    label: 'Markdown',
  },
};
export const Cron: Story = {
  args: {
    type: 'cron',
    value: '* * * * *',
    label: 'Cron',
  },
};

export const WithAllowedValuesFew: Story = {
  args: {
    type: 'long-string',
    value: 'option2',
    label: 'Pick a value',
    allowed_values: [
      { display_name: 'Option 1', short_desc: 'The first option', value: { type: 'string', value: 'option1' } },
      { display_name: 'Option 2', short_desc: 'The second option', value: { type: 'string', value: 'option2' } },
      { display_name: 'Option 3', short_desc: 'The third option', value: { type: 'string', value: 'option3' } },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const checkboxes = canvas.getAllByRole('checkbox');
    await expect(checkboxes.length).toBe(3);
    // option2 is pre-selected
    await expect(checkboxes[1]).toBeChecked();
    // click option2 again to deselect it
    await checkboxes[1].click();
    await expect(checkboxes[1]).not.toBeChecked();
  },
};

export const WithAllowedValuesMany: Story = {
  args: {
    type: 'long-string',
    value: 'option3',
    label: 'Pick a value',
    allowed_values: [
      { display_name: 'Option 1', value: { type: 'string', value: 'option1' } },
      { display_name: 'Option 2', value: { type: 'string', value: 'option2' } },
      { display_name: 'Option 3', value: { type: 'string', value: 'option3' } },
      { display_name: 'Option 4', value: { type: 'string', value: 'option4' } },
      { display_name: 'Option 5', value: { type: 'string', value: 'option5' } },
      { display_name: 'Option 6', value: { type: 'string', value: 'option6' } },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // > 3 items → SelectFormField dropdown (no textarea — field is hidden)
    await expect(canvas.getByRole('button')).toBeInTheDocument();
    await expect(canvas.getByText('Option 3')).toBeInTheDocument();
  },
};

export const WithCreatable: Story = {
  args: {
    type: 'long-string',
    value: '',
    label: 'Pick or type a value',
    allowed_values_creatable: true,
    allowed_values: [
      { display_name: 'Quick option 1', value: { type: 'string', value: 'quick1' } },
      { display_name: 'Quick option 2', value: { type: 'string', value: 'quick2' } },
      { display_name: 'Quick option 3', value: { type: 'string', value: 'quick3' } },
      { display_name: 'Quick option 4', value: { type: 'string', value: 'quick4' } },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // Field (textarea) is shown first, suggestion picker (button) below it
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};
