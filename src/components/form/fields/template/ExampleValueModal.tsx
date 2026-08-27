import { ReqoreModal, ReqoreTextarea, useReqoreProperty } from '@qoretechnologies/reqore';
import { IReqoreModalProps } from '@qoretechnologies/reqore/dist/components/Modal';
import { CSSProperties, memo, useCallback } from 'react';

export interface IReqraftTemplateExampleValueModalProps extends Partial<IReqoreModalProps> {
  /** The template field's display name — the modal heading. */
  label?: string;
  /** The FULL serialized example value. */
  value: string;
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
  ({ label, value, ...rest }: IReqraftTemplateExampleValueModalProps) => {
    const addNotification = useReqoreProperty('addNotification');

    const handleCopyClick = useCallback(async () => {
      // Clipboard access can be denied (permissions, insecure context) — the
      // failure surfaces as a notification instead of an unhandled rejection.
      try {
        await navigator.clipboard.writeText(value);
        addNotification({
          content: 'Example value copied to clipboard',
          intent: 'success',
          duration: 3000,
        });
      } catch (error) {
        addNotification({
          content: 'Could not copy to clipboard',
          intent: 'danger',
          duration: 3000,
        });
      }
    }, [value, addNotification]);

    return (
      <ReqoreModal
        label={label || 'Example value'}
        icon='FileTextLine'
        height='70vh'
        className='reqraft-template-example-value-modal'
        bottomActions={[
          {
            position: 'right',
            label: 'Copy',
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
