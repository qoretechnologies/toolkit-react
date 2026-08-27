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
