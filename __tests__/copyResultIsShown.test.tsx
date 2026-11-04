// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReqraftTemplateExampleValueModal } from '../src/components/form/fields/template/ExampleValueModal';
import { ReqraftLog } from '../src/components/log/Log';
import { IStoryClipboard, stubClipboard, TStoryClipboard } from '../src/stories/clipboard';

/**
 * A copy button says what happened: "copied" only when the text was copied, and otherwise that it was not and what
 * to do instead. On a page served over plain http there is no Clipboard API, and the copy buttons threw (the log's
 * without a word to the user) instead of copying with the browser's copy command.
 */

let clipboard: IStoryClipboard | undefined;
const pageCopiesWith = (kind: TStoryClipboard) => {
  clipboard = stubClipboard(kind);
  return clipboard;
};

afterEach(() => {
  clipboard?.restore();
  clipboard = undefined;
});

const notifications = () =>
  Array.from(document.querySelectorAll('.reqore-notification')).map((n) => n.textContent || '');

const EXAMPLE_COPIED = 'Example value copied to clipboard';
const EXAMPLE_NOT_COPIED =
  'Could not copy the example value: the browser did not allow access to the clipboard. Select the text and copy it yourself.';

const renderExampleValueModal = (
  props: Partial<Parameters<typeof ReqraftTemplateExampleValueModal>[0]> = {}
) =>
  render(
    <ReqoreUIProvider>
      <ReqraftTemplateExampleValueModal
        isOpen
        label='Attachment Body'
        value='the full example value'
        {...props}
      />
    </ReqoreUIProvider>
  );

const clickCopy = async (label = 'Copy') => {
  const button = await screen.findByRole('button', { name: new RegExp(`^${label}$`) });
  await act(async () => {
    fireEvent.click(button);
  });
};

describe('ReqraftTemplateExampleValueModal copy', () => {
  it('copies with the Clipboard API and says it was copied', async () => {
    const { copied } = pageCopiesWith('clipboard-api');
    renderExampleValueModal();

    await clickCopy();

    await waitFor(() => expect(notifications()).toEqual([expect.stringContaining(EXAMPLE_COPIED)]));
    expect(copied).toEqual(['the full example value']);
  });

  it('copies with the copy command on a page with no Clipboard API (plain http) and says it was copied', async () => {
    const { copied } = pageCopiesWith('copy-command');
    renderExampleValueModal();

    await clickCopy();

    await waitFor(() => expect(notifications()).toEqual([expect.stringContaining(EXAMPLE_COPIED)]));
    expect(copied).toEqual(['the full example value']);
  });

  it('says it could not copy, and what to do, when nothing copies; it never says "copied"', async () => {
    const { copied } = pageCopiesWith('none');
    renderExampleValueModal();

    await clickCopy();

    await waitFor(() =>
      expect(notifications()).toEqual([expect.stringContaining(EXAMPLE_NOT_COPIED)])
    );
    expect(notifications().join()).not.toContain(EXAMPLE_COPIED);
    expect(copied).toEqual([]);
    // the value stays in the modal to be selected by hand
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'the full example value'
    );
  });

  it('shows the failure the consumer supplied', async () => {
    pageCopiesWith('none');
    renderExampleValueModal({
      copyLabel: 'Copy value',
      copyNotificationContent: 'Value copied',
      copyFailedNotificationContent: 'Copy was blocked',
    });

    await clickCopy('Copy value');

    await waitFor(() =>
      expect(notifications()).toEqual([expect.stringContaining('Copy was blocked')])
    );
    expect(notifications().join()).not.toContain('Value copied');
  });
});

const LOG_COPIED = 'Log message copied to clipboard';
const LOG_NOT_COPIED =
  'Could not copy the log message: the browser did not allow access to the clipboard. Select the message and copy it yourself.';

const renderLog = (props: Partial<Parameters<typeof ReqraftLog>[0]> = {}) =>
  render(
    <ReqoreUIProvider>
      <ReqraftLog
        url='log-copy-test'
        allowMessageCopy
        defaultMessages={[{ message: 'first message' }, { message: 'second message' }]}
        {...props}
      />
    </ReqoreUIProvider>
  );

const clickCopyMessage = async (index: number) => {
  const buttons = document.querySelectorAll('.reqraft-log-copy-message');
  expect(buttons).toHaveLength(2);
  await act(async () => {
    fireEvent.click(buttons[index]);
  });
};

describe('ReqraftLog message copy', () => {
  it('copies the message with the Clipboard API and says it was copied', async () => {
    const { copied } = pageCopiesWith('clipboard-api');
    renderLog();

    await clickCopyMessage(1);

    await waitFor(() => expect(notifications()).toEqual([expect.stringContaining(LOG_COPIED)]));
    expect(copied).toEqual(['second message']);
  });

  it('copies the message with the copy command on a page with no Clipboard API (plain http)', async () => {
    const { copied } = pageCopiesWith('copy-command');
    renderLog();

    await clickCopyMessage(0);

    await waitFor(() => expect(notifications()).toEqual([expect.stringContaining(LOG_COPIED)]));
    expect(copied).toEqual(['first message']);
  });

  it('says it could not copy, and what to do, when nothing copies; it never says "copied"', async () => {
    const { copied } = pageCopiesWith('none');
    renderLog();

    await clickCopyMessage(0);

    await waitFor(() => expect(notifications()).toEqual([expect.stringContaining(LOG_NOT_COPIED)]));
    expect(notifications().join()).not.toContain(LOG_COPIED);
    expect(copied).toEqual([]);
    // the message is still there to be selected by hand
    expect(screen.getByText('first message').textContent).toBe('first message');
  });

  it('shows the texts the consumer supplied', async () => {
    pageCopiesWith('none');
    renderLog({
      copyMessageNotificationContent: 'Message copied',
      copyMessageFailedNotificationContent: 'Copy was blocked',
    });

    await clickCopyMessage(0);

    await waitFor(() =>
      expect(notifications()).toEqual([expect.stringContaining('Copy was blocked')])
    );
    expect(notifications().join()).not.toContain('Message copied');
  });

  it('does not hand its copy texts on to the panel element', () => {
    pageCopiesWith('none');
    const { container } = renderLog({
      copyMessageNotificationContent: 'Message copied',
      copyMessageFailedNotificationContent: 'Copy was blocked',
    });

    const panel = container.querySelector('.reqore-panel') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('copymessagenotificationcontent')).toBeNull();
    expect(panel.getAttribute('copymessagefailednotificationcontent')).toBeNull();
  });
});
