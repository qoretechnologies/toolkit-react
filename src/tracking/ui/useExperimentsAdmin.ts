import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createExperimentsAdminClient,
  type IExperimentsAdminClient,
  type IExperimentsAdminOptions,
} from './client';
import type { IExperimentEntry, TExperimentActionResult, TLifecycleAction } from './types';

export interface IUseExperimentsAdminOptions extends IExperimentsAdminOptions {
  /** Reload the list this often (someone else may accept a test meanwhile). Default 60 s; 0 turns it off. */
  refreshMs?: number;
  /** Load nothing while false (e.g. while the overlay is hidden). Default true. */
  enabled?: boolean;
}

export interface IUseExperimentsAdmin {
  /** The list, or null before the first answer. */
  tests: IExperimentEntry[] | null;
  /** The last load's error message, or null. */
  error: string | null;
  reload: () => Promise<void>;
  /** Each action reloads the list when it resolves, and rejects with the server's words. */
  accept: (key: string, variant: string) => Promise<TExperimentActionResult>;
  remove: (key: string, variant: string) => Promise<TExperimentActionResult>;
  start: (key: string) => Promise<unknown>;
  pause: (key: string) => Promise<unknown>;
  stop: (key: string) => Promise<unknown>;
  client: IExperimentsAdminClient;
}

/**
 * The A/B test list and its actions from the qorus-api routes, for `<ExperimentsOverlay>` or
 * `<ExperimentCard>`. Optional and replaceable: both components take plain data and callbacks.
 *
 *   const admin = useExperimentsAdmin({ listUrl: '/qorus-cloud/editor/experiments?property=landing' });
 *   <ExperimentsOverlay tests={admin.tests} loadError={admin.error} onAccept={admin.accept} … />
 */
export const useExperimentsAdmin = (options: IUseExperimentsAdminOptions): IUseExperimentsAdmin => {
  const { refreshMs = 60_000, enabled = true } = options;
  // The options object is usually a fresh literal: the client follows its values, not its identity.
  const latest = useRef(options);
  latest.current = options;
  const headersKey = JSON.stringify(options.headers ?? {});
  const client = useMemo(
    () =>
      createExperimentsAdminClient({
        ...latest.current,
        fetch: (input, init) => (latest.current.fetch ?? fetch)(input, init),
      }),
    [options.listUrl, options.createUrl, options.credentials, headersKey]
  );
  const [tests, setTests] = useState<IExperimentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const list = await client.list();
      if (!alive.current) return;
      setTests(list);
      setError(null);
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    }
  }, [client]);

  useEffect(() => {
    alive.current = true;
    if (!enabled) return () => undefined;
    void reload();
    const id = refreshMs > 0 ? setInterval(() => void reload(), refreshMs) : null;
    return () => {
      alive.current = false;
      if (id) clearInterval(id);
    };
  }, [reload, enabled, refreshMs]);

  const then = useCallback(
    async <T>(promise: Promise<T>): Promise<T> => {
      const result = await promise;
      await reload();
      return result;
    },
    [reload]
  );

  const lifecycle = useCallback(
    (key: string, action: TLifecycleAction) => then(client.lifecycle(key, action)),
    [client, then]
  );

  return {
    tests,
    error,
    reload,
    accept: useCallback((key, variant) => then(client.accept(key, variant)), [client, then]),
    remove: useCallback((key, variant) => then(client.remove(key, variant)), [client, then]),
    start: useCallback((key) => lifecycle(key, 'start'), [lifecycle]),
    pause: useCallback((key) => lifecycle(key, 'pause'), [lifecycle]),
    stop: useCallback((key) => lifecycle(key, 'stop'), [lifecycle]),
    client,
  };
};
