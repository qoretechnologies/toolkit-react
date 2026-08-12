import { ReqoreButton, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { ComponentProps, useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { InterfaceReferenceTags } from './InterfaceReferenceTags';
import { IInterfaceReference } from './meta';
import { ReferencePicker, TReferencePickerItem } from './ReferencePicker';
import { TicketReplyBox } from './TicketReplyBox';

/**
 * The interface browser — kinds on one side, the selected kind's interfaces on the
 * other, one search bar scoping both. Rendered **on top** of the composer and toggled
 * by its "Reference interfaces" action. Search dims non-matching kinds rather than
 * removing them, picked interfaces stay in the list as selected rows, and the two panes
 * collapse into one column (with a modal on phones) when there isn't width for both.
 */
const meta = {
  component: ReferencePicker,
  title: 'Components/ReferencePicker',
} as StoryMeta<typeof ReferencePicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const ACCENT = { main: 'custom1' } as const;

/* The kind ids a host passes — wire values, not labels. `qog` is the customer-facing
 * kind for what the instance still lists as `fsm`; hosts map that at the fetch
 * boundary, so `fsm` never reaches the picker. */
const KINDS = [
  'workflow',
  'service',
  'job',
  'connection',
  'mapper',
  'class',
  'value-map',
  'qog',
  'ai-collection',
  'ai-endpoint',
  'ai-guardrail',
];

/* Stands in for the host's fetch: in the IDE these come off the customer's live
 * instance one kind at a time. Services carry the richer item shape — a description
 * and a badge — with `partner-gateway` left as a bare string so the plain row and the
 * mixed list both stay on screen. */
const CATALOGUE: Record<string, TReferencePickerItem[]> = {
  workflow: ['order-sync:1.2', 'invoice-export:2.0', 'partner-recon:1.1'],
  service: [
    {
      name: 'notifier',
      description: 'Fans order events out to email and Slack',
      badge: '3 running',
    },
    { name: 'audit-logger', description: 'Writes every state change to the audit table' },
    'partner-gateway',
  ],
  job: ['nightly-recon', 'cleanup-temp', 'sla-report'],
  connection: ['sftp-partner', 'pgsql-omq', 'salesforce-prod'],
  mapper: ['csv-to-order', 'order-to-invoice'],
  class: ['OrderUtils', 'PartnerApi'],
  'value-map': ['country-codes', 'currency'],
  qog: ['telegram-intake', 'stripe-billing', 'onboarding', 'escalation'],
  'ai-collection': ['kb-support'],
  'ai-endpoint': ['gpt-router'],
  'ai-guardrail': ['pii-filter'],
};

const darkTheme = (Story: () => JSX.Element) => (
  <ReqoreUIProvider theme={{ main: '#121212', intents: { custom1: '#762f7e' } }}>
    <div style={{ padding: 20, background: '#121212' }}>
      <Story />
    </div>
  </ReqoreUIProvider>
);

/** Drives the picker the way a host does: owns the selected kind, resolves that
 *  kind's interfaces, and accumulates what gets picked. */
const Hosted = ({
  withComposer,
  initialKind = 'workflow',
  ...pickerProps
}: { withComposer?: boolean; initialKind?: string } & Partial<
  ComponentProps<typeof ReferencePicker>
>) => {
  const [kind, setKind] = useState<string>(initialKind);
  const [picked, setPicked] = useState<IInterfaceReference[]>([]);
  const [open, setOpen] = useState<boolean>(true);

  const isPicked = (reference: IInterfaceReference) =>
    picked.some(
      (existing) =>
        existing.interface_kind === reference.interface_kind &&
        existing.interface_name === reference.interface_name
    );

  const picker = (
    <ReferencePicker
      kinds={KINDS}
      kind={kind}
      onKindChange={setKind}
      items={CATALOGUE[kind] ?? []}
      picked={picked}
      onAdd={(reference) =>
        setPicked((current) => (isPicked(reference) ? current : [...current, reference]))
      }
      onRemove={(reference) =>
        setPicked((current) =>
          current.filter(
            (existing) =>
              !(
                existing.interface_kind === reference.interface_kind &&
                existing.interface_name === reference.interface_name
              )
          )
        )
      }
      {...pickerProps}
    />
  );

  if (!withComposer) {
    return picker;
  }

  return (
    <div style={{ maxWidth: 780 }}>
      {open ? <div style={{ marginBottom: 10 }}>{picker}</div> : null}
      <TicketReplyBox
        onSend={fn()}
        placeholder='Write a reply…'
        aboveInput={
          picked.length ? (
            /* Composer chips are the references you're about to send, so they carry
               their own remove — and read a size up from the thread's, where they're
               a record rather than a control. */
            <InterfaceReferenceTags
              customTheme={ACCENT}
              references={picked}
              onRemove={(reference) =>
                setPicked((current) =>
                  current.filter(
                    (existing) =>
                      !(
                        existing.interface_kind === reference.interface_kind &&
                        existing.interface_name === reference.interface_name
                      )
                  )
                )
              }
            />
          ) : undefined
        }
        footerActions={
          <ReqoreButton
            className='references-toggle'
            icon='LinksLine'
            minimal
            flat
            badge={picked.length || undefined}
            active={open}
            customTheme={ACCENT}
            tooltip={open ? 'Hide references' : 'Reference interfaces'}
            onClick={() => setOpen((shown) => !shown)}
          />
        }
      />
    </div>
  );
};

/*
 * Queried by role, not by text: ReqoreButton renders its label in a pair of spans (an
 * active one and an aria-hidden inactive one) to cross-fade, so getByText matches twice
 * for every button. The accessible name collapses that pair back to one.
 */
const option = (canvas: ReturnType<typeof within>, name: string) =>
  canvas.getByRole('button', { name });
const missingOption = (canvas: ReturnType<typeof within>, name: string) =>
  canvas.queryByRole('button', { name });

/** Picking an interface adds it as a reference and leaves the row in place, selected. */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the two-pane reference browser. Picking an interface adds it as a reference and leaves the row in the list, selected and ticked, rather than removing it.',
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'order-sync:1.2' }));
    // it stays in the pane, now selected
    await waitFor(() =>
      expect(option(canvas, 'order-sync:1.2')).toHaveClass('reqore-reference-picker-picked')
    );
    // its siblings are untouched
    await expect(option(canvas, 'invoice-export:2.0')).toBeInTheDocument();
  },
};

