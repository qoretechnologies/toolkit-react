import { reqraftLabels, useReqraftLabels } from '../helpers/reqraftLabels';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { useMemo } from 'react';
import { useAsyncRetry } from 'react-use';
import { buildTemplates, ITemplatesPayload } from '../helpers/templates';
import { queryUnlessCancelled } from '../utils/queryUnlessCancelled';

export interface IUseTemplates {
  loading: boolean;
  error?: Error;
  retry: () => void;
  value?: IReqoreFormTemplates;
}

export const TemplatesCache = new Map<string, IReqoreFormTemplates>();

/* What each list was built from, and in which words: a list outlives the forms that asked for it, so one built before
   the host's language changed is built again from what the server said, rather than asked for again. */
const payloadsBuilt = new Map<
  string,
  { payload: ITemplatesPayload; words: ReturnType<typeof reqraftLabels>['templateList'] }
>();

const cachedTemplates = (interfaceContext: string): IReqoreFormTemplates | undefined => {
  const built = payloadsBuilt.get(interfaceContext);
  const words = reqraftLabels().templateList;
  if (built && built.words !== words && TemplatesCache.has(interfaceContext)) {
    TemplatesCache.set(interfaceContext, buildTemplates(built.payload) ?? {});
    payloadsBuilt.set(interfaceContext, { payload: built.payload, words });
  }
  return TemplatesCache.get(interfaceContext);
};

/**
 * Hand this hook a `getContextData` payload the host has already fetched.
 *
 * The host and this library keep SEPARATE caches over one API, so a page that
 * has already paid for the context data pays again here — and, worse, waits for
 * it: `FormEngine` will not render a field before its templates exist, because
 * an any-typed field with no templates falls back to the type picker and asks
 * the author to choose `string`/`int`/`hash` for a value they already captured.
 *
 * Measured on the live alert rule: three form sections were placeholders from
 * 1459ms to 2039ms and, when they cleared, 193 elements that had been on screen
 * for ~590ms dropped 67px, because the placeholder is not the height of the
 * form it stands in for. Seeded, the form has its templates on its FIRST render
 * and there is no placeholder to swap out at all.
 *
 * Same shape as `seedQueryCache` for the type catalogue, and deliberately
 * first-write-wins: a real fetch that has already answered is not overwritten.
 */
export const seedTemplatesCache = (
  interfaceContext: string,
  payload: ITemplatesPayload
): void => {
  if (!interfaceContext || TemplatesCache.has(interfaceContext)) {
    return;
  }

  const templates = buildTemplates(payload);

  if (templates) {
    TemplatesCache.set(interfaceContext, templates);
    payloadsBuilt.set(interfaceContext, { payload, words: reqraftLabels().templateList });
  }
};

/**
 * Templates for form fields. Ported from qorus-ide `useTemplates` with one
 * deliberate difference: fetching `system/getContextData` is **opt-in** via
 * `interfaceContext` (the IDE defaults to `'generic'` and always fetches).
 * Without a context, consumers keep passing templates in (`localTemplates`)
 * and no request is made — the original reqraft behavior.
 */
/** No local templates: one object, so a caller that passes none gets the same answer on every render. */
const NO_LOCAL_TEMPLATES: IReqoreFormTemplates = {};

export const useTemplates = (
  allow?: boolean,
  localTemplates: IReqoreFormTemplates = NO_LOCAL_TEMPLATES,
  interfaceContext?: string
): IUseTemplates => {
  const listWords = useReqraftLabels().templateList;
  const shouldFetch = !!allow && !!interfaceContext;

  const globalTemplates = useAsyncRetry(async () => {
    if (shouldFetch) {
      /* Already answered — by a previous mount or by the host seeding it. The
         cache was consulted for `loading` and for the value but not here, so a
         seeded page still issued the request it had been handed the answer to. */
      const cached = cachedTemplates(interfaceContext!);
      if (cached) {
        return cached;
      }

      const serverTemplates = await queryUnlessCancelled<ITemplatesPayload>({
        url: `system/getContextData?interface_context=${interfaceContext}`,
        method: 'PUT',
      });

      // An abandoned request (no response) is not an `error` for the caller to
      // show; nothing is cached, so the next mount asks again.
      if (serverTemplates?.ok) {
        const templates = buildTemplates(serverTemplates.data) ?? {};

        TemplatesCache.set(interfaceContext!, templates);
        payloadsBuilt.set(interfaceContext!, {
          payload: serverTemplates.data,
          words: reqraftLabels().templateList,
        });

        return templates;
      }

      return null;
    }

    return null;
  }, [shouldFetch, interfaceContext]);

  /* Kept on what the request answered, not on the request's state: useAsyncRetry hands back a new state object on
     every render, and the templates were a new object with it, and so was every form's row context built on them,
     on every render of the form. */
  const templates: IReqoreFormTemplates | undefined = useMemo(() => {
    if (!shouldFetch) {
      return allow ? localTemplates || {} : undefined;
    }

    /* If the local templates already include the global ones, use them as-is: the server's own context, marked as
       it is built (`serverContext`), or named so by a host that builds its own list (in either case). */
    if (
      localTemplates?.items?.some(
        (item) =>
          (item.metadata as { serverContext?: boolean } | undefined)?.serverContext ||
          /^context data$/i.test(String(item.label ?? ''))
      )
    ) {
      return localTemplates;
    }

    if (globalTemplates.loading && !TemplatesCache.has(interfaceContext!)) {
      return undefined;
    }

    const globalTemplatesValue = cachedTemplates(interfaceContext!) || globalTemplates.value || {};

    return {
      ...globalTemplatesValue,
      items: [...(globalTemplatesValue?.items || []), ...(localTemplates?.items || [])],
    };
  }, [
    allow,
    shouldFetch,
    interfaceContext,
    globalTemplates.loading,
    globalTemplates.value,
    localTemplates,
    listWords,
  ]);

  const loading = shouldFetch && globalTemplates.loading && !TemplatesCache.has(interfaceContext!);
  const { error, retry } = globalTemplates;

  // One answer while nothing in it changes: a form builds its fields on it (`renderOption`).
  return useMemo(() => ({ loading, error, retry, value: templates }), [loading, error, retry, templates]);
};
