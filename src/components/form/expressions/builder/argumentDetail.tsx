import { IReqoreLabelProps, ReqoreLabel } from '@qoretechnologies/reqore';
import { memo } from 'react';

export interface IExpressionArgumentDetailProps extends IReqoreLabelProps {}

export const ExpressionArgumentDetail = memo((props: IExpressionArgumentDetailProps) => {
  return (
    <ReqoreLabel
      {...props}
      color='transparent'
      minimal
      labelEffect={{ opacity: 0.3, uppercase: true }}
      style={{ marginTop: 'auto', ...props.style }}
      size='tiny'
    />
  );
});
