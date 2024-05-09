import { ReactNode } from 'react';

export interface IReqraftStorageProviderProps {
  children: ReactNode;
}

export const ReqraftStorageProvider = ({ children }: IReqraftStorageProviderProps) => {
  return <>{children}</>;
};
