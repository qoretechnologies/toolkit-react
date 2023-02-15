import { useCallback } from 'react';
import { ReqoreIcon, ReqoreP } from '../..';
import { TSizes } from '../../constants/sizes';
import { TReqoreIntent } from '../../constants/theme';
import { IWithReqoreEffect } from '../../types/global';
import ReqoreControlGroup, { IReqoreControlGroupProps } from '../ControlGroup';
import { IReqoreEffect, TReqoreEffectColor } from '../Effect';

export interface IReqoreSpinnerProps
  extends Omit<IReqoreControlGroupProps, 'children' | 'size'>,
    IWithReqoreEffect {
  size?: TSizes | string;
  intent?: TReqoreIntent;
  children?: any;
  type?: 2 | 3 | 4 | 5;
  iconColor?: TReqoreEffectColor;
  labelEffect?: IReqoreEffect;
  iconMargin?: 'right' | 'left' | 'both';
  centered?: boolean;
}

export const ReqoreSpinner = ({
  size,
  intent,
  children,
  type,
  iconColor,
  labelEffect,
  effect,
  iconMargin,
  centered,
  ...rest
}: IReqoreSpinnerProps) => {
  const renderContent = useCallback(() => {
    return (
      <ReqoreIcon
        icon={!type ? 'LoaderLine' : `Loader${type}Line`}
        color={iconColor || intent}
        size={size}
        effect={effect}
        animation='spin'
        className='reqore-spinner'
        margin={iconMargin || (children ? 'right' : undefined)}
      />
    );
  }, [size, intent, type, children, iconColor]);

  if (children) {
    return (
      <ReqoreControlGroup
        {...rest}
        vertical={centered}
        horizontalAlign={centered ? 'center' : undefined}
        verticalAlign='center'
      >
        {renderContent()}
        <ReqoreP
          size={size}
          intent={intent}
          effect={labelEffect}
          className='reqore-spinner-wrapper'
        >
          {children}
        </ReqoreP>
      </ReqoreControlGroup>
    );
  }

  return <>{renderContent()}</>;
};
