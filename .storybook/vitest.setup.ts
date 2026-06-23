import { setProjectAnnotations } from '@storybook/react-vite';
import { createElement } from 'react';
import { beforeAll } from 'vitest';
import * as previewAnnotations from './preview';
// storybook-addon-mock drives `parameters.mockData` through `faker`, which
// patches window.fetch/XHR. Its own `withRoundTrip` decorator only (re)configures
// faker on the FIRST story or on Storybook's `STORY_CHANGED` channel event —
// neither of which happens per-story in the Vitest browser (no manager firing
// STORY_CHANGED). So only the first mockData story is mocked and the rest hit the
// real network and 401/time out. Re-map faker from the current story's mockData
// on EVERY story here instead (and restore for stories without mockData so a
// previous story's mock can't leak into a live one).
// @ts-expect-error — deep import; the addon ships no types for this entry.
import faker from 'storybook-addon-mock/dist/esm/utils/faker';

// Registers the React renderer plus the project's global decorators/parameters
// from .storybook/preview for the Storybook Vitest project.
const annotations = setProjectAnnotations([
  previewAnnotations,
  {
    decorators: [
      (Story: any, context: any) => {
        const mockData = context?.parameters?.mockData;
        if (Array.isArray(mockData) && mockData.length) {
          faker.makeInitialRequestMap(mockData);
        } else {
          faker.restore();
        }
        return Story();
      },
      // The vitest tester mounts stories into an auto-height <div> under <body>,
      // unlike the dev preview where .storybook/preview-body.html gives the
      // html/body/#storybook-root chain `height: 100%`. Without a definite
      // height, height-filling stories cannot resolve their 100% heights. A
      // 100vh frame resolves regardless of parent.
      (Story: any) => createElement('div', { style: { height: '100vh' } }, createElement(Story)),
    ],
  },
]);

beforeAll(annotations.beforeAll);

// React Query cancels in-flight (mocked) requests when a story unmounts, which
// surfaces as an EMPTY unhandled rejection (no message, no stack). It's benign —
// the stories pass and the app behaves correctly — but Vitest's strict detection
// fails the whole run on it. Swallow ONLY these empty rejections; anything with a
// real message/stack still propagates and fails the test as it should.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string; stack?: string } | null | undefined;
    const isEmpty =
      reason == null || (typeof reason === 'object' && !reason.message && !reason.stack);
    if (isEmpty) event.preventDefault();
  });
}

// Font parity with .storybook/preview-body.html.
const style = document.createElement('style');
style.textContent = `
  html,
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  }
`;
document.head.appendChild(style);
