// Copyright 2026 Qore Technologies, s.r.o.
// Where a story's network goes: the instance its Reqraft points at, the URLs
// its mocks must intercept, and the requests every story is mocked for.
//
// `query()` and `ReqraftWebSocket` build absolute URLs from the configured
// instance, and both mock layers match on the host as well as the path —
// storybook-addon-mock keys on `host + pathname`, mock-socket on the URL minus
// its query. A mock written against a hard-coded host stops matching the moment
// the instance is overridden, and the request goes out to the real network
// instead, silently. Build mock URLs with the helpers below.
import { defaultQorusTypes } from '../hooks/useQorusTypes';
import { buildReqraftApiUrl } from '../utils/fetch';
import { buildReqraftSocketUrl } from '../utils/websocket';

/**
 * What storybook-addon-mock accepts as a response. Anything else — a bare
 * number or string — fails the addon's validation and the entry is kept but
 * never matched, so the request goes out to the network with no warning.
 */
export type TStoryMockResponse = object | ((request: unknown) => unknown);

export interface IStoryMockRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  status: number;
  response: TStoryMockResponse;
}

/**
 * The instance every story's Reqraft is initialized with. Override it with
 * `REACT_APP_QORUS_INSTANCE` (or `QORUS_INSTANCE`) to run live stories against
 * your own Qorus; mocks built from it follow the override.
 */
export const STORY_QORUS_INSTANCE =
  process.env.REACT_APP_QORUS_INSTANCE || 'https://hq.qoretechnologies.com:8092/';

/** The URL `query()` requests for `path`. */
export const storyApiUrl = (path: string): string =>
  buildReqraftApiUrl(STORY_QORUS_INSTANCE, path);

/**
 * The URL `ReqraftWebSocket` dials for `path`, token omitted — mock-socket
 * matches servers without the query string.
 */
export const storySocketUrl = (path: string): string =>
  buildReqraftSocketUrl(STORY_QORUS_INSTANCE, path);

/** A GET of `path` answered with `response`. */
const mockGet = (path: string, response: TStoryMockResponse): IStoryMockRequest[] => [
  { url: storyApiUrl(path), method: 'GET', status: 200, response },
];

/**
 * The type catalogue, pinned to the built-in list. `useQorusTypes` uses a
 * reachable server's list *instead of* the built-in one, so an unmocked story
 * renders whichever labels that server happens to have — and every FormEngine
 * shows its loading skeleton until the request settles, which against an
 * unreachable instance is never.
 */
const QORUS_TYPE_INFO_MOCK_DATA = mockGet('system/qorus-type-info', defaultQorusTypes);

/**
 * The system expression catalogue, empty. `useExpressions` fetches it whenever
 * functions are allowed — even when the story passes its own list, which is
 * merged in as extras — and TemplateField shows a skeleton in place of "Use
 * Expression" until it arrives. Stories that need functions provide them
 * (`expressions`, or their own `mockData` for this URL).
 */
const EXPRESSIONS_CATALOGUE_MOCK_DATA = mockGet('system?action=expressions&context=ui', []);

/**
 * `ReqraftWebSocket`'s server probe, which every reconnect attempt awaits
 * before it dials. Unanswered, no attempt is ever made — a mock socket server
 * that comes back is never reconnected to, and one that stays down is never
 * given up on. The probe only needs an answer; its body is not read.
 */
const SERVER_STATUS_MOCK_DATA = mockGet('system/pid', {});

/**
 * Requests components make on their own, whatever the story is about —
 * mounting a FormEngine fetches the type catalogue; allowing functions fetches
 * the expression catalogue; a reconnecting socket probes the server.
 * Registered for every story as storybook-addon-mock's `globalMockData`
 * (`.storybook/preview.tsx`, and mirrored for the Vitest run in
 * `.storybook/vitest.setup.ts`); a story's own `mockData` entry for the same
 * URL takes precedence.
 */
export const GLOBAL_STORY_MOCK_DATA: IStoryMockRequest[] = [
  ...QORUS_TYPE_INFO_MOCK_DATA,
  ...EXPRESSIONS_CATALOGUE_MOCK_DATA,
  ...SERVER_STATUS_MOCK_DATA,
];
