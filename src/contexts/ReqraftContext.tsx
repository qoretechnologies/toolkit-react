import { createContext } from 'use-context-selector';
import { IReqraftFetchConfig } from '../utils/fetch';

export interface IReqraftContext {
  appName: string;
  instance?: string;
  instanceToken: string;
  instanceUnauthorizedRedirect?: IReqraftFetchConfig['unauthorizedRedirect'];
}

export const ReqraftContext = createContext<IReqraftContext>({
  appName: '',
  instance: '',
  instanceToken: '',
  instanceUnauthorizedRedirect: undefined,
});
