// Vitest global setup for the unit-test project (jsdom).
import React from 'react';
import { afterEach, beforeEach, vi } from 'vitest';
import { ReqraftQueryClient } from '../src/providers/ReqraftProvider';

// Ensure a React symbol exists on the global for any module compiled with the
// classic runtime (React.createElement without an explicit import).
(globalThis as typeof globalThis & { React: typeof React }).React = React;

/* React's report of a component that threw during render. It is how React
 * announces an error an error boundary caught — the boundary itself renders a
 * fallback and the rest of the tree carries on. */
const REACT_RENDER_ERROR = 'The above error occurred in';

const reactRenderErrors: string[] = [];

// Silence noisy log levels during tests (mirrors the previous Jest setup).
global.console = {
  ...console,
  debug: vi.fn(),
  info: vi.fn(),
  // warn: vi.fn(),
  error: vi.fn((message?: unknown) => {
    if (typeof message === 'string' && message.startsWith(REACT_RENDER_ERROR)) {
      reactRenderErrors.push(message);
    }
  }),
};

/* A component that throws during render fails the test that rendered it.
 *
 * Silencing `console.error` also silenced React's report of a caught render
 * error, and `ReqoreErrorBoundary` wraps the expression builder and every auto
 * field. A subtree that crashed into one left its test green, asserting against
 * whatever still rendered around the fallback: a FormEngine test proved "the
 * expression editor opens" from the shell's `Visual` toggle while the builder
 * under it threw on every render.
 *
 * A test that means to exercise a boundary replaces this recorder with its own
 * `vi.spyOn(console, 'error')` for as long as it needs to. */
afterEach(() => {
  const errors = reactRenderErrors.splice(0);
  if (errors.length) {
    throw new Error(
      `React reported ${errors.length} component(s) throwing during render — an error ` +
        `boundary may have rendered a fallback in their place:\n\n${errors.join('\n\n')}`
    );
  }
});

/* The shared query cache is reset between tests.
 *
 * `query` defaults to the module-level `ReqraftQueryClient`, and `useFetch`
 * now READS that cache to avoid announcing a loading state for an answer it
 * already has. That makes a cache entry written by one test file visible to
 * the next: a test whose premise is "the schema arrives after first paint"
 * silently gets it ON first paint and fails depending on run order. Global
 * state has to start each test empty. */
beforeEach(() => {
  ReqraftQueryClient.clear();
});
