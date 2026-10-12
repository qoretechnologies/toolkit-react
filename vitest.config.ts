import { qlipVitestPlugin } from '@qoretechnologies/qlip';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// qlip uploads only when a token is provided (CI). Local runs still capture
// snapshots via the plugin's `auto` mode but skip the upload step.
const qlipUploadToken = process.env.QLIP_UPLOAD_TOKEN;

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        // Component/interaction tests: run every story in a real browser via
        // Playwright. Replaces the former @storybook/test-runner.
        {
          extends: true,
          plugins: [
            qlipVitestPlugin({
              auto: true,
              captureOnError: true,
              disableAnimations: true,
              pauseAnimationsAtEnd: true,
              viewport: { width: 1920, height: 1080 },
              ...(qlipUploadToken ? { upload: { uploadToken: qlipUploadToken } } : {}),
            }),
            storybookTest({
              configDir: path.join(dirname, '.storybook'),
              storybookScript: 'yarn storybook --no-open',
            }),
          ],
          test: {
            name: 'storybook',
            // One story file at a time. A touch story turns on Chrome's touch emulation through the DevTools
            // protocol (`withTouchScreen`), and that emulation belongs to the whole page: a story file running
            // beside it, in another frame, sees a coarse pointer and no hover. In #708's CI, Table's mouse-sized
            // row menu measured 44px (the touch size) and the Marquee stories found no hover, while the EntityRow
            // and SeverityRow touch stories ran at the same time.
            fileParallelism: false,
            browser: {
              enabled: true,
              provider: playwright({}),
              headless: true,
              // Match the Chromatic snapshot viewport (preview.tsx sets [1440]).
              viewport: { width: 1440, height: 900 },
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: ['./.storybook/vitest.setup.ts'],
            // Some interaction stories deliberately render slow content (LSP /
            // websocket editors) and the shared play helpers wait up to ~17s.
            testTimeout: 30000,
          },
        },
        // Unit tests: the former Jest suite, now on Vitest + jsdom.
        {
          extends: true,
          test: {
            name: 'unit',
            globals: true,
            environment: 'jsdom',
            include: ['__tests__/**/*.test.{ts,tsx}'],
            setupFiles: ['./__tests__/setup.ts'],
            testTimeout: 30000,
          },
        },
      ],
    },
  })
);
