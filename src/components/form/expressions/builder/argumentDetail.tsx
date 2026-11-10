import { IReqoreLabelProps, ReqoreLabel } from '@qoretechnologies/reqore';
import { memo } from 'react';
import { useReadableOpacity } from '../../../../hooks/useReadableOpacity';
import { useIsCalmForm } from '../../engine/formAppearance';

export interface IExpressionArgumentDetailProps extends IReqoreLabelProps {}

export const ExpressionArgumentDetail = memo((props: IExpressionArgumentDetailProps) => {
  // a detail under an argument, faint: as faint as it still reads (qorus#646)
  const opacity = useReadableOpacity(0.3);
  // calm: the words as written, never forced into capitals
  const calm = useIsCalmForm();

  return (
    <ReqoreLabel
      {...props}
      color='transparent'
      minimal
      labelEffect={{ opacity, uppercase: !calm }}
      style={{ marginTop: 'auto', ...props.style }}
      size='tiny'
    />
  );
});
