import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { IReqraftFetchConfig } from '../utils/fetch';
import { ReqraftFetchProvider } from './FetchProvider';

export const ReqraftQueryClient = new QueryClient();

export interface IReqraftProviderProps {
  children: ReactNode;
  instance?: string;
  instanceToken: string;
  instanceUnauthorizedRedirect?: IReqraftFetchConfig['unauthorizedRedirect'];
  reactQueryClient?: QueryClient;
}

export const ReqraftProvider = ({
  children,
  instance,
  instanceToken,
  instanceUnauthorizedRedirect,
  reactQueryClient,
}: IReqraftProviderProps) => {
  return (
    <QueryClientProvider client={reactQueryClient || ReqraftQueryClient}>
      <ReqraftFetchProvider
        instance={instance}
        instanceToken={instanceToken}
        instanceUnauthorizedRedirect={instanceUnauthorizedRedirect}
      >
        {children}
      </ReqraftFetchProvider>
    </QueryClientProvider>
  );
};
