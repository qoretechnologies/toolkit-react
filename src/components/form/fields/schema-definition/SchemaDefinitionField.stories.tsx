import { SIZE_TO_PX } from '@qoretechnologies/reqore/dist/constants/sizes';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';

import { withCoarsePointer } from '../../../../stories/coarsePointer';
import { withTouchScreen } from '../../../../stories/touchScreen';
import { PHONE_VIEWPORT } from '../../../../stories/tracking';
import { StoryMeta } from '../../../../types';
import { FormEngine } from '../../engine/FormEngine';
import { FormField } from '../Field';
import { SchemaDefinitionEditor } from './index';
import { mockSchemaCatalog, mockSchemaCatalogSandboxed } from './mockCatalog';
import { mockPopulatedDefinition } from './mockDefinition';
import { createStarterDefinition } from './starterTemplate';
import { IDataSchemaDefinition } from './types';

const meta = {
  component: SchemaDefinitionEditor,
  title: 'Components/Form/SchemaDefinition',
  args: {
    onChange: fn(),
    // Inject the catalogue directly — no server round-trip in stories.
    catalogOverride: mockSchemaCatalog,
  },
  render(args) {
    const [value, setValue] = useState<IDataSchemaDefinition | undefined>(args.value);
    return (
      <SchemaDefinitionEditor
        {...args}
        value={value}
        onChange={(v) => {
          args.onChange?.(v);
          setValue(v);
        }}
      />
    );
  },
} as StoryMeta<typeof SchemaDefinitionEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty definition — the catalogue drives the full tab set. */
export const Empty: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Renders the SchemaDefinition editor with no existing value — the Schema, Tables, Sequences and Migrations tabs mount straight from the catalog.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // Tabs come straight from the catalogue's `definition` sections.
    await expect(await canvas.findByText('Schema')).toBeInTheDocument();
    await expect(canvas.getByText('Tables')).toBeInTheDocument();
    await expect(canvas.getByText('Sequences')).toBeInTheDocument();
    await expect(canvas.getByText('Migrations')).toBeInTheDocument();
    // The form rows fade in after the chrome — wait for the Schema tab's own
    // catalogue rows, or the capture shows empty shells where the form goes
    // (rejected on build #123 for exactly that).
    await expect(await canvas.findByText('Schema Name')).toBeInTheDocument();
    await expect(await canvas.findByText('Version')).toBeInTheDocument();
  },
};

// Computed outside the story object (convention: no top-level function
// calls in `args`).
const starterDefinition = createStarterDefinition('example_schema');

/** The one-table starter seed the IDE's Empty story opens with. */
export const Starter: Story = {
  args: {
    value: starterDefinition,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the SchemaDefinition editor seeded with the "example_schema" starter template — the Schema tab shows the single scaffolded table.',
      },
    },
  },
};

/** A realistic populated schema — two tables, sequence, reference data, migrations. */
export const Populated: Story = {
  args: {
    value: mockPopulatedDefinition,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the SchemaDefinition editor with the populated fixture. Opening the Tables tab shows the customers and addresses tables.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // Open the Tables tab → the two table panels render from the value.
    await userEvent.click(await canvas.findByText('Tables'));
    await expect(await canvas.findByText('customers')).toBeInTheDocument();
    await expect(canvas.getByText('addresses')).toBeInTheDocument();
  },
};

/** Read-only viewer — every input becomes a typeset display row. */
export const ReadOnly: Story = {
  args: {
    value: mockPopulatedDefinition,
    readOnly: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the SchemaDefinition editor with readOnly enabled — every input becomes a typeset display row and no inputs, textareas or selects are rendered.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Schema')).toBeInTheDocument();
    // Read-only renders typeset rows — never disabled inputs (IDE parity).
    await expect(canvasElement.querySelectorAll('input, textarea, select')).toHaveLength(0);
  },
};

/** Catalogue fetch failure → a blocking callout instead of a form. */
export const CatalogError: Story = {
  args: {
    catalogError: 'Schema options are unavailable on this server.',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the SchemaDefinition editor when the catalog fetch fails — a "Could not load schema options" callout replaces the form.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Could not load schema options')).toBeInTheDocument();
  },
};

/**
 * Dispatcher exposure: rendered through `FormField` with
 * `type="schema-definition"`, the way a schema's `definition` field is
 * wired. `catalogOverride` rides in via `fieldProps`.
 */
export const ViaFormField: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the SchemaDefinition editor through the FormField dispatcher (type="schema-definition"). The catalog is injected via fieldProps and the Schema and Tables tabs mount as usual.',
      },
    },
  },
  render: () => {
    const [value, setValue] = useState<IDataSchemaDefinition | undefined>(mockPopulatedDefinition);
    return (
      <FormField
        type={'schema-definition' as any}
        value={value}
        onChange={(v) => setValue(v as IDataSchemaDefinition)}
        fieldProps={{ catalogOverride: mockSchemaCatalog }}
      />
    );
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Schema')).toBeInTheDocument();
    await expect(canvas.getByText('Tables')).toBeInTheDocument();
  },
};

