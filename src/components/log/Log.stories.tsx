import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, waitFor } from 'storybook/test';
import { Server } from 'mock-socket';
import { sleep, testsClickButton, testsWaitForText } from '../../../__tests__/utils';
import { storyCopiedTexts, withStoryClipboard } from '../../stories/clipboard';
import {
  hasBrowserMouse,
  middleOfElement,
  mouseOffThePage,
  restMouseOn,
} from '../../stories/mouse';
import { storySocketUrl } from '../../stories/storyNetwork';
import { withTouchScreen } from '../../stories/touchScreen';
import { PHONE_VIEWPORT } from '../../stories/tracking';
import { StoryMeta } from '../../types';
import { ReqraftLog } from './Log';

const meta = {
  component: ReqraftLog,
  title: 'Components/Log',
  args: {
    url: 'log-test',
    label: 'Testing Log',
    socketOptions: {
      openOnMount: true,
      closeOnUnmount: true,
    },
    onConnect: fn(),
    onMessage: fn(),
    onDisconnect: fn(),
    onConnectionError: fn(),
  },
  parameters: {
    mockdate: new Date('2024-01-01T08:00:00.000Z'),
  },
  async beforeEach() {
    const url = storySocketUrl('log-test');
    let server = new Server(url);
    let killTimeout: NodeJS.Timeout;
    let fakeInterval: NodeJS.Timeout;
    const fakeMessages = [
      'This is a message',
      'WARNING: This is a warning message',
      'This is another message',
      'This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature, which should be able to handle this message without any issues. This is a very long message that should be split into multiple lines to test the word wrap feature,',
      'ERROR: This is an error message',
      'This is a new message',
      'THIS IS A MESSAGE IN ALL CAPS',
      'This is a message with a link: https://www.qoretechnologies.com',
    ];
    let fakeMessageIndex = 0;

    server.on('connection', (socket) => {
      if (killTimeout) {
        server.close();
        return;
      }

      fakeInterval = setInterval(() => {
        socket.send(fakeMessages[fakeMessageIndex]);
        fakeMessageIndex = (fakeMessageIndex + 1) % fakeMessages.length;

        if (fakeMessageIndex === 0) {
          clearInterval(fakeInterval);
          fakeInterval = null;
        }
      }, 100);

      socket.on('message', (data) => {
        if (data === 'ping') {
          socket.send('pong');
          return;
        }

        if (data === 'kill') {
          server.close();

          killTimeout = setTimeout(() => {
            server = new Server(url);
            killTimeout = null;
          }, 3000);

          return;
        }

        socket.send(`Received message: ${data}`);
      });
    });

    return () => {
      killTimeout && clearTimeout(killTimeout);
      killTimeout = null;
      fakeInterval && clearInterval(fakeInterval);
      fakeInterval = null;
      fakeMessageIndex = 0;

      server.close();
    };
  },
} as StoryMeta<typeof ReqraftLog>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftLog wired to a mock WebSocket that emits a stream of test log lines — the messages accumulate in the log panel as they arrive.',
      },
    },
  },
  play: async () => {
    await testsWaitForText('This is a message with a link: https://www.qoretechnologies.com');
  },
};

export const Filterable: Story = {
  ...Basic,
  args: {
    filterable: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftLog with the filter input enabled. Typing "error" narrows the visible list to the single ERROR message.',
      },
    },
  },
  play: async (args) => {
    await Basic.play(args);
    await fireEvent.change(document.querySelector('.reqore-input'), { target: { value: 'error' } });
    await expect(document.querySelectorAll('.reqraft-log-message')).toHaveLength(1);
  },
};

/** Where a control sits in the title bar: present, drawn, and not cut off by the bar's edge. */
const expectInTitleBar = (bar: Element, control: Element | null) => {
  expect(control).toBeTruthy();
  const box = control!.getBoundingClientRect();
  const edge = bar.getBoundingClientRect();
  expect(box.width).toBeGreaterThan(0);
  expect(box.left).toBeGreaterThanOrEqual(edge.left);
  expect(box.right).toBeLessThanOrEqual(edge.right);
};

