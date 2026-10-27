// Copyright 2026 Qore Technologies, s.r.o.
import { StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { buildTemplates } from '../../../../helpers/templates';
import {
  ITemplateCatalogueRow,
  ITemplateNode,
  templateTree,
} from '../../../../helpers/templateTree';
import { withCoarsePointer } from '../../../../stories/coarsePointer';
import {
  pickerCrumbs,
  pickerFocused,
  pickerLabels,
  pickerRow,
  pickerSearch,
} from '../../../../stories/templatePicker';
import { withTouchScreen } from '../../../../stories/touchScreen';
import { PHONE_VIEWPORT } from '../../../../stories/tracking';
import { StoryMeta } from '../../../../types';
import {
  CONTEXT_DATA_PAYLOAD,
  QOG_FIELD_TEMPLATES,
  RECORD_FIELDS,
} from './__fixtures__/qogTemplatePayloads';
import { TemplatePicker } from './TemplatePicker';

interface ITemplatePickerStoryArgs {
  templates?: { items?: unknown[] };
  fields?: typeof RECORD_FIELDS;
  onPick?: (value: string) => void;
  focusFilter?: boolean;
}

/** The picker as a host opens it, and what was picked last under it. */
const TemplatePickerStory = ({
  templates,
  fields,
  onPick,
  focusFilter = true,
}: ITemplatePickerStoryArgs) => {
  const roots = useMemo(() => templateTree(templates, { fields }), [templates, fields]);
  const [picked, setPicked] = useState<string>();
  return (
    <div style={{ padding: 16 }}>
      <TemplatePicker
        id='story-template-picker'
        roots={roots}
        focusFilter={focusFilter}
        onPick={(node: ITemplateNode, written?: string) => {
          const value = written ?? node.value;
          setPicked(value);
          onPick?.(value);
        }}
      />
      <p className='story-picked'>{picked ? `Picked: ${picked}` : 'Nothing picked'}</p>
    </div>
  );
};

const meta = {
  component: TemplatePickerStory,
  title: 'Components/Form/TemplatePicker',
  args: { templates: QOG_FIELD_TEMPLATES, fields: RECORD_FIELDS, onPick: fn() },
} as StoryMeta<typeof TemplatePickerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The top of a Qog field's templates: its context data, each state before it, and the record's fields. */
export const QogTemplates: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The picker at the top of a Qog field's templates: Context Data, Look up customer, Receive order and " +
          'Record fields, each a group that opens into its members; a state says it is State data.',
      },
    },
  },
  play: async () => {
    await waitFor(() =>
      expect(pickerLabels()).toEqual([
        'Context Data',
        'Look up customer',
        'Receive order',
        'Record fields',
      ])
    );
    expect((await pickerRow('Receive order')).textContent).toContain('State data');
  },
};

/** A group opened level by level, the way back above the rows, and back again. */
export const DrillDownAndBack: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Opens Receive order, then Customer, then Address: the way back reads Templates › Receive order › ' +
          'Customer › Address. Back goes up to Customer; the crumb Templates goes back to the top.',
      },
    },
  },
  play: async () => {
    await userEvent.click(await pickerRow('Receive order'));
    await userEvent.click(await pickerRow('Customer'));
    await userEvent.click(await pickerRow('Address'));
    await waitFor(() => expect(pickerCrumbs()).toBe('Templates› Receive order› Customer› Address'));
    expect(pickerLabels()).toEqual(['City', 'ZIP code']);
    await userEvent.click(document.querySelector<HTMLElement>('.template-picker-back')!);
    await waitFor(() => expect(pickerLabels()).toEqual(['Address', 'Name']));
    const top = Array.from(document.querySelectorAll<HTMLElement>('.template-picker-crumb')).find(
      (crumb) => crumb.textContent === 'Templates'
    )!;
    await userEvent.click(top);
    await waitFor(() => expect(pickerLabels()).toContain('Context Data'));
  },
};

/** A search finds a template at any depth by its name, and says where it is. */
export const SearchReachesDeepPaths: Story = {
  args: { onPick: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Types "zip" in the search box at the top: ZIP code is found, in Receive order › Customer › Address, and ' +
          'picked with Enter.',
      },
    },
  },
  play: async ({ args }) => {
    const search = await pickerSearch();
    await userEvent.type(search, 'zip');
    const zip = await pickerRow('ZIP code');
    expect(pickerLabels()).toEqual(['ZIP code']);
    expect(zip.textContent).toContain('in Receive order › Customer › Address');
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(args.onPick).toHaveBeenLastCalledWith('$data:{receive_order.customer.address.zip}')
    );
  },
};

