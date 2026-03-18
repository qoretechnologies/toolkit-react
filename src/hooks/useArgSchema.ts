import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { useEffect, useState } from 'react';
import { useFetch } from './useFetch/useFetch';

export type TArgSchema = string | IQorusFormSchema | undefined;

/**
 * Resolves an arg_schema value that is either:
 * - a string → fetch from /dataprovider/arg_schemas/{arg_schema}
 * - an object → use directly
 * - undefined → no schema
 */
export const useArgSchema = (argSchema: TArgSchema) => {
  const isUrl = typeof argSchema === 'string';
  const [finalSchema, setFinalSchema] = useState<IQorusFormSchema | undefined>(
    isUrl ? undefined : (argSchema as IQorusFormSchema | undefined)
  );

  const { data, loading, load } = useFetch<IQorusFormSchema>({
    url: `/dataprovider/arg_schemas/${argSchema}`,
    loadOnMount: isUrl,
  });

  useEffect(() => {
    if (isUrl) {
      setFinalSchema(data);
    } else {
      setFinalSchema(argSchema as IQorusFormSchema | undefined);
    }
  }, [isUrl, JSON.stringify(argSchema), JSON.stringify(data)]);

  return {
    schema: finalSchema,
    loading: isUrl && loading,
    retry: load,
  };
};