export const FilterableOnAPhone: Story = {
  ...Filterable,
  tags: ['touch'],
  // drawn at the phone's width from the start, as on a phone, not narrowed after it was laid out
  globals: { viewport: { value: 'phone' } },
  parameters: {
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: `${PHONE_VIEWPORT.width}px`, height: `${PHONE_VIEWPORT.height}px` },
        },
      },
    },
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'Renders ReqraftLog with the filter on a phone (390 px, touch). The filter, Pause and Clear stay in the title bar, none of them folded into a menu. A finger taps the filter, and typing "error" leaves the single ERROR message.',
      },
    },
  },
  play: async (context) => {
    await Basic.play(context);
    await withTouchScreen(async (touch) => {
      const bar = context.canvasElement.querySelector('.reqore-panel-title')!;
      const filter = bar.querySelector<HTMLInputElement>('input[placeholder="Filter messages"]');
      expectInTitleBar(bar, filter);
      expectInTitleBar(bar, bar.querySelector('.reqraft-log-pause-resume'));
      expectInTitleBar(bar, bar.querySelector('.reqraft-log-clear'));

      await touch.tap(filter!);
      await fireEvent.change(filter!, { target: { value: 'error' } });
      await waitFor(() =>
        expect(context.canvasElement.querySelectorAll('.reqraft-log-message')).toHaveLength(1)
      );
    });
  },
};

export const WithTimestamps: Story = {
  ...Basic,
  args: {
    showTimestamps: true,
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `CanSendMessages`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders ReqraftLog with per-message timestamps enabled — each streamed line is prefixed with its arrival time.',
      },
    },
  },
};

export const WithDefaultMessages: Story = {
  ...Basic,
  args: {
    showTimestamps: true,
    defaultMessages: [
      { message: 'This is a default message', timestamp: '08:00:00.000' },
      { message: 'This is another default message', timestamp: '08:00:00.000' },
    ],
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `CanSendMessages`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders ReqraftLog seeded with two default messages — those lines appear before any messages arrive from the socket.',
      },
    },
  },
};

const LINK_MESSAGE = 'This is a message with a link: https://www.qoretechnologies.com';

/** Clicks the copy action of the message row reading `message`. */
const clickCopyMessage = async (message: string) => {
  // the row of a copy action is its nearest ancestor holding a message
  const rowMessage = (button: Element) => {
    let element = button.parentElement;
    while (element && !element.querySelector('.reqraft-log-message')) {
      element = element.parentElement;
    }
    return element?.querySelector('.reqraft-log-message')?.textContent;
  };
  const copy = Array.from(document.querySelectorAll('.reqraft-log-copy-message')).find(
    (button) => rowMessage(button) === message
  );
  await expect(copy).toBeTruthy();
  fireEvent.click(copy);
};

const waitForNotification = (text: string) =>
  waitFor(
    () => {
      const shown = Array.from(document.querySelectorAll('.reqore-notification')).map(
        (notification) => notification.textContent || ''
      );
      if (!shown.some((content) => content.includes(text))) {
        throw new Error(`no notification "${text}" yet: ${JSON.stringify(shown)}`);
      }
      return shown;
    },
    { timeout: 10000 }
  );

export const WithCopyableMessages: Story = {
  ...Basic,
  beforeEach: withStoryClipboard('clipboard-api'),
  args: {
    allowMessageCopy: true,
  },
  parameters: {
    // Interaction-only: the play assertions are the guard; the copy actions are
    // pictured by `CopyableMessagesReadAsLines`, and a copy notification by `CopyFailed`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders ReqraftLog with allowMessageCopy — each message row exposes a copy action next to its content. Clicking a message\'s copy action copies that message and shows the "Log message copied to clipboard" notification.',
      },
    },
  },
  play: async (args) => {
    await Basic.play(args);
    await clickCopyMessage(LINK_MESSAGE);
    await waitForNotification('Log message copied to clipboard');
    await expect(storyCopiedTexts()).toEqual([LINK_MESSAGE]);
  },
};

