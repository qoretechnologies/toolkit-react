import { size } from 'lodash';
import { useCallback, useMemo } from 'react';
import {
  compactTypesList,
  defaultQorusTypes,
  IQorusTypeObject,
  qorusTypeDisplayName,
  qorusTypeSentenceForm,
} from '../helpers/qorusTypeCatalogue';
import { useFetch } from './useFetch/useFetch';

// the catalogue and its names are the hook's public API as they always were
export {
  compactTypesList,
  defaultQorusTypes,
  getQorusTypes,
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
  getTypeDisplayName: (typeName: string) => string;
  /** The type's name inside a sentence; see `qorusTypeSentenceForm`. */
  getTypeSentenceForm: (typeName: string) => string;
}

export const useQorusTypes = (): IUseTypes => {
  const { data, loading, error, load } = useFetch<IQorusTypeObject[]>({
    url: '/system/qorus-type-info',
    defaultData: defaultQorusTypes,
    loadOnMount: true,
  });

  const value = size(data) ? data : defaultQorusTypes;

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
    (typeName: string): string => qorusTypeDisplayName(value, typeName),
    [value]
  );

  const getTypeSentenceForm = useCallback(
    (typeName: string): string => qorusTypeSentenceForm(value, typeName),
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
    ]
  );
};