/** A search in a group searches the group, and can search everywhere. */
export const SearchInAGroupOrEverywhere: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Opens Look up customer and searches "customer": only Customer ID, the group\'s own. "Search everywhere" ' +
          'finds the state Look up customer itself and Customer, the record in Receive order (a group found is ' +
          'listed, not its members beside it).',
      },
    },
  },
  play: async () => {
    await userEvent.click(await pickerRow('Look up customer'));
    const search = await pickerSearch();
    await userEvent.type(search, 'customer');
    await waitFor(() => expect(pickerLabels()).toEqual(['Customer ID']));
    await userEvent.click(document.querySelector<HTMLElement>('.template-picker-scope')!);
    await waitFor(() => expect(pickerLabels()).toEqual(['Look up customer', 'Customer']));
  },
};

/** The keyboard alone: the arrows move, → opens, ← goes back, Enter picks, in the search box as in the rows. */
export const KeyboardOnly: Story = {
  args: { onPick: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'From the search box, with the keyboard only: ↓ ↓ → opens Receive order, ← goes back to it at the top, ' +
          '→ again and ↓ Enter picks Event type.',
      },
    },
  },
  play: async ({ args }) => {
    const search = await pickerSearch();
    await userEvent.click(search);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
    await waitFor(() => expect(pickerCrumbs()).toContain('Receive order'));
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(pickerFocused()).toBe('Context Data'));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(args.onPick).toHaveBeenLastCalledWith('$data:{receive_order.event_type}')
    );
  },
};

/** A large group is paged: its first rows, and "Show more". */
export const ALargeGroupIsPaged: Story = {
  args: {
    templates: {
      items: [
        {
          label: 'Big record',
          items: Array.from({ length: 120 }, (_, index) => ({
            label: `Field ${String(index + 1).padStart(3, '0')}`,
            value: `$data:{big.field_${index + 1}}`,
            badge: 'string',
          })),
        },
        { label: 'Other', items: [{ label: 'One', value: '$local:one' }] },
      ],
    },
    fields: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opens a group of 120 templates: it shows the first 50 and "Show 50 more of 70"; pressed, 100 are shown. ' +
          'A search reaches all of them: "Field 119" finds it.',
      },
    },
  },
  play: async () => {
    await userEvent.click(await pickerRow('Big record'));
    await waitFor(() => expect(pickerLabels()).toHaveLength(50));
    const more = document.querySelector<HTMLElement>('.template-picker-more')!;
    expect(more.textContent).toContain('Show 50 more of 70');
    await userEvent.click(more);
    await waitFor(() => expect(pickerLabels()).toHaveLength(100));
    const search = await pickerSearch();
    await userEvent.type(search, 'Field 119');
    await waitFor(() => expect(pickerLabels()).toEqual(['Field 119']));
  },
};

/** A group whose members its host gives only when asked: they are asked for when it is opened. */
export const MembersLoadedWhenOpened: Story = {
  args: {
    templates: {
      items: [
        {
          label: 'Slow state',
          loadItems: () =>
            new Promise<ITemplateCatalogueRow[]>((resolve) =>
              setTimeout(
                () =>
                  resolve([
                    { label: 'Loaded value', value: '$data:{slow.loaded}', badge: 'string' },
                  ]),
                300
              )
            ),
        },
        { label: 'Other', items: [{ label: 'One', value: '$local:one' }] },
      ],
    },
    fields: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Opens Slow state, whose host gives its members only when asked: the picker says Loading… and then ' +
          'lists Loaded value.',
      },
    },
  },
  play: async () => {
    await userEvent.click(await pickerRow('Slow state'));
    await waitFor(() => expect(pickerLabels()).toEqual(['Loaded value']));
  },
};

/** The picker at a phone's width: as wide as the screen less its margins, tall rows for a finger. */
export const OnAPhone: Story = {
  tags: ['touch'],
  args: { templates: buildTemplates(CONTEXT_DATA_PAYLOAD), fields: undefined, onPick: fn() },
  decorators: [withCoarsePointer],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'The picker on a phone (390 px, touch): it fits the screen less 16px each side, each row is at least ' +
          '44px tall, and a tap picks a row.',
      },
    },
  },
  play: async ({ args }) => {
    await withTouchScreen(async (touch) => {
      const row = await pickerRow('Auth Enabled?');
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      if (touch.narrowed) {
        await waitFor(() => {
          const { left, right } = document
            .querySelector<HTMLElement>('.template-picker')!
            .getBoundingClientRect();
          expect(left).toBeGreaterThanOrEqual(0);
          expect(right).toBeLessThanOrEqual(window.innerWidth);
          expect(right - left).toBeLessThanOrEqual(window.innerWidth - 32 + 1);
          expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
        });
      }
      await touch.tap(row);
    });
    await waitFor(() => expect(args.onPick).toHaveBeenLastCalledWith('$local:auth_enabled'));
  },
};
