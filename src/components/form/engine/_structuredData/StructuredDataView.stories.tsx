import { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/test';
import { _testsWaitForText } from '../../../../stories/Tests/utils';
import { StructuredDataView } from './StructuredDataView';

// Dev story for the engine's structured-data renderer (internal — the compact
// hash preview and the hash edit card render through it). The generic tree is
// ReQore's `ReqoreDataView`; what this wrapper adds — and what this story
// exercises — are the Qorus-specific seams:
//   1. the UI-encoded value envelope ({type, value, …} → unwrapped scalar),
//   2. the embedded structured-text parser (YAML/JSON inside an opaque
//      string → parsed tree, not raw text),
//   3. the Qorus date format (server timestamp → `YYYY-MM-DD HH:mm:ss.SSS`).
// The payload is a representative workflow order (the IDE order-detail shape).
const ORDER_DATA_SAMPLE = {
  order_id: 'ORD-1002',
  workflow: 'order-process',
  status: 'COMPLETE',
  // 3. Qorus server timestamp (numeric offset, microsecond fraction) —
  //    renders via formatIdeTimestamp; the raw "+02:00" must not leak.
  created: '2026-06-10 09:14:22.512000 +02:00',
  // 1. UI-encoded envelope — must unwrap to the scalar 500, not render as
  //    an "Object · 2 fields" node with type/value sub-rows.
  priority: { type: 'int', value: 500 },
  customer: {
    id: 'CUST-441',
    name: 'Alpha Components',
    tier: 'gold',
    contacts: ['ops@alpha.example', 'billing@alpha.example'],
  },
  line_items: [
    { sku: 'WIDGET-1', qty: 3, unit_price: 19.99, in_stock: true },
    { sku: 'GASKET-7', qty: 12, unit_price: 2.5, in_stock: false },
  ],
  // 2. Embedded YAML in an opaque string — renders as a parsed sub-tree.
  staticdata: '%YAML 1.2\n---\nretries: 3\nbackoff: expo\nendpoints:\n  - primary\n  - fallback\n',
  flags: ['priority', 'reconciled'],
  amount: 75000,
  currency: 'EUR',
};

const meta: Meta<typeof StructuredDataView> = {
  component: StructuredDataView,
  title: 'Form/Engine/StructuredDataView',
  parameters: { chromatic: { disable: true } },
};

export default meta;
type Story = StoryObj<typeof StructuredDataView>;

// Nested objects/lists collapse to "Object · N fields" / "List · N items",
// scalar lists inline as chips, dates/numbers are type-coloured.
export const WorkflowOrderData: Story = {
  args: {
    value: ORDER_DATA_SAMPLE,
    collapsibleRoot: false,
    // Expand deep enough that the parsed-YAML sub-tree is visible.
    defaultExpandDepth: 3,
  },
  play: async () => {
    await _testsWaitForText('ORD-1002');
    await _testsWaitForText('order-process');
    await expect(document.querySelectorAll('.reqore-data-view-value').length).toBeGreaterThan(5);

    // 1. Envelope: priority renders as the unwrapped scalar.
    await _testsWaitForText('500');
    // 2. Embedded YAML: parsed tree (keys/values visible), no raw source.
    await _testsWaitForText('retries');
    await _testsWaitForText('expo');
    await expect(document.body.textContent?.includes('%YAML')).toBe(false);
    // 3. Qorus date → `YYYY-MM-DD HH:mm:ss.SSS`. The hour is rendered in the
    //    viewer's zone, so only the zone-invariant tail is pinned; the `$`
    //    anchor means the RAW form (`…512000 +02:00`) cannot satisfy it.
    await _testsWaitForText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:22\.512$/);
    await expect(document.body.textContent?.includes('+02:00')).toBe(false);
  },
};
