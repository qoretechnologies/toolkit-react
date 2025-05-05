import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { QOGS_API_URL } from './qogs/constants';
import { SERVICES_API_URL } from './services/constants';

export interface QorusFeatureStore<T> {
  loading: boolean;
  data: T[];
  error?: Error;
  errorData?: string;
  load: () => Promise<T>;

  itemById: (id: string | number) => T | undefined;
  idKey?: string;
  updateItem: (id: string | number, data: Partial<T>) => void;

  hasPermissions: (permissions: string[]) => boolean;
}

export const FEATURES_API_URL = {
  qogs: QOGS_API_URL,
  services: SERVICES_API_URL,
};

export const FEATURES_ICONS: Record<string, IReqoreIconName> = {
  services: 'ServerLine',
};
