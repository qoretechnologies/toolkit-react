import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { IReqraftContext, ReqraftContext } from '../contexts/ReqraftContext';
import { IReqraftFetchConfig, setupFetch } from '../utils/fetch';
import { ReqraftFetchProvider } from './FetchProvider';
import { ReqraftStorageProvider } from './StorageProvider';

export const ReqraftQueryClient = new QueryClient();

export interface IReqraftProviderProps extends IReqraftContext {
  children: ReactNode;
  reactQueryClient?: QueryClient;
  /*
  * If true, the component will wait for the storage to be loaded before rendering the children.
  */
  waitForStorage?: boolean;
}

export interface IReqraftOptions {
  instance?: string;
  instanceToken: string;
  instanceUnauthorizedRedirect?: IReqraftFetchConfig['unauthorizedRedirect'];
}

export const initializeReqraft = (options: IReqraftOptions ) => {
  setupFetch({
    instance: options.instance,
    instanceToken: options.instanceToken,
    unauthorizedRedirect: options.instanceUnauthorizedRedirect,
  });

  return ReqraftProvider
}

export const ReqraftProvider = ({
  appName,
  children,
  reactQueryClient,
  waitForStorage = true,
}: IReqraftProviderProps) => {
  return (
    <ReqraftContext.Provider
      value={{ appName  }}
    >
      <QueryClientProvider client={reactQueryClient || ReqraftQueryClient}>
        <ReqraftFetchProvider>
          <ReqraftStorageProvider waitForStorage={waitForStorage}>{children}</ReqraftStorageProvider>
        </ReqraftFetchProvider>
      </QueryClientProvider>
    </ReqraftContext.Provider>
  );
};
