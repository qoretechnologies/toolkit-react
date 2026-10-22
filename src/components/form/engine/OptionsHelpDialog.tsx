import { IReqoreModalProps, ReqoreModal } from '@qoretechnologies/reqore/dist/components/Modal';
import { TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import { ReqoreP } from '@qoretechnologies/reqore';
import { optionTypeSentence } from '../../../helpers/qorusTypeCatalogue';
import { Description } from '../../Description';
import { useTypeName, useTypeSentenceForm } from '../typeSentenceForm';

export interface IOptionsHelpDialogProps extends IReqoreModalProps {
  option: TQorusFormFieldSchema;
}

export const OptionsHelpDialog = ({ option, onClose }: IOptionsHelpDialogProps) => {
  const typeName = useTypeName();
  const typeSentenceForm = useTypeSentenceForm();
  if (!option) {
    return null;
  }
  /* What the option takes, beside its description (qorus#646, David's review): the type is said here and in the
     name's hover, not by default beside the name. Its short description stands in for a description it lacks. */
  const takes = optionTypeSentence(option, typeName, typeSentenceForm);
  const description = option.desc || option.short_desc;

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
      {takes ?
        <ReqoreP className='options-help-type' size='small'>
          {`Takes ${takes}.`}
        </ReqoreP>
      : null}
      {description ?
        <Description longDescription={description} longDescriptionOnly />
      : null}
    </ReqoreModal>
  );
};