export const CopyFailed: Story = {
  ...Basic,
  beforeEach: withStoryClipboard('none'),
  args: {
    allowMessageCopy: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftLog with copyable messages on a page where the browser allows no way of copying. Clicking a message\'s copy action copies nothing and shows a danger notification that stays until it is closed: "Could not copy the log message: the browser did not allow access to the clipboard. Select the message and copy it yourself."',
      },
    },
  },
  play: async (args) => {
    await Basic.play(args);
    await clickCopyMessage(LINK_MESSAGE);
    const shown = await waitForNotification(
      'Could not copy the log message: the browser did not allow access to the clipboard. Select the message and copy it yourself.'
    );
    await expect(shown.some((content) => content.includes('copied to clipboard'))).toBe(false);
    await expect(storyCopiedTexts()).toEqual([]);
  },
};

export const WithDeletableMessages: Story = {
  ...Basic,
  args: {
    allowMessageCopy: true,
    allowMessageDeletion: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftLog with copy and delete actions on every message. Clicking a message\'s delete action removes just that row from the log.',
      },
    },
  },
  play: async (args) => {
    await Basic.play(args);
    await testsClickButton({ selector: '.reqraft-log-delete-message', nth: 4 });
  },
};

/* Messages a log holds from the start, with no socket streaming more in: the lines a play measures stay put. */
const LINE_MESSAGES = [
  'Connected to the order stream',
  'WARNING: 3 orders are waiting for a retry',
  'Order 1042 was accepted',
  'This is a long message that wraps onto more than one line at this width, to show that a message which wraps keeps clear of the copy action at the end of its row: none of its words runs under the button, whether the button is shown or not.',
  'ERROR: Order 1043 was refused by the warehouse',
  'Order 1044 was accepted',
];

/** The box of a message's text itself: its lines, not the paragraph's padding. */
const textBox = (message: Element) => {
  const range = document.createRange();
  range.selectNodeContents(message);
  return range.getBoundingClientRect();
};

/** The rows of the log, each with its message and its actions. */
const logRows = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('.reqraft-log-row')).map((row) => ({
    row,
    message: row.querySelector('.reqraft-log-message') as HTMLElement,
    actions: row.querySelector('.reqraft-log-message-actions') as HTMLElement,
    copy: row.querySelector('.reqraft-log-copy-message') as HTMLElement,
  }));

/** The space between one message's last line and the next one's first, for each pair of messages. */
const gapsBetweenLines = (canvasElement: HTMLElement) => {
  const boxes = logRows(canvasElement).map(({ message }) => textBox(message));
  return boxes.slice(1).map((box, index) => box.top - boxes[index].bottom);
};

const shownOpacity = (element: Element) => getComputedStyle(element).opacity;

