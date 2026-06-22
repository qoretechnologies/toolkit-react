// Storybook test-runner Jest config.
//
// The test-runner auto-detects a `test-runner-jest*` file in the project
// root and uses it instead of its built-in default. We start from the
// default (`getJestConfig()`) and raise the per-test timeout.
//
// Why the generous timeout: the play tests run against a PRODUCTION
// Storybook build served over http-server, under parallel load (CI and
// local `test-storybook` both fan out across workers). Async stories —
// an LSP completion over a mock WebSocket, a form-validation re-render —
// can be slow to get CPU on a contended runner, so the runner's short
// default timeout flakes them out. A large ceiling lets them finish.
// This mirrors the qorus-ide test-runner config (`testTimeout: 120000`),
// which is the established convention across the org's heavy Storybooks.

const { getJestConfig } = require('@storybook/test-runner');

module.exports = {
  ...getJestConfig(),
  testTimeout: 120000,
};
