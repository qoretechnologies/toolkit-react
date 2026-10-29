import { qlipVitestPlugin } from '@qoretechnologies/qlip';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import { CAPTURE_VIEWPORT } from './src/stories/captureViewport';
import viteConfig from './vite.config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// qlip uploads only when a token is provided (CI). Local runs still capture
// snapshots via the plugin's `auto` mode but skip the upload step.
const qlipUploadToken = process.env.QLIP_UPLOAD_TOKEN;

/**
 * Story files with no story tagged `touch`, relative to the project root. The touch project leaves them out,
 * so it does not load every story module only to skip it. Read from the files themselves: tagging a story
 * is all it takes to run it on a touch screen.
 */
const storyFilesWithoutTouch = (): string[] =>
  readdirSync(path.join(dirname, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.stories.tsx'))
    .map((file) => path.join('src', file).split(path.sep).join('/'))
    .filter(
      (file) =>
        !/\btags:\s*\[[^\]]*['"]touch['"]/.test(readFileSync(path.join(dirname, file), 'utf8'))
    );

// One plugin for both story projects, so they make one qlip build: one build id, and one upload at the end
// of the run (the plugin registers its reporter once, however many projects load it).
const qlip = qlipVitestPlugin({
  auto: true,
  captureOnError: true,
  disableAnimations: true,
  pauseAnimationsAtEnd: true,
  viewport: { ...CAPTURE_VIEWPORT },
  ...(qlipUploadToken ? { upload: { uploadToken: qlipUploadToken } } : {}),
});

/**
 * The browser a story project runs in: a desktop with a mouse, or - `phone` - the phone the stories tagged
 * `touch` run on (`src/stories/touchScreen.ts`). A new object for each project: Vitest names a project's
 * browser instances on the objects themselves.
 *
 * The phone is a phone from the start: Playwright makes its context with `isMobile` and `hasTouch`, so
 * `(pointer: coarse)` and `(hover: none)` match and a touch is a finger's, and nothing turns that on or
 * off. Turning Chromium's touch emulation off over the DevTools protocol (how a touch story used to borrow
 * a desktop page) leaves the page with the hover and pointer the machine reports, not the mouse Playwright
 * launched it with (`--blink-settings=primaryHoverType=2,…`), and a Linux CI runner reports none: every
 * later story in the page found `(hover: none)` (qorus#646).
 */
const storyBrowser = (phone = false) => ({
  enabled: true,
  provider: playwright({
    contextOptions: {
      // Every capture host renders dates as CI does: in UTC and in US English. A story's date
      // ("2026-06-10 09:14:22", a log line's time, a date field) is otherwise written in the zone
      // and language of whichever machine took the snapshot.
      timezoneId: 'UTC',
      locale: 'en-US',
      ...(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}),
    },
  }),
  headless: true,
  // Match the Chromatic snapshot viewport (preview.tsx sets [1440]).
  viewport: { width: 1440, height: 900 },
  instances: [{ browser: 'chromium' as const }],
});

const storyTest = {
  setupFiles: ['./.storybook/vitest.setup.ts'],
  // Some interaction stories deliberately render slow content (LSP /
  // websocket editors) and the shared play helpers wait up to ~17s.
  testTimeout: 30000,
};

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        // Component/interaction tests: run every story in a real browser via
        // Playwright. Replaces the former @storybook/test-runner.
        //
        // Stories run in two projects, each in a browser of its own kind (see `storyBrowser`): every story on
        // a desktop with a mouse, but those tagged `touch`, which run on a phone. `.storybook/vitest.setup.ts`
        // checks each story's browser is the one its project promises.
        {
          extends: true,
          plugins: [
            qlip,
            storybookTest({
              configDir: path.join(dirname, '.storybook'),
              storybookScript: 'yarn storybook --no-open',
              tags: { exclude: ['touch'] },
            }),
          ],
          test: {
            name: 'storybook',
            // after the stories on the phone: each story here checks it still has its mouse
            sequence: { groupOrder: 1 },
            browser: storyBrowser(),
            ...storyTest,
          },
        },
        // The stories tagged `touch`, on the phone. Before the others, not beside them: the two projects share
        // Storybook's dependency cache (it is named after the config directory), which is not built twice at
        // once.
        {
          extends: true,
          plugins: [
            qlip,
            storybookTest({
              configDir: path.join(dirname, '.storybook'),
              storybookScript: 'yarn storybook --no-open',
              tags: { include: ['touch'] },
            }),
          ],
          test: {
            name: 'storybook-touch',
            exclude: [...configDefaults.exclude, ...storyFilesWithoutTouch()],
            sequence: { groupOrder: 0 },
            browser: storyBrowser(true),
            ...storyTest,
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
