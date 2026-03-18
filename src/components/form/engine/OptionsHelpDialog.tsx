import { IReqoreModalProps, ReqoreModal } from '@qoretechnologies/reqore/dist/components/Modal';
import { TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import { Description } from '../../Description';

export interface IOptionsHelpDialogProps extends IReqoreModalProps {
  option: TQorusFormFieldSchema;
}

export const OptionsHelpDialog = ({ option, onClose }: IOptionsHelpDialogProps) => {
  if (!option) {
    return null;
  }

  return (
    <ReqoreModal
      isOpen
      label={`Help For "${option.display_name}"`}
      onClose={onClose}
      minimal
      blur={5}
      closeButtonProps={{
        transparent: true,
        flat: true,
      }}
    >
      <Description longDescription={option.desc} longDescriptionOnly />
    </ReqoreModal>
  );
};