/** A picked interface can be un-picked from the list it was picked in. */
export const DeselectsAPickedInterface: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the browser and picks an interface, then clicks the same row again — the reference comes back off without the user having to click away from the picker.',
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const row = await canvas.findByRole('button', { name: 'invoice-export:2.0' });

    await userEvent.click(row);
    await waitFor(() => expect(row).toHaveClass('reqore-reference-picker-picked'));

    await userEvent.click(row);
    await waitFor(() => expect(row).not.toHaveClass('reqore-reference-picker-picked'));
  },
};

/**
 * Interfaces can arrive as bare names or as objects carrying a description and a
 * badge — a name alone often isn't enough to tell two of them apart. A picked row
 * tints rather than filling solid, so the ones still up for choosing stay the loudest
 * things in the list.
 */
export const WithDescriptionsAndBadges: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a kind whose interfaces carry descriptions and badges alongside one that has neither. Picking a row tints it rather than filling it solid, keeping the unpicked rows the most prominent.',
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted initialKind='service' />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('Fans order events out to email and Slack')
    ).toBeInTheDocument();
    await expect(canvas.getByText('3 running')).toBeInTheDocument();

    // a bare-string item in the same list renders as a plain row
    await expect(option(canvas, 'partner-gateway')).toBeInTheDocument();

    // picking keeps the description and badge in place
    await userEvent.click(canvas.getByRole('button', { name: /audit-logger/ }));
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /audit-logger/ })).toHaveClass(
        'reqore-reference-picker-picked'
      )
    );
    await expect(
      canvas.getByText('Writes every state change to the audit table')
    ).toBeInTheDocument();
  },
};

