import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure a single React instance across stories, the renderer and
    // styled-components. Webpack deduped automatically; Vite needs this to
    // avoid "A React Element from an older version of React was rendered".
    //
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  // The old webpack `env` block injected these into process.env. Vite doesn't
  // define `process` in the browser, so source/stories that read
  // process.env.REACT_APP_QORUS_* (and NODE_ENV/CI) would throw. Inline them.
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'storybook'),
    'process.env.CI': JSON.stringify(process.env.CI || ''),
    'process.env.REACT_APP_QORUS_TOKEN': JSON.stringify(
      process.env.REACT_APP_QORUS_TOKEN || ''
    ),
    'process.env.REACT_APP_QORUS_INSTANCE': JSON.stringify(
      process.env.REACT_APP_QORUS_INSTANCE || ''
    ),
  },
});
