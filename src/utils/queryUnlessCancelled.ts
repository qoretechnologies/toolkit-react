import { IReqraftFetchResponse, IReqraftQueryConfig, isQueryCancelled, query } from './fetch';

/**
 * `query`, answering `undefined` when the request was abandoned (see
 * `isQueryCancelled`) instead of rejecting.
 *
 * For a component that fires a request from an effect and only wants to know
 * what the server said: an abandoned request has nothing to say, and left to
 * reject it escaped the effect as an unhandled rejection - which a story runner
 * reports as the story failing. Every other rejection still rejects.
 *
 * In a module of its own rather than beside `query`, so that it calls `query`
 * through the module's export: a test that mocks `../utils/fetch` reaches the
 * request this makes as well.
 */
export async function queryUnlessCancelled<T>(
  config: IReqraftQueryConfig
): Promise<IReqraftFetchResponse<T> | undefined> {
  try {
    return await query<T>(config);
  } catch (error) {
    if (isQueryCancelled(error)) {
      return undefined;
    }

    throw error;
  }
}
