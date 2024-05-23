import { IReqoreUIProviderProps } from '@qoretechnologies/reqore/dist/containers/UIProvider';
import { Meta } from '@storybook/react';
import { IReqraftProviderProps } from './providers/ReqraftProvider';

export type StoryMeta<
  Component extends keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>,
  AdditionalArgs = Record<string, any>,
> = Meta<
  React.ComponentProps<Component> &
    AdditionalArgs & {
      reqoreOptions: IReqoreUIProviderProps['options'];
      reqraftOptions: IReqraftProviderProps;
    }
>;
