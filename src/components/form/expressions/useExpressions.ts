// Copyright 2026 Qore Technologies, s.r.o.
// Fetches the expression catalogue (`GET /system?action=expressions`),
// optionally merged with a data provider's per-action `expressions_url`
// (mirrors qorus-ide's `useExpressions`). The catalogue is static per
// server version, so the default react-query cache is left on.
import { useMemo } from 'react';
import { useFetch } from '../../../hooks/useFetch/useFetch';
import { IExpressionSchema } from './types';

export interface IUseExpressionsOptions {
  /** Gate the fetch — when false the hook returns an empty list. */
  allow?: boolean;
  /** A data provider's per-action expressions endpoint (extra expressions). */
  expressionsUrl?: string;
  /** Inline extra expressions to merge (alternative to `expressionsUrl`). */
  extraExpressions?: IExpressionSchema[];
  /** Test seam — return this list directly, no request. */
  override?: IExpressionSchema[];
  /** Test seam — report this as a fetch failure, no request. */
  errorOverride?: unknown;
}

export interface IUseExpressionsResult {
  expressions: IExpressionSchema[];
  loading: boolean;
  error?: unknown;
  reload: () => void;
}

/** Unwrap `{ data: [...] }` or a bare `[...]` into the array. */
const asArray = (value: unknown): IExpressionSchema[] => {
  if (Array.isArray(value)) return value as IExpressionSchema[];
  const data = (value as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as IExpressionSchema[]) : [];
};

/**
 * Unique-merge system + extra expressions, marking shared ones `from_both`
 * and extra-only ones `from_server` (qorus-ide's marking convention).
 */
const mergeExpressions = (
  base: IExpressionSchema[],
  extra: IExpressionSchema[]
): IExpressionSchema[] => {
  if (!extra.length) return base;
  const merged: IExpressionSchema[] = base.map((expr) =>
    extra.some((e) => e.name === expr.name) ? { ...expr, from_both: true } : expr
  );
  extra.forEach((e) => {
    if (!base.some((expr) => expr.name === e.name)) {
      merged.push({ ...e, from_server: true });
    }
  });
  return merged;
};

export const useExpressions = (
  options: IUseExpressionsOptions = {}
): IUseExpressionsResult => {
  const { allow = true, expressionsUrl, extraExpressions, override, errorOverride } = options;
  const shouldFetch = allow && !override && !errorOverride;

  const system = useFetch<IExpressionSchema[]>({
    url: 'system?action=expressions&context=ui',
    method: 'GET',
    loadOnMount: shouldFetch,
  });

  const extra = useFetch<IExpressionSchema[] | { data: IExpressionSchema[] }>({
    url: expressionsUrl ?? '',
    method: 'GET',
    loadOnMount: shouldFetch && !!expressionsUrl,
    // The provider URL is often absolute; skip the `api/latest/` prefix then.
    noApiPrefix: !!expressionsUrl && /^https?:\/\//.test(expressionsUrl),
  });

  const expressions = useMemo<IExpressionSchema[]>(() => {
    if (errorOverride) return [];
    if (override) return override;
    const base = system.data ?? [];
    const extras = expressionsUrl ? asArray(extra.data) : extraExpressions ?? [];
    return mergeExpressions(base, extras);
  }, [override, errorOverride, system.data, extra.data, expressionsUrl, extraExpressions]);

  return {
    expressions,
    loading: system.loading || extra.loading,
    error: errorOverride ?? system.error ?? extra.error,
    reload: () => {
      system.load();
      if (expressionsUrl) extra.load();
    },
  };
};
