import { ReqoreMessage, ReqoreP, ReqoreSpinner, ReqoreTree } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { expect, waitFor, within } from 'storybook/test';
import { testsWaitForText } from '../../../__tests__/utils';
import { FetchContext, IReqraftFetchContext } from '../../contexts/FetchContext';
import { storyApiUrl } from '../../stories/storyNetwork';
import { StoryMeta } from '../../types';
import { IReqraftFetchResponse, seedQueryCache } from '../../utils/fetch';
import { useFetch } from './useFetch';

const meta = {
  title: 'Hooks/useFetch',
  render: (args) => {
    const {
      data = {},
      errorData,
      load,
      loading,
    } = useFetch<any>({ url: 'public/info', method: args.method, loadOnMount: true });

    return loading ? (
      <ReqoreSpinner />
    ) : (
      <>
        <ReqoreTree
          data={errorData || data}
          bottomActions={[{ label: 'Refetch', onClick: load }]}
        />
      </>
    );
  },
} as StoryMeta<any>;

export default meta;
export type Story = StoryObj<typeof meta>;

export const Get: Story = {
  args: {
    method: 'GET',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a useFetch demo that issues a GET against /public/info on mount and displays the returned Qorus system info as a tree.',
      },
    },
    mockData: [
      {
        // An array of mock objects which will add in every story
        url: storyApiUrl('public/info'),
        method: 'GET',
        status: 200,
        delay: 200,
        response: {
          'instance-key': 'rippy-dev1',
          'omq-version': '6.1.0_prod',
          'omq-build': 'd115c45fbed95c03327aea880be455137e9778ba',
          'qore-version': '2.0.0',
          'omq-schema': 'omq@omq',
          edition: 'Enterprise',
          tz_region: 'Europe/Prague',
          tz_utc_offset: 3600,
          noauth: false,
        },
      },
    ],
  },
  play: async () => {
    await testsWaitForText('"rippy-dev1"');
  },
};

export const Put: Story = {
  args: {
    method: 'PUT',
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Get`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders a useFetch demo that issues a PUT against /public/info on mount and displays the returned success status.',
      },
    },
    mockData: [
      {
        // An array of mock objects which will add in every story
        url: storyApiUrl('public/info'),
        method: 'PUT',
        status: 200,
        response: {
          status: 'Successfuly updated',
        },
      },
    ],
  },
  play: async () => {
    await testsWaitForText('"Successfuly updated"');
  },
};

export const Post: Story = {
  args: {
    method: 'POST',
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Get`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders a useFetch demo that issues a POST against /public/info on mount and displays the returned success status.',
      },
    },
    mockData: [
      {
        // An array of mock objects which will add in every story
        url: storyApiUrl('public/info'),
        method: 'POST',
        status: 200,
        response: {
          status: 'Successfuly created',
        },
      },
    ],
  },
  play: async () => {
    await testsWaitForText('"Successfuly created"');
  },
};

