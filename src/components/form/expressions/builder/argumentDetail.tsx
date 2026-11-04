import { IReqoreLabelProps, ReqoreLabel } from '@qoretechnologies/reqore';
import { memo } from 'react';
import { useReadableOpacity } from '../../../../hooks/useReadableOpacity';

export interface IExpressionArgumentDetailProps extends IReqoreLabelProps {}

export const ExpressionArgumentDetail = memo((props: IExpressionArgumentDetailProps) => {
  // a detail under an argument, faint: as faint as it still reads (qorus#646)
  const opacity = useReadableOpacity(0.3);

  return (
    <ReqoreLabel
      {...props}
      color='transparent'
      minimal
      labelEffect={{ opacity, uppercase: true }}
      style={{ marginTop: 'auto', ...props.style }}
      size='tiny'
    />
  );
});
