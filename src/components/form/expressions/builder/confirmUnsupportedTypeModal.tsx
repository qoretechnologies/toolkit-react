import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
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
    const exprWords = useReqraftLabels().expression;
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
        label={exprWords.confirmTypeSelection}
        {...rest}
        customZIndex={1000000}
      >
        {children ? (
          children
        ) : (
          // read from the left, as a dialog's text is (the mismatched-types dialog reads the same)
          <ReqoreControlGroup vertical fluid gapSize='big'>
            <ReqoreP>{exprWords.needsOneOfTypes}</ReqoreP>
            <ReqoreTagGroup size='small'>
              {acceptedTypes?.map((t) => (
                <ReqoreTag key={t} label={types.getTypeDisplayName(t)} />
              ))}
            </ReqoreTagGroup>
            <ReqoreP>{exprWords.useTypeAnyway}</ReqoreP>
            <ReqoreCheckbox
              label={exprWords.dontShowAgain}
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
