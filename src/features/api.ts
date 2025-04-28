import {
  IReqraftFetchErrorResponse,
  IReqraftFetchOkResponse,
  isError,
  query,
} from '../utils/fetch';
import { FEATURES_API_URL } from './constants';

export interface QorusFeatureLoadOptions<T> {
  type?: keyof typeof FEATURES_API_URL;
  onBefore?: () => void;
  onSuccess?: (data: IReqraftFetchOkResponse<T>) => void;
  onError?: (data: IReqraftFetchErrorResponse<string>) => void;
}

export const load = async <T>({
  type,
  onBefore,
  onSuccess,
  onError,
}: QorusFeatureLoadOptions<T>) => {
  onBefore?.();

  const result = await query<T>({ url: FEATURES_API_URL[type], cache: false });

  if (isError(result)) {
    onError?.(result);

    return Promise.reject(result);
  }

  onSuccess?.(result);

  return result;
};
