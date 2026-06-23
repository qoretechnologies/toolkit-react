import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The old webpack `env` block injected these into process.env. Vite doesn't
// define `process` in the browser, so source/stories that read
// process.env.REACT_APP_QORUS_* (and NODE_ENV/CI) get `undefined` and the live
// editor stories then 401.
//
// Source the values from BOTH .env files AND the shell: the Storybook webpack
// builder used to auto-load `.env`/`.env.local` (see .gitignore), so a token
// kept in a gitignored `.env.local` worked without retyping it each launch.
// `loadEnv(mode, cwd, '')` reads all keys (empty prefix, not just VITE_); the
// shell still wins (e.g. `REACT_APP_QORUS_TOKEN=… yarn storybook`).
//
// NOTE: keep this a module-level call + a plain OBJECT export. vitest.config.ts
// does `mergeConfig(viteConfig, …)`, which throws "Cannot merge config in form
// of callback" if this file exports the `defineConfig(() => …)` function form.
const fileEnv = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
const env = (key: string) => process.env[key] ?? fileEnv[key] ?? '';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure a single React instance across stories, the renderer and
    // styled-components. Webpack deduped automatically; Vite needs this to
    // avoid "A React Element from an older version of React was rendered".
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  // The Storybook Vite builder picks up this define, and the Vitest browser
  // project merges this config — so both paths get the token.
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'storybook'),
    'process.env.CI': JSON.stringify(env('CI')),
    'process.env.REACT_APP_QORUS_TOKEN': JSON.stringify(env('REACT_APP_QORUS_TOKEN')),
    'process.env.REACT_APP_QORUS_INSTANCE': JSON.stringify(env('REACT_APP_QORUS_INSTANCE')),
  },
});
