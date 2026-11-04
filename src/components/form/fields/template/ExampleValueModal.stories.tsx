import { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { storyCopiedTexts, withStoryClipboard } from '../../../../stories/clipboard';
import { LONG_EXAMPLE_VALUE } from './__fixtures__/longExampleValue';
import { ReqraftTemplateExampleValueModal } from './ExampleValueModal';

const meta = {
  component: ReqraftTemplateExampleValueModal,
  title: 'Components/Form/TemplateExampleValueModal',
  args: {
    // Standalone render — in the app the modal rides reqore's global modal
    // queue, whose wrapper injects `isOpen`/`onClose` itself.
    isOpen: true,
    label: 'Attachment Body',
    value: LONG_EXAMPLE_VALUE,
    onClose: fn(),
  },
} as Meta<typeof ReqraftTemplateExampleValueModal>;

export default meta;

const findModal = () =>
  waitFor(
    () => {
      const el = document.querySelector('.reqraft-template-example-value-modal');
      if (!el) throw new Error('modal not rendered yet');
      return el;
    },
    { timeout: 10000 }
  );

const clickCopy = async (modal: Element, label: string) => {
  const copy = Array.from(modal.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === label
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

export const Default: StoryObj<typeof meta> = {
  beforeEach: withStoryClipboard('clipboard-api'),
  parameters: {
    docs: {
      description: {
        story:
          'Renders the full example-value viewer for template items whose value is too long for the picker: the whole value in a selectable, scrollable textarea filling the modal body, with a Copy action. Clicking Copy copies the value and shows the "Example value copied to clipboard" notification.',
      },
    },
  },
  play: async () => {
    const modal = await findModal();

    // The modal holds the WHOLE value — down to the sentinel at the very end.
    const textarea = modal.querySelector('textarea') as HTMLTextAreaElement;
    await expect(textarea.value).toBe(LONG_EXAMPLE_VALUE);
    await expect(textarea.value.endsWith('THE_VERY_END')).toBe(true);

    // Copy copies the whole value, and says so.
    await clickCopy(modal, 'Copy');
    await waitForNotification('Example value copied to clipboard');
    await expect(storyCopiedTexts()).toEqual([LONG_EXAMPLE_VALUE]);
  },
};

export const Mobile: StoryObj<typeof meta> = {
  beforeEach: withStoryClipboard('clipboard-api'),
  args: {
    // The overridable strings double as the prop-passthrough coverage: the
    // play below asserts THIS notification text, proving consumers (e.g.
    // qorus-ide under Lingui) can supply translated copy.
    copyLabel: 'Copy value',
    copyNotificationContent: 'Value copied',
    copyFailedNotificationContent: 'Copy was blocked',
  },
  parameters: {
    qlip: { viewport: { width: 390, height: 844 } },
    docs: {
      description: {
        story:
          'Renders the full-value modal on a phone: the textarea still fills the modal body at phone width. Every user-visible string (the Copy label and both notifications) is overridden by props, so clicking "Copy value" shows the supplied "Value copied" notification.',
      },
    },
  },
  play: async () => {
    const modal = await findModal();

    const textarea = modal.querySelector('textarea') as HTMLTextAreaElement;
    await expect(textarea.value).toBe(LONG_EXAMPLE_VALUE);

    // The overridden copy label renders, and the overridden notification is
    // what surfaces.
    await clickCopy(modal, 'Copy value');
    await waitForNotification('Value copied');
    await expect(storyCopiedTexts()).toEqual([LONG_EXAMPLE_VALUE]);
  },
};

export const CopyOnPlainHttp: StoryObj<typeof meta> = {
  beforeEach: withStoryClipboard('copy-command'),
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // (the value copied, and the success notification) is pictured by `Default`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the full-value modal on a page served over plain http, which has no Clipboard API. Clicking Copy still copies the value, with the browser\'s copy command, and shows the "Example value copied to clipboard" notification.',
      },
    },
  },
  play: async () => {
    const modal = await findModal();
    await clickCopy(modal, 'Copy');
    await waitForNotification('Example value copied to clipboard');
    await expect(storyCopiedTexts()).toEqual([LONG_EXAMPLE_VALUE]);
  },
};

export const CopyFailed: StoryObj<typeof meta> = {
  beforeEach: withStoryClipboard('none'),
  parameters: {
    docs: {
      description: {
        story:
          'Renders the full-value modal on a page where the browser allows no way of copying. Clicking Copy copies nothing and shows a danger notification that stays until it is closed: "Could not copy the example value: the browser did not allow access to the clipboard. Select the text and copy it yourself." No "copied" notification is shown.',
      },
    },
  },
  play: async () => {
    const modal = await findModal();
    await clickCopy(modal, 'Copy');
    const shown = await waitForNotification(
      'Could not copy the example value: the browser did not allow access to the clipboard. Select the text and copy it yourself.'
    );
    await expect(shown.some((content) => content.includes('copied to clipboard'))).toBe(false);
    await expect(storyCopiedTexts()).toEqual([]);
  },
};
