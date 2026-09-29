import type { IUtm } from './types';

const UTM_FIELDS = ['source', 'medium', 'campaign', 'term', 'content'] as const;

/** The `utm_*` parameters of a query string, or null when there are none. */
export const parseUtm = (search: string): IUtm | null => {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const utm: IUtm = {};
  for (const f of UTM_FIELDS) {
    const v = params.get(`utm_${f}`)?.trim();
    if (v) utm[f] = v.slice(0, 200);
  }
  return Object.keys(utm).length ? utm : null;
};

/** `{ source: 'x' }` → `[['utm_source', 'x']]`, in a stable order. */
export const utmParams = (utm: IUtm | null | undefined): [string, string][] =>
  utm ? UTM_FIELDS.filter((f) => utm[f]).map((f) => [`utm_${f}`, utm[f] as string]) : [];
