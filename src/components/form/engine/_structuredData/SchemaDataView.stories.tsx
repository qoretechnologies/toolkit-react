import { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { SchemaDataView } from './SchemaDataView';

/**
 * The read-only rendering of a value described by an `arg_schema`.
 *
 * Rendered directly here rather than through a whole FormEngine: these stories
 * are about what the VIEW does with a described value, and mounting a form
 * around it only adds chrome that the form's own stories already cover.
 */
const meta: Meta<typeof SchemaDataView> = {
  title: 'Form/Engine/SchemaDataView',
  component: SchemaDataView,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Auth-profile schemes: the first field is a CHOICE, so its heading is prose. */
const SchemeSchema = {
  type: {
    type: 'string',
    display_name: 'Scheme Type',
    allowed_values: [
      { value: 'default', display_name: 'Default RBAC' },
      { value: 'cookie', display_name: 'Cookie' },
    ],
  },
  cookie_name: { type: 'string', display_name: 'Session Cookie Name' },
  redirect_url: { type: 'string', display_name: 'Redirect URL' },
} as never;

const schemeValue = [
  { type: 'hash', value: { type: 'default' } },
  {
    type: 'hash',
    value: {
      type: 'cookie',
      cookie_name: 'qorus-session',
      redirect_url: 'https://example.com/login',
    },
  },
];

/** Service methods: the first field is a LITERAL, so its heading is mono. */
const MethodSchema = {
  name: { type: 'string', display_name: 'Method Name' },
  desc: { type: 'string', display_name: 'Description' },
} as never;

const methodValue = [
  { type: 'hash', value: { name: 'init', desc: 'init method' } },
  { type: 'hash', value: { name: 'onOrderStatus', desc: 'returns the status of a single order' } },
  { type: 'hash', value: { name: 'onConnect', desc: 'connection lifecycle hook' } },
];

const colors = { key: '#f1f0ee', muted: '#a0a0a0', border: '#a0a0a066', accent: '#3b8eea' };

export const Schemes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A described list whose identifying field is a choice — each item is headed by the display name of that choice, in prose.',
      },
    },
  },
  args: { value: schemeValue, schema: SchemeSchema, colors },
  play: async ({ canvasElement }) => {
    const titles = [...canvasElement.querySelectorAll('.schema-view-item-title')].map((element) =>
      (element.textContent ?? '').trim()
    );
    await expect(titles).toEqual(['Default RBAC', 'Cookie']);
  },
};

export const ServiceMethods: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A described list whose identifying field is a literal — each item is headed by the method's name, which keeps the mono face it has as a value.",
      },
    },
  },
  args: { value: methodValue, schema: MethodSchema, colors },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('.schema-view-item-title')).toHaveLength(3);
  },
};

export const Undescribed: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Keys the schema does not describe are still shown, under their raw name, after the described ones — a preview that dropped data would be worse than a raw tree.',
      },
    },
  },
  args: {
    value: [{ type: 'hash', value: { type: 'cookie', legacy_flag: 'kept' } }],
    schema: SchemeSchema,
    colors,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toContain('legacy_flag');
  },
};