/**
 * The `ui_type` path: a `FormEngine` schema with an option declared
 * `ui_type: 'schema-definition'` renders the editor, the way a schema's
 * `definition` field is wired in a server-driven form. `catalogOverride`
 * rides through `fieldProps` (FormEngine spreads the option → TemplateField
 * → FormField → SchemaDefinitionEditor).
 */
export const ViaFormEngineUiType: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a FormEngine schema whose "definition" option declares ui_type: schema-definition — FormEngine flows through TemplateField and FormField and mounts the schema editor with the injected catalog.',
      },
    },
  },
  render: () => {
    const [value, setValue] = useState<any>({
      definition: { type: 'hash', value: mockPopulatedDefinition },
    });
    return (
      <FormEngine
        name='schemaForm'
        options={
          {
            definition: {
              type: 'hash',
              ui_type: 'schema-definition',
              display_name: 'Definition',
              preselected: true,
              supports_templates: false,
              fieldProps: { catalogOverride: mockSchemaCatalog },
            },
          } as any
        }
        value={value}
        onChange={(_n, v) => setValue(v)}
      />
    );
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // The full FormEngine mount can push the editor's first paint past the
    // 1s default findBy timeout — give it the house-standard 10s.
    await expect(await canvas.findByText('Schema', undefined, { timeout: 10000 })).toBeInTheDocument();
    await expect(canvas.getByText('Tables')).toBeInTheDocument();
  },
};

/**
 * Ported from qorus-ide `stories/Fields/SchemaDefinition.stories.tsx`
 * (FIELD_STACK_REPORT batch): a sandboxed (untrusted) caller — the Advanced
 * tab and every trusted-only section / option are hidden.
 */
export const Sandboxed: Story = {
  args: {
    catalogOverride: mockSchemaCatalogSandboxed,
    accessLevel: 'untrusted',
    wrapperName: 'example_customer_addresses',
    value: mockPopulatedDefinition,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the SchemaDefinition editor for an untrusted (sandboxed) caller using the sandboxed catalog — the Advanced tab and every trusted-only section are hidden.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Migrations')).toBeInTheDocument();
    // The Advanced tab must not render for sandboxed callers.
    await expect(canvas.queryByText('Advanced')).not.toBeInTheDocument();
  },
};

/**
 * Ported from qorus-ide: the DataSchema name does not match the interface
 * name — the inline banner flags it and "Sync name" resolves the mismatch.
 */
export const WithValidationBanner: Story = {
  args: {
    catalogOverride: mockSchemaCatalog,
    wrapperName: 'renamed_schema',
    value: mockPopulatedDefinition,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the SchemaDefinition editor when the wrapper interface name and the DataSchema name differ — the "name does not match" banner is shown, and clicking "Sync name" resolves the mismatch.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // The banner renders the mismatch both as its title and its body text.
    await waitFor(() =>
      expect(canvas.queryAllByText(/name does not match/).length).toBeGreaterThan(0)
    );
    await userEvent.click(canvas.getByText('Sync name'));
    await waitFor(() =>
      expect(canvas.queryAllByText(/name does not match/)).toHaveLength(0)
    );
  },
};

/** A table's section tab, by the name it shows (its count badge aside). */
const sectionTab = (canvasElement: HTMLElement, name: string) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[class*="reqore-tabs-list-item"]')).find(
    (tab) => tab.textContent?.trim().replace(/\d+$/, '') === name
  );

export const SectionsDescribedOnATouchScreen: Story = {
  tags: ['touch'],
  args: {
    value: mockPopulatedDefinition,
  },
  decorators: [withCoarsePointer],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          "Renders the populated SchemaDefinition editor on a phone (390 px, touch), with the customers table open. A tap on its Primary Key tab only switches to it, and no card opens. The section's ⓘ, a size a finger can hit, opens what Primary Key is for (\"Table primary key\"), which stays on the screen.",
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await withTouchScreen(async (touch) => {
      await touch.tap(await canvas.findByText('Tables'));
      await touch.tap(await canvas.findByText('customers'));
      // the table open, its columns drawn: what a finger waits for before it reaches for a tab
      await canvas.findByText('Add column');
      const primaryKey = await waitFor(() => {
        const tab = sectionTab(canvasElement, 'Primary Key');
        expect(tab).toBeTruthy();
        return tab!;
      });
      await touch.tap(primaryKey);
      const info = await waitFor(() => {
        const button = canvasElement.querySelector<HTMLElement>(
          '.reqraft-described-tab [aria-label="About Primary Key"]'
        );
        expect(button).toBeVisible();
        return button!;
      });
      // the tab: switched, and nothing else
      await expect(document.querySelector('.reqore-popover-content')).toBeNull();
      // a finger can hit it: no smaller than Reqore's small control
      await expect(info.getBoundingClientRect().height).toBeGreaterThanOrEqual(SIZE_TO_PX.small);
      await touch.tap(info);
      const card = await waitFor(() => {
        const shown = Array.from(document.querySelectorAll<HTMLElement>('.reqore-popover-content')).find(
          (each) => each.textContent?.includes('Table primary key')
        );
        expect(shown).toBeTruthy();
        return shown!;
      });
      if (touch.narrowed) {
        const box = card.getBoundingClientRect();
        await expect(box.left).toBeGreaterThanOrEqual(0);
        await expect(box.right).toBeLessThanOrEqual(window.innerWidth);
      }
    });
  },
};
