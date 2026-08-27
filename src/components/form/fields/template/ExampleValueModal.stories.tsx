import { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
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

export const Default: StoryObj<typeof meta> = {
  parameters: {
    docs: {
      description: {
        story:
          'The full example-value viewer for template items whose value is too long for the picker: the whole value in a selectable, scrollable textarea filling the modal body, with a Copy action. Copy surfaces a notification either way — success, or a danger notice when the browser denies clipboard access — never an unhandled rejection.',
      },
    },
  },
  play: async () => {
    const modal = await waitFor(
      () => {
        const el = document.querySelector('.reqraft-template-example-value-modal');
        if (!el) throw new Error('modal not rendered yet');
        return el;
      },
      { timeout: 10000 }
    );

    // The modal holds the WHOLE value — down to the sentinel at the very end.
    const textarea = modal.querySelector('textarea') as HTMLTextAreaElement;
    await expect(textarea.value).toBe(LONG_EXAMPLE_VALUE);
    await expect(textarea.value.endsWith('THE_VERY_END')).toBe(true);

    // Copy notifies (success locally, clipboard-denied danger in headless CI).
    const copy = Array.from(modal.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Copy')
    );
    await expect(copy).toBeTruthy();
    fireEvent.click(copy);
    await waitFor(
      () => {
        if (!document.querySelector('.reqore-notification')) {
          throw new Error('no notification yet');
        }
      },
      { timeout: 10000 }
    );
  },
};

export const Mobile: StoryObj<typeof meta> = {
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
          'The phone presentation of the full-value modal — the textarea still fills the modal body at phone width, and every user-visible string (Copy label, both notifications) is prop-overridden here, which doubles as coverage that consumers can pass translated copy.',
      },
    },
  },
  play: async () => {
    const modal = await waitFor(
      () => {
        const el = document.querySelector('.reqraft-template-example-value-modal');
        if (!el) throw new Error('modal not rendered yet');
        return el;
      },
      { timeout: 10000 }
    );

    const textarea = modal.querySelector('textarea') as HTMLTextAreaElement;
    await expect(textarea.value).toBe(LONG_EXAMPLE_VALUE);

    // The overridden copy label renders…
    const copy = Array.from(modal.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Copy value')
    );
    await expect(copy).toBeTruthy();

    // …and the overridden notification content is what surfaces (success or
    // clipboard-denied, both prop-supplied).
    fireEvent.click(copy);
    await waitFor(
      () => {
        const notification = document.querySelector('.reqore-notification');
        if (!notification) throw new Error('no notification yet');
        const text = notification.textContent || '';
        if (!text.includes('Value copied') && !text.includes('Copy was blocked')) {
          throw new Error(`unexpected notification: ${text}`);
        }
      },
      { timeout: 10000 }
    );
  },
};
