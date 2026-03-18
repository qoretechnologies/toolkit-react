import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { TQorusType } from '@qoretechnologies/ts-toolkit';
import { size } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useFetch } from './useFetch/useFetch';

export interface IQorusTypeObject {
  display_name: string;
  name: TQorusType | string;
  desc?: string;
  short_desc?: string;
  icon?: IReqoreIconName;
  types_accepted: (TQorusType | string)[];
  exact_match?: (TQorusType | string)[];
}

export interface IUseTypes {
  loading: boolean;
  error?: Error;
  retry: () => void;
  value?: IQorusTypeObject[];
  compactValue?: IQorusTypeObject[];
  getAcceptedTypes: (typeName: string) => string[];
  getExactMatches: (typeName: string) => string[];
  getTypeDisplayName: (typeName: string) => string;
}

export const compactTypesList = ['richtext', 'float', 'hash', 'list', 'bool', 'date', 'binary'];

export const defaultQorusTypes: IQorusTypeObject[] = [
  {
    name: 'any',
    display_name: 'Any',
    short_desc: 'Any data type',
    desc: 'Any data type',
    types_accepted: ['any'],
    exact_match: ['any'],
  },
  {
    name: 'context',
    display_name: 'Context',
    short_desc: 'The data type is determined by the context value chosen',
    desc: 'The data type is determined by the context value chosen',
    types_accepted: ['any'],
    exact_match: ['any'],
  },
  {
    name: 'string',
    display_name: 'String',
    short_desc: 'String data',
    desc: 'String data',
    types_accepted: ['any'],
    exact_match: ['string', 'richtext'],
  },
  {
    name: 'richtext',
    display_name: 'Text',
    short_desc: 'Rich text string data',
    desc: 'Rich text string data',
    types_accepted: ['any'],
    exact_match: ['string', 'richtext'],
  },
  {
    name: 'int',
    display_name: 'Integer',
    short_desc: '64-bit integer',
    desc: '64-bit integer',
    types_accepted: ['int', 'integer'],
    exact_match: ['int', 'integer'],
  },
  {
    name: 'float',
    display_name: 'Number',
    short_desc: 'Double-precision floating-point number',
    desc: 'Double-precision floating-point number',
    types_accepted: ['float', 'int', 'integer'],
    exact_match: ['float', 'int', 'integer'],
  },
  {
    name: 'number',
    display_name: 'Scientific Number',
    short_desc: 'Arbitrary-precision floating-point number',
    desc: 'Arbitrary-precision floating-point number',
    types_accepted: ['number', 'float', 'int', 'integer'],
    exact_match: ['number', 'float', 'int', 'integer'],
  },
  {
    name: 'bool',
    display_name: 'Boolean',
    short_desc: 'Boolean value',
    desc: 'Boolean value',
    types_accepted: ['bool'],
    exact_match: ['bool'],
  },
  {
    name: 'date',
    display_name: 'Date',
    short_desc: 'Date-time value',
    desc: 'Date-time value',
    types_accepted: ['date'],
    exact_match: ['date'],
  },
  {
    name: 'binary',
    display_name: 'Binary',
    short_desc: 'Binary value',
    desc: 'Binary value',
    types_accepted: ['binary'],
    exact_match: ['binary'],
  },
  {
    name: 'data',
    display_name: 'Data',
    short_desc: 'Binary or string value',
    desc: 'Binary or string value',
    types_accepted: ['string', 'richtext', 'binary'],
    exact_match: ['string', 'richtext', 'binary'],
  },
  {
    name: 'hash',
    display_name: 'Hash',
    short_desc: 'Ordered key-value pair / hash',
    desc: 'Ordered key-value pair / hash',
    types_accepted: ['hash'],
    exact_match: ['hash'],
  },
  {
    name: 'list',
    display_name: 'List',
    short_desc: 'List',
    desc: 'List',
    types_accepted: ['list'],
    exact_match: ['list'],
  },
  {
    name: 'rgbcolor',
    display_name: 'Color',
    short_desc: 'RGB Color value',
    desc: 'RGB Color value',
    types_accepted: ['rgbcolor'],
    exact_match: ['rgbcolor'],
  },
  {
    name: 'workflow',
    display_name: 'Workflow',
    short_desc: 'Qorus workflow',
    desc: 'Qorus workflow',
    types_accepted: ['workflow', 'string', 'richtext'],
    exact_match: ['workflow', 'string', 'richtext'],
  },
  {
    name: 'service',
    display_name: 'Service',
    short_desc: 'Qorus service',
    desc: 'Qorus service',
    types_accepted: ['service', 'string', 'richtext'],
    exact_match: ['service', 'string', 'richtext'],
  },
  {
    name: 'job',
    display_name: 'Job',
    short_desc: 'Qorus job',
    desc: 'Qorus job',
    types_accepted: ['job', 'string', 'richtext'],
    exact_match: ['job', 'string', 'richtext'],
  },
  {
    name: 'mapper',
    display_name: 'Mapper',
    short_desc: 'Qorus mapper',
    desc: 'Qorus mapper',
    types_accepted: ['mapper', 'string', 'richtext'],
    exact_match: ['mapper', 'string', 'richtext'],
  },
  {
    name: 'connection',
    display_name: 'Connection',
    short_desc: 'Qorus connection',
    desc: 'Qorus connection',
    types_accepted: ['connection', 'string', 'richtext'],
    exact_match: ['connection', 'string', 'richtext'],
  },
];

export const getQorusTypes = (): IQorusTypeObject[] => defaultQorusTypes;

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
    (typeName: string): string => {
      const type = value?.find((t) => t.name === typeName);
      return type ? type.display_name : typeName;
    },
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
    }),
    [JSON.stringify(value), loading, error, load, getAcceptedTypes, getExactMatches, getTypeDisplayName]
  );
};
