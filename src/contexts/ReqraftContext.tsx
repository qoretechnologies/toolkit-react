import { createContext } from 'use-context-selector';

export interface IReqraftContext {
  appName: string;
}

export const ReqraftContext = createContext<IReqraftContext>({
  appName: '',
});
