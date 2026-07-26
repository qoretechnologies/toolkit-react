import { ReqoreButton, ReqoreDropdown } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { TicketMetaTags } from './TicketMetaTags';
import {
  TicketAvatar,
  TicketHeader,
  TicketHeaderText,
  TicketPersonValue,
  ticketInitials,
} from './TicketHeader';

const meta = {
  component: TicketHeader,
  title: 'Components/TicketHeader',
  args: {
    subject: 'Workflow deploy fails at the mapper step',
    reference: '#1001',
  },
} as StoryMeta<typeof TicketHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

const person = (name: string) => (
  <TicketPersonValue>
    <TicketAvatar>{ticketInitials(name)}</TicketAvatar>
    <TicketHeaderText>{name}</TicketHeaderText>
  </TicketPersonValue>
);

/**
 * What a customer sees: the same rail, every value read-only. The properties are the
 * caller's — this is the shorter of the two lists a real surface passes.
 */
export const Customer: Story = {
  args: {
    properties: [
      {
        label: 'Status',
        value: (
          <TicketMetaTags
            ticket={{ status: 'awaiting_customer', priority: 'high', category: 'bug' }}
            viewerRole='customer'
          />
        ),
      },
      { label: 'Opened by', value: person('ide-demo@local.dev') },
      { label: 'References', value: <TicketHeaderText muted>None</TicketHeaderText> },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Workflow deploy fails at the mapper step')).toBeInTheDocument();
    await expect(canvas.getByText('#1001')).toBeInTheDocument();
    await expect(canvas.getByText('Awaiting your reply')).toBeInTheDocument();
  },
};

/**
 * What staff see: the same frame with pressable values. The row is as tall as a
 * control whether or not it holds one, so a rail that mixes text and dropdowns still
 * reads as a table — that invariant is what the alignment test below pins.
 */
export const Staff: Story = {
  args: {
    properties: [
      {
        label: 'Status',
        value: (
          <ReqoreDropdown
            size='small'
            minimal
            flat
            label='Open'
            showCaret={false}
            rightIcon='ArrowDownSLine'
            items={[{ label: 'Open', selected: true }, { label: 'Resolved' }]}
          />
        ),
      },
      { label: 'Assignee', value: person('nick.m@acme.io') },
      { label: 'Customer', value: person('ide-demo@local.dev') },
      {
        label: 'References',
        value: (
          <ReqoreButton size='small' minimal flat icon='GitBranchLine'>
            5 references
          </ReqoreButton>
        ),
      },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('nick.m@acme.io')).toBeInTheDocument();
    await expect(canvas.getByText('NM')).toBeInTheDocument();
  },
};

/**
 * The rail's two layout invariants, measured rather than eyeballed — both have
 * regressed by hand more than once.
 *
 * 1. Every value starts on the same vertical edge, whether it is a control (which
 *    insets its own content by its horizontal padding) or bare text (which does not).
 * 2. Every row is the same height, whether it holds a 32px control or a line of text.
 */
export const RowsAlign: Story = {
  args: Staff.args,
  async play({ canvasElement }) {
    const rows = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('.reqore-description-list-row')
    );
    await expect(rows.length).toBe(4);

    /* Where the value's CONTENT starts, not where its box does. The inset is padding
       and it lands on the value itself — the button on a control row, the person span
       on a text row — so measure that child's padded edge. */
    const contentLeft = (row: HTMLElement) => {
      const column = row.querySelector<HTMLElement>('.reqore-description-list-content')!;
      const value = (column.firstElementChild as HTMLElement | null) ?? column;
      return Math.round(
        value.getBoundingClientRect().left + parseFloat(getComputedStyle(value).paddingLeft)
      );
    };

    const lefts = rows.map(contentLeft);
    await expect(new Set(lefts).size, `value content starts at: ${lefts.join(', ')}`).toBe(1);

    const heights = rows.map((row) => Math.round(row.getBoundingClientRect().height));
    await expect(new Set(heights).size, `row heights: ${heights.join(', ')}`).toBe(1);
  },
};

/** `when: false` drops a row, so one list can serve both viewer roles. */
export const HiddenRow: Story = {
  args: {
    properties: [
      { label: 'Status', value: <TicketHeaderText>Open</TicketHeaderText> },
      { label: 'Assignee', value: <TicketHeaderText>nick.m@acme.io</TicketHeaderText>, when: false },
      { label: 'Customer', value: <TicketHeaderText>ide-demo@local.dev</TicketHeaderText> },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Assignee')).not.toBeInTheDocument();
    await expect(canvas.getByText('Customer')).toBeInTheDocument();
  },
};
