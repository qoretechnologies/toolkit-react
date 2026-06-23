// Vitest global setup for the unit-test project (jsdom).
import React from 'react';
import { vi } from 'vitest';

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
