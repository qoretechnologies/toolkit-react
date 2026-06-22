import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { useMemo } from 'react';
import { useAsyncRetry } from 'react-use';
import { buildTemplates, ITemplatesPayload } from '../helpers/templates';
import { query } from '../utils/fetch';

export interface IUseTemplates {
  loading: boolean;
  error?: Error;
  retry: () => void;
  value?: IReqoreFormTemplates;
}

export const TemplatesCache = new Map<string, IReqoreFormTemplates>();

/**
 * Templates for form fields. Ported from qorus-ide `useTemplates` with one
 * deliberate difference: fetching `system/getContextData` is **opt-in** via
 * `interfaceContext` (the IDE defaults to `'generic'` and always fetches).
 * Without a context, consumers keep passing templates in (`localTemplates`)
 * and no request is made — the original reqraft behavior.
 */
export const useTemplates = (
  allow?: boolean,
  localTemplates: IReqoreFormTemplates = {},
  interfaceContext?: string
): IUseTemplates => {
  const shouldFetch = !!allow && !!interfaceContext;

  const globalTemplates = useAsyncRetry(async () => {
    if (shouldFetch) {
      const serverTemplates = await query<ITemplatesPayload>({
        url: `system/getContextData?interface_context=${interfaceContext}`,
        method: 'PUT',
      });

      if (serverTemplates.ok) {
        const templates = buildTemplates(serverTemplates.data) ?? {};

        TemplatesCache.set(interfaceContext!, templates);

        return templates;
      }

      return null;
    }

    return null;
  }, [shouldFetch, interfaceContext]);

  const templates: IReqoreFormTemplates | undefined = useMemo(() => {
    if (!shouldFetch) {
      return allow ? localTemplates || {} : undefined;
    }

    // If the local templates already include the global ones, use them as-is.
    if (localTemplates?.items?.some(({ label }) => label === 'Context Data')) {
      return localTemplates;
    }

    if (globalTemplates.loading && !TemplatesCache.has(interfaceContext!)) {
      return undefined;
    }

    const globalTemplatesValue =
      TemplatesCache.get(interfaceContext!) || globalTemplates.value || {};

    return {
      ...globalTemplatesValue,
      items: [...(globalTemplatesValue?.items || []), ...(localTemplates?.items || [])],
    };
  }, [allow, shouldFetch, interfaceContext, globalTemplates, localTemplates]);

  return {
    loading: shouldFetch && globalTemplates.loading && !TemplatesCache.has(interfaceContext!),
    error: globalTemplates.error,
    retry: globalTemplates.retry,
    value: templates,
  };
};