export const CopyableMessagesReadAsLines: Story = {
  beforeEach: withStoryClipboard('clipboard-api'),
  args: {
    allowMessageCopy: true,
    socketOptions: { openOnMount: false, closeOnUnmount: true },
    defaultMessages: LINE_MESSAGES.map((message) => ({ message })),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Renders ReqraftLog with copyable messages, read with a mouse and a keyboard. The lines follow each other as in a log without copy actions, with no blank space between them. A message's copy action shows only while the pointer is on its row or a key has moved to it, and it is drawn at the end of the row, over none of the text: the long message wraps before it. Hovering the third message and clicking its copy action copies it; Tab then reaches the first message's copy action, which shows, and Enter copies that message.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(logRows(canvasElement)).toHaveLength(LINE_MESSAGES.length));
    const rows = logRows(canvasElement);
    const fontSize = parseFloat(getComputedStyle(rows[0].message).fontSize);

    // one line after another: no space between them as high as a line (the copy buttons made it 23 px)
    const gaps = gapsBetweenLines(canvasElement);
    for (const gap of gaps) {
      await expect(gap).toBeGreaterThanOrEqual(0);
      await expect(gap).toBeLessThan(fontSize);
    }

    // the actions are hidden until a row is pointed at, and no message runs under them
    for (const { row, message, actions } of rows) {
      await expect(
        shownOpacity(actions),
        `row ${message.textContent?.slice(0, 20)} before hover`
      ).toBe('0');
      await expect(textBox(message).right).toBeLessThanOrEqual(
        actions.getBoundingClientRect().left
      );
      await expect(row.getBoundingClientRect().height).toBeLessThan(
        actions.getBoundingClientRect().height * (message === rows[3].message ? 4 : 1)
      );
    }
    // the long message did wrap
    await expect(textBox(rows[3].message).height).toBeGreaterThan(fontSize * 1.5);

    // the mouse on the third message shows its copy action, and only its own
    const third = rows[2];
    await restMouseOn(third.row, middleOfElement(third.message));
    if (await hasBrowserMouse()) {
      await waitFor(() => expect(shownOpacity(third.actions)).toBe('1'));
      await expect(shownOpacity(rows[1].actions), 'second row while third hovered').toBe('0');
      // a click lands on it: an action that ignored the pointer would refuse the click
      await userEvent.click(third.copy);
      await waitFor(() => expect(storyCopiedTexts()).toEqual([LINE_MESSAGES[2]]));
      await waitForNotification('Log message copied to clipboard');
    }
    await mouseOffThePage();
    if (await hasBrowserMouse()) {
      // the clicked button keeps the focus, and an action that has it stays shown, off the pointer too
      await expect(document.activeElement).toBe(third.copy);
      await expect(shownOpacity(third.actions), 'the focused action').toBe('1');
      // once the focus is elsewhere, nothing points at the row and its action is hidden again
      third.copy.blur();
      await waitFor(() =>
        expect(shownOpacity(third.actions), 'third row after the mouse left').toBe('0')
      );
    }

    // the keyboard reaches the copy actions too: the one a key moves to shows, and Enter copies its message
    let tabs = 0;
    while (!document.activeElement?.classList.contains('reqraft-log-copy-message') && tabs < 40) {
      await userEvent.tab();
      tabs++;
    }
    const focused = document.activeElement as HTMLElement;
    await expect(focused.classList.contains('reqraft-log-copy-message')).toBe(true);
    await expect(focused).toBe(rows[0].copy);
    await waitFor(() => expect(shownOpacity(rows[0].actions)).toBe('1'));
    await expect(shownOpacity(rows[1].actions), 'second row while first focused').toBe('0');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(storyCopiedTexts().at(-1)).toBe(LINE_MESSAGES[0]));
    // the lines did not move while an action showed
    await expect(gapsBetweenLines(canvasElement)).toEqual(gaps);
  },
};

