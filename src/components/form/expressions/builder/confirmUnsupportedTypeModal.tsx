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
  ({
    acceptedTypes,
    children,
    // this modal's own prop; ReqoreModal does not take it, so it stops here
    exactMatch, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...rest
  }: IConfirmUnsupportedTypeModalProps) => {
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
              This value needs one of these types:
            </ReqoreP>
            <ReqoreTagGroup size='small' align='center'>
              {acceptedTypes?.map((t) => (
                <ReqoreTag key={t} label={types.getTypeDisplayName(t)} />
              ))}
            </ReqoreTagGroup>
            <ReqoreP style={{ textAlign: 'center' }}>
              Use this type anyway?
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
