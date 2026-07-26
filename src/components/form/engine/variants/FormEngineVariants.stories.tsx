import { ReqoreP, ReqorePanel } from '@qoretechnologies/reqore';
import { Meta, StoryObj } from '@storybook/react-vite';
import { IQorusFormField } from '@qoretechnologies/ts-toolkit';
import { basicFormValue, getBasicFormOptions } from '../__fixtures__/basicFormOptions';
import {
  focusDemoGroupLabels,
  focusDemoInvalid,
  focusDemoValue,
  getFocusDemoOptions,
} from './focusDemo';
import { VariantCalmTable } from './VariantCalmTable';
import { VariantCards } from './VariantCards';
import { VariantFocus } from './VariantFocus';
import { VariantMinimal } from './VariantMinimal';

/**
 * VARIANTS PLAYGROUND for the compact FormEngine read-first view.
 * All four render the SAME schema + values as `Form/Engine/FormEngine › Basic`
 * (the reference screenshot), so the comparison is purely about layout / chrome
 * / UX. Resize the Storybook viewport (or the canvas) to ~390px to check phone.
 * See design/FORM_ENGINE_COMPACT_UX_PLAN.md for the rationale behind each.
 */
const options = getBasicFormOptions();

// Merge declared default_values into the values map so "set via default" fields
// (number=42, bool=true, the file) render as set — matching the real engine.
const values: Record<string, IQorusFormField> = (() => {
  const merged: Record<string, IQorusFormField> = { ...(basicFormValue as any) };
  Object.entries(options).forEach(([name, schema]: [string, any]) => {
    if (!merged[name] && schema?.default_value) merged[name] = schema.default_value;
  });
  return merged;
})();

// Fill the available width (the IDE form panel context); no artificial cap.
// Focus uses the richer demo schema (named groups, a one-of required group,
// complex nested fields) to show full engine parity.
const focusOptions = getFocusDemoOptions();
const focusValues: Record<string, IQorusFormField> = (() => {
  const merged: Record<string, IQorusFormField> = { ...focusDemoValue };
  Object.entries(focusOptions).forEach(([name, schema]: [string, any]) => {
    if (!merged[name] && schema?.default_value) merged[name] = schema.default_value;
  });
  return merged;
})();
const focusConfig = { groupLabels: focusDemoGroupLabels, invalidReasons: focusDemoInvalid };

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: '100%', padding: '16px 32px', boxSizing: 'border-box' }}>{children}</div>
);

const meta = {
  title: 'Form/Engine/FormEngine Variants',
  parameters: { layout: 'fullscreen', chromatic: { viewports: [1440, 390] } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const V1CalmTable: Story = {
  name: '1 · Calm Table',
  parameters: {
    docs: {
      description: {
        story:
          'Renders the "Calm Table" compact-form variant over the shared basic schema — one of four visual candidates for the read-first FormEngine view.',
      },
    },
  },
  render: () => (
    <Frame>
      <VariantCalmTable options={options} values={values} />
    </Frame>
  ),
};

export const V2Cards: Story = {
  name: '2 · Cards',
  parameters: {
    docs: {
      description: {
        story:
          'Renders the "Cards" compact-form variant over the shared basic schema — each field group is a card so the presentation reads as chunked panels.',
      },
    },
  },
  render: () => (
    <Frame>
      <VariantCards options={options} values={values} />
    </Frame>
  ),
};

export const V3Focus: Story = {
  name: '3 · Focus',
  parameters: {
    docs: {
      description: {
        story:
          'Renders the "Focus" compact-form variant over the richer focus-demo schema (named groups, required-group choices) so the variant is compared under full engine parity.',
      },
    },
  },
  render: () => (
    <Frame>
      <VariantFocus options={focusOptions} values={focusValues} config={focusConfig} />
    </Frame>
  ),
};

export const V4Minimal: Story = {
  name: '4 · Minimal',
  parameters: {
    docs: {
      description: {
        story:
          'Renders the "Minimal" compact-form variant over the shared basic schema — the sparest of the four candidates, only labels and values.',
      },
    },
  },
  render: () => (
    <Frame>
      <VariantMinimal options={options} values={values} />
    </Frame>
  ),
};

/** All four stacked, labelled — for a quick scroll-through comparison. */
export const CompareAll: Story = {
  name: '★ Compare all',
  parameters: {
    docs: {
      description: {
        story:
          'Renders all four compact-form variants stacked in a single scroll — the Calm Table, Cards, Focus and Minimal layouts sit under labelled panels so they can be compared side by side.',
      },
    },
  },
  render: () => {
    const items: [string, React.ReactNode][] = [
      ['1 · Calm Table', <VariantCalmTable key='v1' options={options} values={values} />],
      ['2 · Cards', <VariantCards key='v2' options={options} values={values} />],
      ['3 · Focus', <VariantFocus key='v3' options={focusOptions} values={focusValues} config={focusConfig} />],
      ['4 · Minimal', <VariantMinimal key='v4' options={options} values={values} />],
    ];
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16, display: 'flex', flexFlow: 'column', gap: 28 }}>
        {items.map(([label, node]) => (
          <ReqorePanel key={label} label={label} flat minimal collapsible>
            <div style={{ padding: 8 }}>{node}</div>
          </ReqorePanel>
        ))}
        <ReqoreP size='small' effect={{ opacity: 0.5 }}>
          Same data as “FormEngine › Basic”. Resize the viewport to ~390px to test phone layout.
        </ReqoreP>
      </div>
    );
  },
};
