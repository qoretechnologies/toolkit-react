// Vitest global setup for the unit-test project (jsdom).
import React from 'react';
import { beforeEach, vi } from 'vitest';
import { ReqraftQueryClient } from '../src/providers/ReqraftProvider';

// Ensure a React symbol exists on the global for any module compiled with the
// classic runtime (React.createElement without an explicit import).
(globalThis as typeof globalThis & { React: typeof React }).React = React;

// Silence noisy log levels during tests (mirrors the previous Jest setup).
global.console = {
  ...console,
  debug: vi.fn(),
  info: vi.fn(),
  // warn: vi.fn(),
  error: vi.fn(),
};

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
