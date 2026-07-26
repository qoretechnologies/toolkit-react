import { ReqoreButton, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { InterfaceReferenceTags } from './InterfaceReferenceTags';
import { IInterfaceReference } from './meta';
import { ReferencePicker } from './ReferencePicker';
import { TicketReplyBox } from './TicketReplyBox';

/**
 * The two-pane reference browser (master-detail: kinds on the left, that kind's
 * interfaces on the right) with a single search bar that scopes both panes. Rendered
 * **on top** of the composer and toggled by its "Reference interfaces" action.
 */
const meta = {
  component: ReferencePicker,
  title: 'Components/ReferencePicker',
} as StoryMeta<typeof ReferencePicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const ACCENT = { main: 'custom1' } as const;

const KINDS = [
  'workflow',
  'service',
  'job',
  'fsm',
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
 * instance one kind at a time. */
const CATALOGUE: Record<string, string[]> = {
  workflow: ['order-sync:1.2', 'invoice-export:2.0', 'partner-recon:1.1'],
  service: ['notifier', 'audit-logger', 'partner-gateway'],
  job: ['nightly-recon', 'cleanup-temp', 'sla-report'],
  fsm: ['onboarding', 'escalation'],
  connection: ['sftp-partner', 'pgsql-omq', 'salesforce-prod'],
  mapper: ['csv-to-order', 'order-to-invoice'],
  class: ['OrderUtils', 'PartnerApi'],
  'value-map': ['country-codes', 'currency'],
  qog: ['telegram-intake', 'stripe-billing'],
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
const Hosted = ({ withComposer }: { withComposer?: boolean }) => {
  const [kind, setKind] = useState<string>('workflow');
  const [picked, setPicked] = useState<IInterfaceReference[]>([]);
  const [open, setOpen] = useState<boolean>(true);

  const picker = (
    <ReferencePicker
      kinds={KINDS}
      kind={kind}
      onKindChange={setKind}
      items={CATALOGUE[kind] ?? []}
      picked={picked}
      onAdd={(reference) => setPicked((current) => [...current, reference])}
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
            <InterfaceReferenceTags size='tiny' customTheme={ACCENT} references={picked} />
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

/** Picking an interface adds it as a reference — and it stops being offered, so the
 *  same thing can't be referenced twice. */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the two-pane reference browser and, on picking an interface, adds it as a reference and drops it from the pane so the same thing can't be referenced twice.",
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'order-sync:1.2' }));
    // it moves out of the pane once picked
    await waitFor(() => expect(missingOption(canvas, 'order-sync:1.2')).not.toBeInTheDocument());
    // its siblings are untouched
    await expect(option(canvas, 'invoice-export:2.0')).toBeInTheDocument();
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
    await userEvent.click(option(canvas, 'connection'));
    await waitFor(() => expect(option(canvas, 'sftp-partner')).toBeInTheDocument());
    await expect(missingOption(canvas, 'order-sync:1.2')).not.toBeInTheDocument();
  },
};

/** One search scopes both panes: the kind list and the selected kind's interfaces. */
export const SearchScopesBothPanes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the picker and shows its single search box scoping both panes at once — filtering the selected kind's interfaces and the kind list together.",
      },
    },
  },
  decorators: [darkTheme],
  render: () => <Hosted />,
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const search = canvasElement.querySelector(
      'input[placeholder*="Search kinds"]'
    ) as HTMLInputElement;

    await userEvent.type(search, 'sync');
    // right pane: only the matching interface survives
    await waitFor(() =>
      expect(missingOption(canvas, 'invoice-export:2.0')).not.toBeInTheDocument()
    );
    await expect(option(canvas, 'order-sync:1.2')).toBeInTheDocument();
    // left pane: no kind is called "sync", so the kind list empties out
    await expect(canvas.getByText('No kinds')).toBeInTheDocument();

    // a kind name matches: that kind stays, and every other kind drops away
    await userEvent.clear(search);
    await userEvent.type(search, 'connect');
    await waitFor(() => expect(option(canvas, 'connection')).toBeInTheDocument());
    await expect(missingOption(canvas, 'workflow')).not.toBeInTheDocument();
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
    await expect(canvas.queryByText('No matching workflow')).not.toBeInTheDocument();
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
    await expect(canvas.queryByText('No matching connection')).not.toBeInTheDocument();
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
    // the pick leaves the pane and surfaces as a chip on the composer
    await waitFor(() => expect(missingOption(canvas, 'order-sync:1.2')).not.toBeInTheDocument());
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
