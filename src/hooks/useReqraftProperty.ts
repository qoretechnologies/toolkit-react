import { useContextSelector } from 'use-context-selector';
import { IReqraftContext, ReqraftContext } from '../contexts/ReqraftContext';

export const useReqraftProperty = <T extends keyof IReqraftContext>(
  property: T
): IReqraftContext[T] => {
  const contextProperty = useContextSelector(ReqraftContext, (value) => {
    if (!(property in value)) {
      throw new Error(`Reqraft context property ${property} not found`);
    }

    return value[property];
  });

  return contextProperty;
};
