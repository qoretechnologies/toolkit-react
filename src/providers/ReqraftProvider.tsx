import { ReactNode } from 'react';
import { ReqraftFetchProvider } from './FetchProvider';

export interface IReqraftProviderProps {
  children: ReactNode;
  instance?: string;
  instanceToken: string;
  instanceUnauthorizedRedirect?: string;
}

export const ReqraftProvider = ({
  children,
  instance,
  instanceToken,
  instanceUnauthorizedRedirect,
}: IReqraftProviderProps) => {
  return (
    <ReqraftFetchProvider
      instance={instance}
      instanceToken={instanceToken}
      instanceUnauthorizedRedirect={instanceUnauthorizedRedirect}
    >
      {children}
    </ReqraftFetchProvider>
  );
};
