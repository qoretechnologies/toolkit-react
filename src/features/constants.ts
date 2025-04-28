import { QOGS_API_URL } from './qogs/constants';
import { SERVICES_API_URL } from './services/constants';

export interface QorusFeatureStore<T> {
  loading: boolean;
  data: T;
  error?: Error;
  errorData?: string;
  load: () => Promise<T>;
}

export const FEATURES_API_URL = {
  qogs: QOGS_API_URL,
  services: SERVICES_API_URL,
};
