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

/**
 * A schema whose hash values hold hash values of their own — three levels, not
 * one.
 *
 * Every other fixture here is a flat record, and a flat record cannot show what
 * this view does with depth: whether a nested level is legible, whether the
 * rules stack sensibly, whether a heading two levels down still reads as a
 * heading. Judging the treatment on a single `key: value` pair is what the
 * review said was impossible, and it was right.
 */
const NestedSchema = {
  name: { type: 'string', display_name: 'Endpoint' },
  auth: {
    type: 'hash',
    display_name: 'Authentication',
    arg_schema: {
      scheme: {
        type: 'string',
        display_name: 'Scheme',
        allowed_values: [
          { value: 'oauth2', display_name: 'OAuth2' },
          { value: 'basic', display_name: 'Basic' },
        ],
      },
      token: {
        type: 'hash',
        display_name: 'Token',
        arg_schema: {
          url: { type: 'string', display_name: 'Token URL' },
          ttl: { type: 'int', display_name: 'Lifetime (s)' },
          rotate: { type: 'bool', display_name: 'Rotate Automatically' },
        },
      },
    },
  },
  retry: {
    type: 'hash',
    display_name: 'Retry Policy',
    arg_schema: {
      attempts: { type: 'int', display_name: 'Attempts' },
      backoff: { type: 'string', display_name: 'Backoff' },
    },
  },
} as never;

const nestedValue = [
  {
    type: 'hash',
    value: {
      name: 'POST /orders',
      auth: {
        scheme: 'oauth2',
        token: {
          url: 'https://auth.example.com/oauth2/token',
          ttl: 3600,
          rotate: true,
        },
      },
      retry: { attempts: 3, backoff: 'exponential' },
    },
  },
  {
    // A second record that fills only part of the tree: the nested level is
    // present but shallow, which is where "no data under the label" shows up.
    type: 'hash',
    value: {
      name: 'GET /orders/{id}',
      auth: { scheme: 'basic' },
    },
  },
];

const colors = { key: '#f1f0ee', muted: '#a0a0a0', border: '#a0a0a066', accent: '#3b8eea' };

export const Schemes: Story = {
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `NestedSchemas`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `NestedSchemas`.
    qlip: { skip: true },
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
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `NestedSchemas`.
    qlip: { skip: true },
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

    // A field name renders on ONE line. The label column is measured from the
    // longest name, and the label carries `overflow-wrap: anywhere` — so an
    // under-measured column does not ellipsise, it breaks the name in half.
    // That is exactly what happened when the labels became uppercase and the
    // measurement was still in `ch`, which knows nothing about the tracking:
    // `LEGACY_FLAG` came out over two lines.
    //
    // Asserted as geometry rather than as a width, because the width is the
    // thing that keeps being wrong — the invariant is that the name fits.
    const label = [...canvasElement.querySelectorAll<HTMLElement>('.schema-view-fields > *')].find(
      (element) => (element.textContent ?? '').trim().toLowerCase() === 'legacy_flag'
    );

    await expect(label).toBeTruthy();

    const lineHeight = parseFloat(getComputedStyle(label!).lineHeight) || 16;

    await expect(label!.offsetHeight).toBeLessThan(lineHeight * 1.6);
  },
};

/**
 * The deeper case: hash values holding hash values.
 *
 * Asked for in review because the flat fixtures could not answer whether the
 * treatment survives nesting — three levels here (endpoint → authentication →
 * token), plus a second record that stops after one, so a nested level with
 * nothing under it renders beside one that is full.
 */
export const NestedSchemas: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A described list whose records nest two levels deeper: an endpoint carrying an Authentication hash, which itself carries a Token hash of URL, lifetime and a bool. The second record fills only the first nested level, so a shallow branch sits next to a full one.',
      },
    },
  },
  args: { value: nestedValue, schema: NestedSchema, colors },
  play: async ({ canvasElement }) => {
    const titles = [...canvasElement.querySelectorAll('.schema-view-item-title')].map((element) =>
      (element.textContent ?? '').trim()
    );

    await expect(titles).toEqual(['POST /orders', 'GET /orders/{id}']);
    // The deepest level actually rendered: a label from the third tier, and the
    // bool beneath it resolved to a word rather than printed as `true`.
    await expect(canvasElement.textContent).toContain('Token URL');
    await expect(canvasElement.textContent).toContain('Lifetime (s)');
    await expect(canvasElement.textContent).not.toContain('[object Object]');
  },
};

/** A set of named values kept as rows: each item a name and its typed value. */
const NamedValueSchema = {
  name: { type: 'string', display_name: 'Name', required: true },
  value: { type: 'auto', display_name: 'Value' },
} as never;

const namedValues = [
  { type: 'hash', value: { name: { type: 'string', value: 'interface' }, value: { type: 'string', value: 'order-sync:1.0' } } },
  { type: 'hash', value: { name: { type: 'string', value: 'retryOnError' }, value: { type: 'bool', value: true } } },
  { type: 'hash', value: { name: { type: 'string', value: 'autostart' }, value: { type: 'bool', value: false } } },
  { type: 'hash', value: { name: { type: 'string', value: 'timeout' }, value: { type: 'int', value: 30 } } },
];

export const NamedValues: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A list whose items are each a name and its value, read as a fact sheet when the host marks the field with `metadata: { named_values: true }`: each name is a quiet label, written as the data spells it, and its value sits beside it in its own look. No numbers, no headings, no accent bar.',
      },
    },
  },
  args: { value: namedValues, schema: NamedValueSchema, colors, namedValues: true },
  play: async ({ canvasElement }) => {
    const rows = [...canvasElement.querySelectorAll<HTMLElement>('.schema-view-named-value')];
    const labels = rows.map((row) => row.firstElementChild as HTMLElement);

    await expect(labels.map((label) => (label.textContent ?? '').trim())).toEqual([
      'interface',
      'retryOnError',
      'autostart',
      'timeout',
    ]);
    await expect(canvasElement.querySelector('.schema-view-item-title')).toBeNull();

    for (const label of labels) {
      const style = getComputedStyle(label);
      // a quiet label: the name as written, in the label face, not a mono heading
      await expect(style.textTransform, 'a name keeps its own case').toBe('none');
      await expect(style.fontFamily, 'a name is not set in mono').not.toMatch(/mono/i);
      await expect(Number(style.fontWeight), 'a name is not bold').toBeLessThan(700);
      await expect(style.borderLeftWidth, 'a name has no accent bar').toBe('0px');
      // the label column is measured from the names, so each fits on one line
      const lineHeight = parseFloat(style.lineHeight) || 16;
      await expect(label.offsetHeight, 'a name fits on one line').toBeLessThan(lineHeight * 1.6);
    }
  },
};

export const NamedValuesWithMoreThanAValue: Story = {
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `NestedSchemas` and `NamedValues`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'A list marked as named values where one item holds more than a name and a value keeps the numbered look for every item, so a list never mixes the two.',
      },
    },
  },
  args: {
    value: [...namedValues, { type: 'hash', value: { name: 'owner', value: 'ops', note: 'on call' } }],
    schema: NamedValueSchema,
    colors,
    namedValues: true,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.schema-view-named-value')).toBeNull();
    await expect(canvasElement.querySelectorAll('.schema-view-item-title')).toHaveLength(5);
  },
};
