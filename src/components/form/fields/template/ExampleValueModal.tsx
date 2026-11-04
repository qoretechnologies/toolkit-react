import { ReqoreModal, ReqoreTextarea, useReqoreProperty } from '@qoretechnologies/reqore';
import { IReqoreModalProps } from '@qoretechnologies/reqore/dist/components/Modal';
import { CSSProperties, memo, useCallback } from 'react';
import { copyText } from '../../../../helpers/secureContextApis';

export interface IReqraftTemplateExampleValueModalProps extends Partial<IReqoreModalProps> {
  /** The template field's display name — the modal heading. */
  label?: string;
  /** The FULL serialized example value. */
  value: string;
  /** Copy-action label. @default 'Copy' */
  copyLabel?: string;
  /**
   * Notification shown after a successful copy (prop-overridable so consumers
   * can pass translated copy — same contract as `ReqoreExportModal`).
   * @default 'Example value copied to clipboard'
   */
  copyNotificationContent?: string;
  /**
   * Notification shown when the value could not be copied (the browser refused, or offers no way to copy, as on a
   * page served over plain http that does not allow the copy command): what failed and what to do instead. It stays
   * until it is closed.
   * @default 'Could not copy the example value: the browser did not allow access to the clipboard. Select the text and copy it yourself.'
   */
  copyFailedNotificationContent?: string;
}

/* Fill the modal's fixed-height body instead of scaling with content: a
   content-scaled textarea either stops short of the body (dead space below, a
   partial-height scrollbar) or explodes it on huge values. Filling hands the
   whole body to the textarea, so its scrollbar spans the modal body. Module
   scope for stable identity. */
const FILL_STYLE: CSSProperties = { height: '100%' };

/**
 * Full example-value viewer for template/context-data items whose
 * `example_value` is too long for the picker's item description (a
 * binary-carrying field's example can be an entire base64 file). Opened by the
 * "?" item action wired in `helpers/templates.ts` via reqore's global
 * `modalStore.addModal()` — the modals wrapper injects `isOpen`/`onClose`, so
 * this component stays presentation-only (pass `isOpen` yourself only when
 * rendering it standalone, e.g. in a story).
 */
export const ReqraftTemplateExampleValueModal = memo(
  ({
    label,
    value,
    copyLabel = 'Copy',
    copyNotificationContent = 'Example value copied to clipboard',
    copyFailedNotificationContent = 'Could not copy the example value: the browser did not allow access to the clipboard. Select the text and copy it yourself.',
    ...rest
  }: IReqraftTemplateExampleValueModalProps) => {
    const addNotification = useReqoreProperty('addNotification');

    const handleCopyClick = useCallback(async () => {
      // Copying can be refused (permissions, a page served over plain http): the
      // failure is shown, and says what to do, instead of an unhandled rejection.
      try {
        await copyText(value);
      } catch {
        addNotification({
          content: copyFailedNotificationContent,
          intent: 'danger',
        });
        return;
      }
      addNotification({
        content: copyNotificationContent,
        intent: 'success',
        duration: 3000,
      });
    }, [value, addNotification, copyNotificationContent, copyFailedNotificationContent]);

    return (
      <ReqoreModal
        label={label || 'Example value'}
        icon='FileTextLine'
        height='70vh'
        className='reqraft-template-example-value-modal'
        bottomActions={[
          {
            position: 'right',
            label: copyLabel,
            icon: 'ClipboardLine',
            onClick: () => {
              handleCopyClick();
            },
          },
        ]}
        {...rest}
      >
        <ReqoreTextarea
          readOnly
          value={value}
          minimal
          fluid
          style={FILL_STYLE}
          wrapperStyle={FILL_STYLE}
        />
      </ReqoreModal>
    );
  }
);

ReqraftTemplateExampleValueModal.displayName = 'ReqraftTemplateExampleValueModal';
