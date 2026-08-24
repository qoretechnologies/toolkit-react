import { ReqoreControlGroup, ReqoreP, ReqorePanel } from '@qoretechnologies/reqore';
import { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import styled from 'styled-components';
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

/* ------------------------------------------------------------------------- *
 * Heading-emphasis prototypes
 *
 * The identifying value is the thing a reader scans for, and size alone was not
 * carrying it far enough. These render the SAME data under candidate
 * treatments, side by side, so the choice is made by looking rather than by
 * describing.
 *
 * The overrides live in the story, NOT in the component: this is a comparison,
 * and only the winner should reach `SchemaDataView`. Raw colours are used here
 * for the same reason — a prototype is allowed to be literal, but the shipped
 * version takes its colour from a Reqore intent (see BRAND_DESIGN §1: colour
 * meaning comes from intents, emphasis from effects, never per-app hex).
 * ------------------------------------------------------------------------- */

const StyledVariant = styled.div`
  /* B — tinted background: the heading sits on its own surface. */
  &.variant-background .schema-view-item-title {
    display: inline-block;
    background: #ffffff0f;
    border-radius: 4px;
    padding: 1px 8px;
    margin-left: -8px;
  }

  /* C — indented rows: the heading keeps the left edge to itself, and the
     supporting fields step in under it. Costs no colour at all. */
  &.variant-indent .schema-view-fields {
    padding-left: 14px;
  }

  /* D — accent bar: a rule of its own beside the heading, in the app's accent.
     Sanctioned emphasis (BRAND_DESIGN §1 names accent bars explicitly). */
  &.variant-accent .schema-view-item-title {
    border-left: 3px solid #7c5cff;
    padding-left: 8px;
    margin-left: -11px;
  }

  /* E — everything: accent bar + tinted surface + indented rows. */
  &.variant-all .schema-view-item-title {
    display: inline-block;
    background: #7c5cff1f;
    border-left: 3px solid #7c5cff;
    border-radius: 0 4px 4px 0;
    padding: 1px 8px;
    margin-left: -11px;
  }
  &.variant-all .schema-view-fields {
    padding-left: 14px;
  }

  /* F — colour only, applied as a FILL behind the text rather than to the text
     itself: an intent used as text fails contrast (a muted label reads at
     1.3:1), which is why this is a chip and not a coloured word. */
  &.variant-tint .schema-view-item-title {
    display: inline-block;
    background: #2e7d5b33;
    border-radius: 4px;
    padding: 1px 8px;
    margin-left: -8px;
  }
`;

const VARIANTS: { key: string; label: string; note: string }[] = [
  { key: 'variant-none', label: 'A — shipped treatment', note: 'accent bar + tinted fill + indented rows' },
  { key: 'variant-indent', label: 'B — indent the rows', note: 'no colour; heading owns the edge' },
  { key: 'variant-background', label: 'C — neutral fill', note: 'white 6% chip behind the name' },
  { key: 'variant-accent', label: 'D — accent bar', note: 'brand bar beside the name' },
  { key: 'variant-tint', label: 'E — coloured fill', note: 'intent as a FILL, never as text' },
  { key: 'variant-all', label: 'F — bar + fill + indent', note: 'all three together' },
];

export const HeadingEmphasisPrototypes: Story = {
  parameters: {
    // Six variants stacked do not fit the default 720px capture, and a
    // comparison you have to scroll is not a comparison. Qlip's capture viewport
    // is a separate setting from Storybook's preview viewport, so it is pinned
    // here explicitly — setting only the preview one yields a full-height story
    // and a cropped snapshot.
    qlip: { viewport: { width: 1280, height: 1100 } },
    docs: {
      description: {
        story:
          'Candidate treatments for the item heading, rendered over identical data so they can be compared directly. A prototype surface — only the chosen treatment is meant to reach the component.',
      },
    },
  },
  // Two items per variant, not three: six stacked variants have to fit one
  // screen or they cannot be compared at a glance, which is the whole point.
  args: { value: methodValue.slice(0, 2), schema: MethodSchema, colors },
  render: (args) => (
    <ReqoreControlGroup vertical fluid gapSize='big'>
      {VARIANTS.map((variant) => (
        <ReqorePanel key={variant.key} label={variant.label} minimal flat padded size='small'>
          <ReqoreP size='small' effect={{ opacity: 0.6 }} style={{ marginBottom: 6 }}>
            {variant.note}
          </ReqoreP>
          <StyledVariant className={variant.key}>
            <SchemaDataView {...args} />
          </StyledVariant>
        </ReqorePanel>
      ))}
    </ReqoreControlGroup>
  ),
  play: async ({ canvasElement }) => {
    // Every variant renders the same three items — the comparison is only
    // meaningful if none of the treatments changed the content.
    await expect(canvasElement.querySelectorAll('.schema-view-item-title')).toHaveLength(
      VARIANTS.length * 2
    );
  },
};
