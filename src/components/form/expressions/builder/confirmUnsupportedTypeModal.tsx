import {
  ReqoreCheckbox,
  ReqoreControlGroup,
  ReqoreModal,
  ReqoreP,
  ReqoreTag,
  ReqoreTagGroup,
} from '@qoretechnologies/reqore';
import { IReqoreModalProps } from '@qoretechnologies/reqore/dist/components/Modal';
import { memo } from 'react';
import { useReqraftStorage } from '../../../../hooks/useStorage/useStorage';
import { useQorusTypes } from '../../../../hooks/useQorusTypes';

export interface IConfirmUnsupportedTypeModalProps extends IReqoreModalProps {
  acceptedTypes: string[];
  exactMatch?: boolean;
}

export const ConfirmUnsupportedTypeModal = memo(
  ({ acceptedTypes, children, ...rest }: IConfirmUnsupportedTypeModalProps) => {
    const types = useQorusTypes();
    const [doNotShowTypeConfirmation, setDoNotShowTypeConfirmation] = useReqraftStorage<boolean>(
      'doNotShowTypeExpressionConfirmation',
      false,
      true
    );

    return (
      <ReqoreModal
        isOpen
        intent='warning'
        icon='ErrorWarningLine'
        label='Confirm type selection'
        {...rest}
        customZIndex={1000000}
      >
        {children ? (
          children
        ) : (
          <ReqoreControlGroup vertical fluid horizontalAlign='center' gapSize='big'>
            <ReqoreP style={{ textAlign: 'center' }}>
              The type you have selected does not conform to the expected types for this argument.
              Expected types are:{' '}
            </ReqoreP>
            <ReqoreTagGroup size='small' align='center'>
              {acceptedTypes?.map((t) => (
                <ReqoreTag
                  key={t}
                  label={types.value?.find((type) => type.name === t)?.display_name || t}
                />
              ))}
            </ReqoreTagGroup>
            <ReqoreP style={{ textAlign: 'center' }}>
              Are you sure you want to proceed with this type?
            </ReqoreP>
            <ReqoreCheckbox
              label="Don't show again"
              size='small'
              asSwitch
              intent={doNotShowTypeConfirmation ? 'info' : undefined}
              checked={doNotShowTypeConfirmation}
              onClick={() => setDoNotShowTypeConfirmation(!doNotShowTypeConfirmation)}
            ></ReqoreCheckbox>
          </ReqoreControlGroup>
        )}
      </ReqoreModal>
    );
  }
);