export const Del: Story = {
  args: {
    method: 'DELETE',
  },
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Get`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders a useFetch demo that issues a DELETE against /public/info on mount and displays the returned success status.',
      },
    },
    mockData: [
      {
        // An array of mock objects which will add in every story
        url: storyApiUrl('public/info'),
        method: 'DELETE',
        status: 200,
        response: {
          status: 'Successfuly deleted',
        },
      },
    ],
  },
  play: async () => {
    await testsWaitForText('"Successfuly deleted"');
  },
};

export const Error409: Story = {
  args: {
    method: 'POST',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a useFetch demo that issues a POST returning a 409 error — the hook exposes errorData and the Qorus stack trace is rendered in place of the response.',
      },
    },
    mockData: [
      {
        // An array of mock objects which will add in every story
        url: storyApiUrl('public/info'),
        method: 'POST',
        status: 409,
        response: {
          type: 'User',
          file: 'AbstractQorusCoreService.qc',
          line: 871,
          endline: 871,
          source: '',
          offset: 0,
          lang: 'Qore',
          callstack: [
            {
              function: 'AbstractQorusCoreService::logRethrowException',
              line: 984,
              endline: 984,
              file: '/export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm',
              offset: 0,
              lang: 'Qore',
              typecode: 3,
              type: 'rethrow',
            },
            {
              function: 'AbstractQorusCoreService::logRethrowException',
              line: -1,
              endline: -1,
              file: '<builtin>',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 1,
              statementid: 12282,
            },
            {
              function: 'ServiceManagerBase::callMethod',
              line: 3964,
              endline: 3964,
              file: 'QorusRestApiHandlerV8.qc',
              offset: 0,
              lang: 'Qore',
              typecode: 1,
              type: 'builtin',
              programid: 1,
              statementid: 12282,
            },
            {
              function: 'FsmsRestClassV8::doCreateFsmDraftFromText',
              line: 3951,
              endline: 3951,
              file: 'QorusRestApiHandlerV8.qc',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 1,
              statementid: 12266,
            },
            {
              function: 'FsmsRestClassV8::postCreateDraftFromText',
              line: -1,
              endline: -1,
              file: '<builtin>',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 20,
              statementid: 28,
            },
            {
              function: 'call_object_method_args',
              line: 941,
              endline: 941,
              file: '/export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm',
              offset: 0,
              lang: 'Qore',
              typecode: 1,
              type: 'builtin',
              programid: 20,
              statementid: 28,
            },
            {
              function: 'AbstractRestClass::dispatch',
              line: 1544,
              endline: 1544,
              file: 'QorusRestApiHandler.qc',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 1,
              statementid: 22271,
            },
            {
              function: 'QorusRestClass::dispatch',
              line: 849,
              endline: 849,
              file: '/export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 20,
              statementid: 117,
            },
            {
              function: 'AbstractRestClass::handleRequest',
              line: 860,
              endline: 860,
              file: '/export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 20,
              statementid: 121,
            },
            {
              function: 'AbstractRestClass::handleRequest',
              line: 1569,
              endline: 1569,
              file: '/export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 20,
              statementid: 415,
            },
            {
              function: 'RestHandler::dispatchRequest',
              line: 1476,
              endline: 1476,
              file: '/export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 20,
              statementid: 270,
            },
            {
              function: 'RestHandler::handleRequest',
              line: 17303,
              endline: 17303,
              file: 'QorusRestApiHandler.qc',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 1,
              statementid: 27032,
            },
            {
              function: 'WebAppHandler::handleRequest',
              line: 1781,
              endline: 1781,
              file: '/export/home2/dnichols/src/Qorus/current/qlib/HttpServer.qm',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 28,
              statementid: 931,
            },
            {
              function: 'HttpServer::handleRequest',
              line: 2797,
              endline: 2798,
              file: '/export/home2/dnichols/src/Qorus/current/qlib/HttpServer.qm',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 28,
              statementid: 346,
            },
            {
              function: 'HttpListener::connectionThread',
              line: 2599,
              endline: 2599,
              file: '/export/home2/dnichols/src/Qorus/current/qlib/HttpServer.qm',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
              programid: 28,
              statementid: 2,
            },
            {
              function: 'HttpListener::<anonymous closure>',
              line: -1,
              endline: -1,
              file: '<builtin>',
              offset: 0,
              lang: 'Qore',
              typecode: 0,
              type: 'user',
            },
          ],
          err: 'ACTION-ERROR',
          desc: 'system service: nli v6.1 (217):97 (Qore source "/export/home2/dnichols/src/Qorus/git/qorus/system/nli-v6.1.qsd":97) (while calling system.nli.buildFsm()): User exception: system service: nli v6.1 (217):97 (Qore source "/export/home2/dnichols/src/Qorus/git/qorus/system/nli-v6.1.qsd":97): ACTION-ERROR: Could not match any apps from the input\n  Nli::buildFsm() called at <builtin>:-1 (Qore user code)\n  call_object_method_args() called at LocalQorusService.qc:957 (Qore builtin code)\n  LocalQorusService::callMethodImpl() called at Service.qc:101 (Qore user code)\n  Service::callMethodImpl() called at <builtin>:-1 (Qore user code)\n  ServiceManagerBase::callMethod() called at QorusRestApiHandlerV8.qc:3964 (Qore builtin code)\n  FsmsRestClassV8::doCreateFsmDraftFromText() called at QorusRestApiHandlerV8.qc:3951 (Qore user code)\n  FsmsRestClassV8::postCreateDraftFromText() called at <builtin>:-1 (Qore user code)\n  call_object_method_args() called at /export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm:941 (Qore builtin code)\n  AbstractRestClass::dispatch() called at QorusRestApiHandler.qc:1544 (Qore user code)\n  QorusRestClass::dispatch() called at /export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm:849 (Qore user code)\n  AbstractRestClass::handleRequest() called at /export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm:860 (Qore user code)\n  AbstractRestClass::handleRequest() called at /export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm:1569 (Qore user code)\n  RestHandler::dispatchRequest() called at /export/home2/dnichols/src/Qorus/current/qlib/RestHandler.qm:1476 (Qore user code)\n  RestHandler::handleRequest() called at QorusRestApiHandler.qc:17303 (Qore user code)\n  WebAppHandler::handleRequest() called at /export/home2/dnichols/src/Qorus/current/qlib/HttpServer.qm:1781 (Qore user code)\n  HttpServer::handleRequest() called at /export/home2/dnichols/src/Qorus/current/qlib/HttpServer.qm:2797 (Qore user code)\n  HttpListener::connectionThread() called at /export/home2/dnichols/src/Qorus/current/qlib/HttpServer.qm:2599 (Qore user code)\n  HttpListener::<anonymous closure>() called at <builtin>:-1 (Qore user code)',
        },
      },
    ],
  },
  play: async () => {
    await testsWaitForText('"AbstractQorusCoreService.qc"');
  },
};

/* ------------------------------------------------------------------------------------------------
 * loadOnMount and the query cache (board f61)
 * ---------------------------------------------------------------------------------------------- */

const SEEDED_INFO = { 'instance-key': 'seeded-by-the-host', edition: 'Enterprise' };

/** A successful answer shaped as `query()` builds one, Response included. */
const answer = (data: unknown): IReqraftFetchResponse<never> => ({
  ok: true,
  data: data as never,
  code: 200,
  response: new Response(JSON.stringify(data ?? null), { status: 200 }),
});

/** Shows what useFetch rendered, and how many times it asked its FetchContext. */
const CountsItsRequests = () => {
  const { data } = useFetch<typeof SEEDED_INFO>({ url: 'public/info', loadOnMount: true });

  return (
    <>
      <ReqoreP className='story-instance'>Instance: {data?.['instance-key'] ?? 'none'}</ReqoreP>
      <ReqoreTree data={data ?? {}} />
    </>
  );
};

const AskCounter = () => {
  const [asked, setAsked] = useState(0);
  const context = useMemo<IReqraftFetchContext>(
    () => ({
      get: async () => {
        setAsked((count) => count + 1);
        return answer(SEEDED_INFO);
      },
      post: async () => answer(undefined),
      put: async () => answer(undefined),
      del: async () => answer(undefined),
    }),
    []
  );

  return (
    <FetchContext.Provider value={context}>
      <ReqoreP className='story-asked'>Asked the server {asked} times</ReqoreP>
      <CountsItsRequests />
    </FetchContext.Provider>
  );
};

export const AFreshCachedAnswerIsNotAskedFor: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The host has seeded `public/info` into the query cache (as the IDE seeds the type catalog it fetched before the bundle parsed). `useFetch({ loadOnMount: true })` renders that answer on its first paint and does not ask its FetchContext for it: "Asked the server 0 times". It used to ask anyway, and with no reqraft provider above it the default context threw (board f61).',
      },
    },
  },
  beforeEach: () => {
    seedQueryCache({ url: 'public/info', data: SEEDED_INFO });
  },
  render: () => <AskCounter />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByText('Instance: seeded-by-the-host');
    // Give a request on mount every chance to have been made.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(canvas.getByText('Asked the server 0 times')).toBeVisible();
  },
};

const ShowsItsError = () => {
  const { error, loading } = useFetch<typeof SEEDED_INFO>({
    url: 'public/info',
    loadOnMount: true,
  });

  if (loading) {
    return <ReqoreSpinner />;
  }

  return error ? (
    <ReqoreMessage intent='danger' title='Could not load the system info'>
      {error.message}
    </ReqoreMessage>
  ) : (
    <ReqoreP>Loaded</ReqoreP>
  );
};

const REJECTING_CONTEXT: IReqraftFetchContext = {
  get: async () => {
    throw new Error('The connection to the server was closed.');
  },
  post: async () => answer(undefined),
  put: async () => answer(undefined),
  del: async () => answer(undefined),
};

export const AFailedLoadOnMountShowsItsError: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A FetchContext whose request rejects (here, a closed connection) under `useFetch({ loadOnMount: true })`: the failure ends in `error`, so the component shows it, and it is not left as an unhandled rejection. It used to escape the mount effect: the page showed "Loaded" with no data, and a test runner failed the whole run (board f61).',
      },
    },
  },
  render: () => (
    <FetchContext.Provider value={REJECTING_CONTEXT}>
      <ShowsItsError />
    </FetchContext.Provider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() =>
      expect(canvas.getByText('The connection to the server was closed.')).toBeVisible()
    );
    await expect(canvas.queryByText('Loaded')).toBeNull();
  },
};
