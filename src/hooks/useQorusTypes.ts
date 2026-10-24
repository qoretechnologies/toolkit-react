import { size } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import {
  compactTypesList,
  defaultQorusTypes,
  IQorusTypeObject,
  offeredQorusTypes,
  qorusTypeDisplayName,
  qorusTypeEntry,
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
  qorusTypeEntry,
  qorusTypeSentenceForm,
  UNKNOWN_TYPE_NAME,
} from '../helpers/qorusTypeCatalogue';
export type { IQorusTypeObject } from '../helpers/qorusTypeCatalogue';

export interface IUseTypes {
  loading: boolean;
  error?: Error;
  retry: () => void;
  value?: IQorusTypeObject[];
  compactValue?: IQorusTypeObject[];
  /** What a place of the type takes; a type the catalogue does not list, by its `baseType` (`qorusTypeEntry`). */
  getAcceptedTypes: (typeName: string, baseType?: string) => string[];
  getExactMatches: (typeName: string, baseType?: string) => string[];
  /** The type's name as a label; see `qorusTypeDisplayName`. `undefined` for no type. */
  getTypeDisplayName: (typeName: string | undefined, baseType?: string) => string | undefined;
  /** The type's name inside a sentence; see `qorusTypeSentenceForm`. `undefined` for no type. */
  getTypeSentenceForm: (typeName: string | undefined, baseType?: string) => string | undefined;
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
    (typeName: string, baseType?: string): string[] =>
      (qorusTypeEntry(value, typeName, baseType)?.types_accepted as string[]) ?? [],
    [value]
  );

  const getExactMatches = useCallback(
    (typeName: string, baseType?: string): string[] =>
      (qorusTypeEntry(value, typeName, baseType)?.exact_match as string[]) ?? [],
    [value]
  );

  const getTypeDisplayName = useCallback(
    (typeName: string | undefined, baseType?: string): string | undefined =>
      qorusTypeDisplayName(value, typeName, baseType),
    [value]
  );

  const getTypeSentenceForm = useCallback(
    (typeName: string | undefined, baseType?: string): string | undefined =>
      qorusTypeSentenceForm(value, typeName, baseType),
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