export const CopyableMessagesOnAPhone: Story = {
  ...CopyableMessagesReadAsLines,
  tags: ['touch'],
  globals: { viewport: { value: 'phone' } },
  parameters: {
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: `${PHONE_VIEWPORT.width}px`, height: `${PHONE_VIEWPORT.height}px` },
        },
      },
    },
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          "Renders the same log on a phone (390 px, touch), where nothing is hovered. Every message's copy action is shown, in its row beside the message, at a size a finger can hit, and the text wraps before it. A tap on the second message's copy action copies that message.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(logRows(canvasElement)).toHaveLength(LINE_MESSAGES.length));
    await withTouchScreen(async (touch) => {
      const rows = logRows(canvasElement);
      for (const { message, actions, copy } of rows) {
        /* Only a touch screen draws the touch layout: in Storybook's UI, with a mouse, the frame is narrowed but
           the page still hovers, and the actions are drawn as for a mouse. */
        if (touch.real) {
          // in the row's flow and always shown: a touch screen has no hover to show it
          await expect(getComputedStyle(actions).position).toBe('static');
          await expect(shownOpacity(actions)).toBe('1');
          // as big as reqore's small control, which a finger can hit (rounded: the box is laid out in fractions)
          await expect(Math.round(copy.getBoundingClientRect().height)).toBeGreaterThanOrEqual(32);
        }
        await expect(textBox(message).right).toBeLessThanOrEqual(
          actions.getBoundingClientRect().left
        );
      }
      if (!touch.real) {
        // Storybook's UI hovers, so the action is drawn as for a mouse: shown once its row has the focus
        rows[1].copy.focus();
        await waitFor(() => expect(shownOpacity(rows[1].actions)).toBe('1'));
      }
      await touch.tap(rows[1].copy);
      await waitFor(() => expect(storyCopiedTexts()).toEqual([LINE_MESSAGES[1]]));
      await waitForNotification('Log message copied to clipboard');
    });
  },
};

export const Pause: Story = {
  ...Basic,
  args: {
    allowMessageDeletion: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftLog while messages stream in. Clicking the pause/resume action halts appending new messages until it is clicked again.',
      },
    },
  },
  play: async () => {
    await testsWaitForText('This is another message');
    await testsClickButton({ selector: '.reqraft-log-pause-resume' });
  },
};

export const Clear: Story = {
  ...Basic,
  args: {
    allowMessageDeletion: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftLog with messages streamed in. Clicking the clear action empties the log and the "No messages" empty state is shown.',
      },
    },
  },
  play: async (args) => {
    await Basic.play(args);
    await testsClickButton({ selector: '.reqraft-log-clear' });
    await testsWaitForText('No messages');
  },
};

export const FormattedMessages: Story = {
  ...Basic,
  args: {
    messageFormatter: ({ message, ...rest }) => {
      if (message.includes('WARNING')) {
        return { message, intent: 'warning' };
      }

      if (message.includes('ERROR')) {
        return { message, intent: 'danger' };
      }

      if (message.includes('ALL CAPS')) {
        return { message, intent: 'info' };
      }

      return { message, ...rest };
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftLog with a messageFormatter that assigns intents by content — WARNING lines color warning, ERROR lines danger and ALL-CAPS lines info.',
      },
    },
  },
  play: async (args) => {
    await Basic.play(args);
  },
};

export const CanSendMessages: Story = {
  ...Basic,
  args: {
    canSendMessages: true,
    showTimestamps: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders ReqraftLog with canSendMessages — an input at the bottom lets the operator send a message back through the socket alongside the incoming stream.',
      },
    },
  },
  play: async (args) => {
    await Basic.play(args);
  },
};

export const WithAutoScroll: Story = {
  ...Basic,
  args: {
    autoScroll: true,
    style: { height: '200px' },
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Basic`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders ReqraftLog with autoScroll in a fixed 200px viewport — the log stays pinned to the newest message as new lines arrive.',
      },
    },
  },
  play: async (args) => {
    await Basic.play(args);
  },
};

export const WithAutoScrollAndManualScroll: Story = {
  ...WithAutoScroll,
  args: {
    autoScroll: true,
    style: { height: '200px' },
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Basic`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders ReqraftLog with autoScroll while the operator scrolls the panel manually — auto-scroll pauses so the operator can inspect older messages without being yanked back to the tail.',
      },
    },
  },
  play: async (args) => {
    await WithAutoScroll.play(args);
    await sleep(3000);
    await fireEvent.scroll(document.querySelector('.reqore-panel-content'), {
      target: { scrollTop: 100 },
    });
    await sleep(100);
  },
};
