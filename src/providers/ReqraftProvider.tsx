import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { IReqraftContext, ReqraftContext } from '../contexts/ReqraftContext';
import { ReqraftFetchProvider } from './FetchProvider';
import { ReqraftStorageProvider } from './StorageProvider';

export const ReqraftQueryClient = new QueryClient();

export interface IReqraftProviderProps extends IReqraftContext {
  children: ReactNode;
  reactQueryClient?: QueryClient;
}

export const ReqraftProvider = ({
  appName,
  children,
  instance,
  instanceToken,
  instanceUnauthorizedRedirect,
  reactQueryClient,
}: IReqraftProviderProps) => {
  return (
    <ReqraftContext.Provider
      value={{ appName, instanceToken, instance, instanceUnauthorizedRedirect }}
    >
      <QueryClientProvider client={reactQueryClient || ReqraftQueryClient}>
        <ReqraftFetchProvider>
          <ReqraftStorageProvider>{children}</ReqraftStorageProvider>
        </ReqraftFetchProvider>
      </QueryClientProvider>
    </ReqraftContext.Provider>
  );
};
