import type { TTemplateCatalogueFixture } from '../src/stories/templateCatalogueMock';
import {
  ReqoreContent,
  ReqoreLayoutContent,
  ReqoreModalsWrapper,
  ReqoreUIProvider,
} from '@qoretechnologies/reqore';
import { initializeReqraft, ReqraftQueryClient } from '../src';
import { startDpqlMockLsp } from '../src/components/form/expressions/dpqlMockLsp';

import { _resetServerQorusTypesForTests } from '../src/helpers/qorusTypeCatalogue';
import { _resetExpressionTypeTransportForTests } from '../src/components/form/expressions/useExpressionType';
import { _resetRenderExpressionTransportForTests } from '../src/components/form/expressions/useRenderExpression';
import { IStoryClockParameters, startStoryClock } from '../src/stories/storyClock';
import { GLOBAL_STORY_MOCK_DATA, STORY_QORUS_INSTANCE } from '../src/stories/storyNetwork';
import { fetchConfig } from '../src/utils/fetch';
import { _resetSharedLspConnectionsForTests } from '../src/utils/lspClient';

export const parameters = {
  // No `actions.argTypesRegex` (removed in SB10): stories that assert on
  // handlers define explicit `fn()` spies from `storybook/test` instead.
  layout: 'fullscreen',
  options: {
    panelPosition: 'right',
    sidebar: {
      showRoots: true,
    },
  },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
    expanded: true,
  },
  chromatic: {
    pauseAnimationAtEnd: true,
    viewports: [1440],
  },
  // Requests components make on their own (e.g. FormEngine's type catalogue),
  // mocked for every story ahead of its own `mockData`.
  mockAddonConfigs: {
    globalMockData: GLOBAL_STORY_MOCK_DATA,
  },
};

// Every story starts without a language-server connection. Connections are
// shared per endpoint for the life of the page — the expression render client
// holds one from the first expression it renders — so without this a story
// inherits whatever socket an earlier story opened, and a mock LSP it starts
// is never dialled: its editor waits on the earlier story's handshake. It is
// order-dependent and silent — no error, no response — and every affected story
// passes when run on its own, so a single-story run can never show it.
//
// ...and every story then finds a DPQL language server on the endpoint. An
// expression Preview, an Explain panel or a collapsed expression row waits for
// the server's rendering rather than approximating it, so a story that renders
// one without a server would show only its loading state. A story that needs
// different answers starts its own server on the URL, which replaces this one;
// a `live` story reaches the real server instead.
//
// ...and every story starts at the same instant, `STORY_NOW`, so a date it
// shows as "3 hours ago" says so on every day it is captured (see
// src/stories/storyClock.ts; `parameters.mockdate` stops the clock, a `live`
// story keeps the real one).
//
// ...and with an empty query cache, as every unit test does. The cache lives as
// long as the page, so a story was served whatever an earlier one had fetched:
// four FormEngine plays only passed after an earlier story had loaded the type
// catalogue, and failed when the story was opened on its own. The clock makes it
// worse: an answer carries the time it was fetched, and the clock takes every
// story back to `STORY_NOW`, so an answer fetched a few seconds into the previous
// story would read as fetched in the future, fresh even to a request that never
// caches, and be served in place of this story's own mocks (useStorage's stored
// value, useFetch's 409). Emptied before anything mounts: a request the previous
// story left in flight is cancelled with nothing left waiting for it.
export const beforeEach = ({
  parameters,
}: {
  parameters?: IStoryClockParameters & { templateCatalogue?: TTemplateCatalogueFixture };
}) => {
  ReqraftQueryClient.clear();
  // and without the type catalogue an earlier story's server answered with (`getQorusTypes`)
  _resetServerQorusTypesForTests();
  const restoreClock = startStoryClock(parameters);
  try {
    _resetRenderExpressionTransportForTests();
    // the expression type client too, and the types it cached: a story's server says what its expressions give
    _resetExpressionTypeTransportForTests();
    _resetSharedLspConnectionsForTests();
    // the catalogue of the story's field (`templateCatalogue`, one of Qorus's): the contexts valid there
    const stopLsp =
      parameters?.live ? undefined : (
        startDpqlMockLsp({ templateCatalogue: parameters?.templateCatalogue })
      );
    return () => {
      try {
        stopLsp?.();
      } finally {
        restoreClock();
      }
    };
  } catch (error) {
    restoreClock();
    throw error;
  }
};

export const argTypes = {
  mainTheme: {
    control: 'color' as const,
    description: 'The overall theme for all ReQore components',
    name: 'Main Theme',
    defaultValue: '#333333',
    table: {
      type: {
        summary: 'hex color of 6 characters',
      },
      defaultValue: { summary: '#333333' },
    },
  },
};

export const decorators = [
  (Story, context) => {
    // Live stories (`parameters: { live: true }`) hit this instance. Override
    // it to point at your own Qorus for live data, e.g.
    //   REACT_APP_QORUS_INSTANCE=https://localhost:8012/ \
    //   REACT_APP_QORUS_TOKEN=<token> yarn storybook
    // (the instance must allow the storybook origin via CORS).
    const Reqraft = initializeReqraft({
      instance: STORY_QORUS_INSTANCE,
      instanceToken: process.env.REACT_APP_QORUS_TOKEN,
    });
    // A live story hitting Qorus without a valid token gets a 401, which
    // Reqraft answers by navigating window.location to `/?next=…`. Inside the
    // preview iframe that loads the Storybook MANAGER into the canvas, whose own
    // canvas reloads /iframe.html → 401 → redirect → Storybook-in-Storybook
    // recursion. Clear the redirect so a 401 stays a failed request here.
    fetchConfig.unauthorizedRedirect = undefined;

    return (
      <ReqoreUIProvider
        theme={{
          main: '#121212',
          intents: {
            success: '#4a7110',
            custom1: '#762f7e',
            custom2: '#b34e1d',
          },
        }}
        options={{
          animations: {
            buttons: false,
            dialogs: false,
          },
          ...context.args?.reqoreOptions,
        }}
      >
        <Reqraft appName='storybook' waitForStorage={false} {...context.args.reqraftOptions}>
          {/* Renders reqore's global modal queue (modalStore.addModal) — apps
              mount this at their root (see qorus-ide providers/Interfaces);
              without it, anything using the queue (e.g. the template picker's
              full example-value modal) enqueues into the void in stories. */}
          <ReqoreModalsWrapper />
          <ReqoreLayoutContent style={{ height: '100%' }}>
            <ReqoreContent style={{ padding: '20px', display: 'flex', flexFlow: 'column' }}>
              <Story />
            </ReqoreContent>
          </ReqoreLayoutContent>
        </Reqraft>
      </ReqoreUIProvider>
    );
  },
];
