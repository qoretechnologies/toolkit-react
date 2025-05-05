import { IReqraftQueryConfig, isError, query } from '../utils/fetch';
import { FEATURES_API_URL } from './constants';

export interface QorusFeatureLoadOptions<T> extends Partial<IReqraftQueryConfig<T>> {
  type?: keyof typeof FEATURES_API_URL;
}

export interface QorusFeatureEnableOptions<T> extends QorusFeatureLoadOptions<T> {
  id?: string | number;
  enable?: boolean;
}

export const load = async <T>({ type, ...options }: QorusFeatureLoadOptions<T>) => {
  const result = await query<T>({ ...options, url: FEATURES_API_URL[type], cache: false });

  if (isError(result)) {
    return Promise.reject(result);
  }

  return result;
};

export const toggleEnabled = async <T>({
  type,
  id,
  enable,
  ...options
}: QorusFeatureEnableOptions<T>) => {
  const result = await query<T>({
    ...options,
    method: 'PUT',
    url: `${FEATURES_API_URL[type]}/${id}?action=${enable ? 'enable' : 'disable'}`,
    cache: false,
  });

  if (isError(result)) {
    return Promise.reject(result);
  }

  return result;
};
