/**
 * A small client for the qorus-api experiment routes the A/B test card acts on: the list with
 * results, accept, remove-variant, start, pause, stop, and creating a draft (§9.3, §9.5 of the
 * contract). Optional: the card and the overlay only take data and callbacks, so a product can
 * reach its server any other way.
 */
import type {
  IAdminExperiment,
  IExperimentEntry,
  INewExperiment,
  TExperimentActionResult,
  TLifecycleAction,
} from './types';

export class ExperimentsAdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ExperimentsAdminError';
  }
}

export type TExperimentsFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface IExperimentsAdminOptions {
  /**
   * The list route, with any query it needs: `/qorus-cloud/editor/experiments?property=landing`
   * (the editor route) or `/qorus-saas-admin/analytics/experiments?property=ide` (the admin API).
   */
  listUrl: string;
  /**
   * The route of one action. Default: the list route's path, then `/<key>/<action>`
   * (`…/experiments/signup-cta/accept`), without the list's query.
   */
  actionUrl?: (key: string, action: string) => string;
  /** Where a new draft is posted. Default: the list route's path. */
  createUrl?: string;
  /** Sent with every request (e.g. an `Authorization` header). */
  headers?: Record<string, string>;
  /** `same-origin` by default. */
  credentials?: RequestCredentials;
  /** Default: the global `fetch`. */
  fetch?: TExperimentsFetch;
}

export interface IExperimentsAdminClient {
  list(): Promise<IExperimentEntry[]>;
  accept(key: string, variant: string): Promise<TExperimentActionResult>;
  remove(key: string, variant: string): Promise<TExperimentActionResult>;
  lifecycle(key: string, action: TLifecycleAction): Promise<IAdminExperiment>;
  create(def: INewExperiment): Promise<IAdminExperiment>;
}

const pathOf = (url: string) => url.split('?')[0].replace(/\/+$/, '');

export const createExperimentsAdminClient = (
  options: IExperimentsAdminOptions
): IExperimentsAdminClient => {
  const base = pathOf(options.listUrl);
  const actionUrl =
    options.actionUrl ??
    ((key: string, action: string) => `${base}/${encodeURIComponent(key)}/${action}`);
  const doFetch: TExperimentsFetch = options.fetch ?? ((input, init) => fetch(input, init));

  const call = async <T>(url: string, body?: unknown): Promise<T> => {
    const res = await doFetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: options.credentials ?? 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const parsed = (await res.json().catch(() => null)) as {
      err?: string;
      error?: string;
      desc?: string;
      message?: string;
    } | null;
    if (!res.ok) {
      const code = parsed?.err ?? parsed?.error;
      if (res.status === 401 || res.status === 403) {
        throw new ExperimentsAdminError(
          'Not allowed to manage A/B tests on this server (the API key is missing or wrong).',
          res.status,
          code
        );
      }
      throw new ExperimentsAdminError(
        parsed?.desc ?? parsed?.message ?? code ?? `HTTP ${res.status}`,
        res.status,
        code
      );
    }
    return parsed as T;
  };

  return {
    list: () =>
      call<IExperimentEntry[] | { experiments?: IExperimentEntry[] }>(options.listUrl).then(
        (body) =>
          Array.isArray(body) ? body
          : Array.isArray(body?.experiments) ? body.experiments
          : []
      ),
    accept: (key, variant) => call<TExperimentActionResult>(actionUrl(key, 'accept'), { variant }),
    remove: (key, variant) =>
      call<TExperimentActionResult>(actionUrl(key, 'remove-variant'), { variant }),
    lifecycle: (key, action) => call<IAdminExperiment>(actionUrl(key, action), {}),
    create: (def) => call<IAdminExperiment>(options.createUrl ?? base, def),
  };
};