/** A description is searchable text too, so the search reads it alongside the name. */
export const SearchMatchesDescriptions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders a kind with described interfaces and searches for a word that appears only in a description — the matching row survives even though its name doesn't contain the query.",
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted initialKind='service' />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const search = canvasElement.querySelector(
      'input[placeholder*="Search types"]'
    ) as HTMLInputElement;

    // "Slack" is only in the notifier's description
    await userEvent.type(search, 'slack');
    await waitFor(() => expect(missingOption(canvas, 'partner-gateway')).not.toBeInTheDocument());
    await expect(canvas.getByRole('button', { name: /notifier/ })).toBeInTheDocument();
  },
};

/** Selecting a kind on the left swaps the right pane to that kind's interfaces. */
export const SwitchesKind: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the picker and shows that selecting a kind on the left swaps the right pane to that kind's interfaces.",
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(option(canvas, 'order-sync:1.2')).toBeInTheDocument();
    await userEvent.click(option(canvas, 'Connections'));
    await waitFor(() => expect(option(canvas, 'sftp-partner')).toBeInTheDocument());
    await expect(missingOption(canvas, 'order-sync:1.2')).not.toBeInTheDocument();
  },
};

/**
 * One search scopes both panes: non-matching kinds drop off the left so the matches
 * are the whole list, and the selected kind stays on — dimmed — even when the query
 * doesn't match it, so the interfaces on the right always have a visible owner.
 */
export const SearchKeepsTheSelectedKind: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the picker and types a search. Non-matching kinds drop off the left pane, but the selected kind stays on as a dimmed row so the interfaces still listed on the right can be told apart from the kind they belong to.",
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const search = canvasElement.querySelector(
      'input[placeholder*="Search types"]'
    ) as HTMLInputElement;

    await userEvent.type(search, 'sync');
    // right pane: only the matching interface survives
    await waitFor(() =>
      expect(missingOption(canvas, 'invoice-export:2.0')).not.toBeInTheDocument()
    );
    await expect(option(canvas, 'order-sync:1.2')).toBeInTheDocument();
    // left pane: nothing is called "sync", so only the selected kind is left — dimmed,
    // which is what tells you the surviving interface is a workflow
    await expect(option(canvas, 'Workflows')).toHaveClass('reqore-reference-picker-dimmed');
    await expect(missingOption(canvas, 'Services')).not.toBeInTheDocument();

    // a kind name matches: it joins the list at full strength, next to the still-dimmed
    // selected kind
    await userEvent.clear(search);
    await userEvent.type(search, 'connect');
    await waitFor(() =>
      expect(option(canvas, 'Connections')).not.toHaveClass(
        'reqore-reference-picker-dimmed'
      )
    );
    await expect(option(canvas, 'Workflows')).toHaveClass('reqore-reference-picker-dimmed');
    await expect(missingOption(canvas, 'Jobs')).not.toBeInTheDocument();
  },
};

/**
 * Narrow container: the panes collapse into one column and the selected kind's
 * interfaces render directly under its row. The width measured is the picker's own,
 * not the viewport's — this canvas is 320px wide on a desktop-sized screen, which is
 * exactly the case a viewport media query gets wrong.
 */
