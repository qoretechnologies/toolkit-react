import { size } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import {
  compactTypesList,
  defaultQorusTypes,
  IQorusTypeObject,
  offeredQorusTypes,
  qorusTypeDisplayName,
  qorusTypeSentenceForm,
  setServerQorusTypes,
} from '../helpers/qorusTypeCatalogue';
import { useFetch } from './useFetch/useFetch';

// the catalogue and its names are the hook's public API as they always were
export {
  compactTypesList,
  defaultQorusTypes,
  getQorusTypes,
  offeredQorusTypes,
  qorusTypeDisplayName,
  qorusTypeSentenceForm,
} from '../helpers/qorusTypeCatalogue';
export type { IQorusTypeObject } from '../helpers/qorusTypeCatalogue';

export interface IUseTypes {
  loading: boolean;
  error?: Error;
  retry: () => void;
  value?: IQorusTypeObject[];
  compactValue?: IQorusTypeObject[];
  getAcceptedTypes: (typeName: string) => string[];
  getExactMatches: (typeName: string) => string[];
  /** The type's name as a label; see `qorusTypeDisplayName`. `undefined` for no type. */
  getTypeDisplayName: (typeName: string | undefined) => string | undefined;
  /** The type's name inside a sentence; see `qorusTypeSentenceForm`. `undefined` for no type. */
  getTypeSentenceForm: (typeName: string | undefined) => string | undefined;
  /** What a picker that lists every type offers, with the type a value already has; see `offeredQorusTypes`. */
  getOfferedTypes: (held?: string | string[]) => IQorusTypeObject[];
}

export const useQorusTypes = (): IUseTypes => {
  const { data, loading, error, load } = useFetch<IQorusTypeObject[]>({
    url: '/system/qorus-type-info',
    defaultData: defaultQorusTypes,
    loadOnMount: true,
  });

  const value = size(data) ? data : defaultQorusTypes;
  // the server's answer, once there is one: what `getQorusTypes` gives code outside a component from then on
  const answered = value === defaultQorusTypes ? undefined : value;
  useEffect(() => {
    if (answered) {
      setServerQorusTypes(answered);
    }
  }, [answered]);

  const getAcceptedTypes = useCallback(
    (typeName: string): string[] => {
      const type = value?.find((t) => t.name === typeName);
      return type ? (type.types_accepted as string[]) : [];
    },
    [value]
  );

  const getExactMatches = useCallback(
    (typeName: string): string[] => {
      const type = value?.find((t) => t.name === typeName);
      return type && type.exact_match ? (type.exact_match as string[]) : [];
    },
    [value]
  );

  const getTypeDisplayName = useCallback(
    (typeName: string | undefined): string | undefined => qorusTypeDisplayName(value, typeName),
    [value]
  );

  const getTypeSentenceForm = useCallback(
    (typeName: string | undefined): string | undefined => qorusTypeSentenceForm(value, typeName),
    [value]
  );

  const getOfferedTypes = useCallback(
    (held?: string | string[]): IQorusTypeObject[] => offeredQorusTypes(value, held),
    [value]
  );

  return useMemo(
    () => ({
      loading,
      error,
      retry: load,
      value,
      compactValue: value?.filter((t) => compactTypesList.includes(t.name as string)),
      getAcceptedTypes,
      getExactMatches,
      getTypeDisplayName,
      getTypeSentenceForm,
      getOfferedTypes,
    }),
    [
      JSON.stringify(value),
      loading,
      error,
      load,
      getAcceptedTypes,
      getExactMatches,
      getTypeDisplayName,
      getTypeSentenceForm,
      getOfferedTypes,
    ]
  );
};