export const StacksInANarrowContainer: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the picker in a 320px-wide container on a full-size screen: it collapses to one column on its own measured width, with the selected kind's interfaces indented directly beneath its row instead of in a second pane.",
      },
    },
  },
  decorators: [darkTheme],
  render: () => (
    <div style={{ width: 320 }}>
      <Hosted />
    </div>
  ),
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const services = option(canvas, 'Services');

    /* Stacked is a claim about ORDER, not just presence: the workflows sit between
       their own kind row and the next one. Side by side, every kind would come
       first and the interfaces after — so the comparison tells the two apart
       without reaching for a marker class. */
    await waitFor(() => {
      const workflow = option(canvas, 'order-sync:1.2');
      expect(
        workflow.compareDocumentPosition(services) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });
    await expect(option(canvas, 'Workflows')).toBeInTheDocument();
  },
};

/** On a phone the picker lifts into a modal — inline it would own the whole screen. */
export const OnAPhone: Story = {
  parameters: {
    // capture this one at phone size; the modal portals to the viewport, so a
    // narrow story wrapper wouldn't constrain it
    qlip: { viewport: { width: 390, height: 844 } },
    docs: {
      description: {
        story:
          'Renders the phone presentation: the picker lifts out of the composer into a full-width modal with a close action, stacked into a single column.',
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted presentation='modal' layout='stacked' onClose={fn()} />,
  async play() {
    // the modal portals out of the story canvas, so query the document
    const canvas = within(document.body);
    await expect(await canvas.findByText('Reference interfaces')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: 'order-sync:1.2' })).toBeInTheDocument();
  },
};

/** The right pane says it's still fetching rather than claiming the kind is empty. */
export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the loading state, where the right pane reports it is still fetching ('Loading workflows…') rather than claiming the kind is empty.",
      },
    },
  },
  decorators: [darkTheme],
  render: () => (
    <ReferencePicker
      kinds={KINDS}
      kind='workflow'
      onKindChange={fn()}
      items={[]}
      loading
      onAdd={fn()}
    />
  ),
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading workflows…')).toBeInTheDocument();
    await expect(canvas.queryByText(/No workflows/)).not.toBeInTheDocument();
  },
};

/**
 * The host's fetch failed. The pane says so and offers a retry — an empty list here
 * would read as "this instance has no connections", which is a different and much more
 * alarming claim than "we couldn't ask". The specific failure is the tooltip.
 */
export const LoadFailed: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the fetch-failure state, where the pane shows the error and a retry action instead of an empty list that would read as 'this instance has no connections'.",
      },
    },
  },
  decorators: [darkTheme],
  render: () => (
    <ReferencePicker
      kinds={KINDS}
      kind='connection'
      onKindChange={fn()}
      items={[]}
      error='Could not reach the Qorus instance'
      onRetry={fn()}
      onAdd={fn()}
    />
  ),
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const retry = await canvas.findByRole('button', { name: /Couldn't load connections/ });
    await expect(retry).toBeInTheDocument();
    // the failure replaces the list rather than sitting alongside an empty one
    await expect(canvas.queryByText(/No connections/)).not.toBeInTheDocument();
  },
};

/** In place: above the composer, toggled by the composer's own action, with the picked
 *  references shown as chips over the input. */
export const AboveTheComposer: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the picker in place above the composer, toggled by the composer's own action, with picked references surfacing as chips over the input that persist when the picker is closed.",
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted withComposer />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'order-sync:1.2' }));
    // the pick stays selected in the pane and surfaces as a chip on the composer
    await waitFor(() =>
      expect(option(canvas, 'order-sync:1.2')).toHaveClass('reqore-reference-picker-picked')
    );
    await expect(canvas.getAllByText('order-sync:1.2').length).toBeGreaterThan(0);

    const toggle = canvasElement.querySelector('.references-toggle') as HTMLElement;
    await userEvent.click(toggle);
    // the picker closes; the chip stays, because the reference is still attached
    await waitFor(() =>
      expect(missingOption(canvas, 'invoice-export:2.0')).not.toBeInTheDocument()
    );
    await expect(canvas.getAllByText('order-sync:1.2').length).toBeGreaterThan(0);
  },
};
