/**
 * The tracking module is shared by every Qore web app, so its layers stay apart:
 * `core/` has no DOM and no React, `browser/` has no React, the engine imports
 * nothing but React (an app can load `@qoretechnologies/reqraft/dist/tracking`
 * without Reqore, react-query or the editors), and only `ui/` (the A/B test UI)
 * uses Reqore. Nothing in `src/tracking/` imports the rest of Reqraft, except that the UI reads the
 * host's words (`helpers/reqraftLabels`), which is plain TypeScript with React as its only dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as barrel from '../../src';
import * as tracking from '../../src/tracking';
import * as ui from '../../src/tracking/ui';

const ROOT = path.resolve(__dirname, '../../src/tracking');
/** The host's words: the one module outside `src/tracking` the UI may import. */
const LABELS = path.resolve(__dirname, '../../src/helpers/reqraftLabels');

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.stories.') ? [p] : [];
  });

const importsOf = (file: string) =>
  Array.from(fs.readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)).map((m) => m[1]);

/** The modules a file imports for their values (an `import type` is gone once compiled). */
const valueImportsOf = (file: string) =>
  Array.from(fs.readFileSync(file, 'utf8').matchAll(/^import\s+(type\s+)?[^;]*?from '([^']+)'/gm))
    .filter((m) => !m[1])
    .map((m) => m[2]);

const resolveTs = (target: string) =>
  [`${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts')].find((f) => fs.existsSync(f)) ?? target;

const code = (file: string) =>
  fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

describe('tracking module layers', () => {
  it('imports nothing outside src/tracking but React (the engine) and Reqore (the UI)', () => {
    const UI = path.join(ROOT, 'ui');
    const UI_PACKAGES = ['react', 'react-dom', 'styled-components', 'polished', '@qoretechnologies/reqore'];
    for (const file of files(ROOT)) {
      const isUi = file.startsWith(UI);
      for (const spec of importsOf(file)) {
        if (spec.startsWith('.')) {
          const target = path.resolve(path.dirname(file), spec);
          if (isUi && target === LABELS) continue;
          expect(target.startsWith(ROOT)).toBe(true);
          // The engine never reaches into the UI.
          if (!isUi) expect([file, target.startsWith(UI)]).toEqual([file, false]);
        } else if (isUi) {
          expect([file, UI_PACKAGES.some((p) => spec === p || spec.startsWith(`${p}/`))]).toEqual([file, true]);
        } else {
          expect([file, spec]).toEqual([file, 'react']);
        }
      }
    }
  });

  it('lets the UI read the host\'s words only from a module that loads nothing but React', () => {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const spec of valueImportsOf(file)) {
        if (spec.startsWith('.')) visit(resolveTs(path.resolve(path.dirname(file), spec)));
        else expect([file, spec]).toEqual([file, 'react']);
      }
    };
    visit(resolveTs(LABELS));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('keeps the core free of the DOM and React, and the browser layer free of React', () => {
    for (const file of files(path.join(ROOT, 'core'))) {
      expect([file, /\b(window|document|navigator)\./.test(code(file))]).toEqual([file, false]);
      expect([file, importsOf(file).some((s) => !s.startsWith('./'))]).toEqual([file, false]);
    }
    for (const file of files(path.join(ROOT, 'browser'))) {
      expect([file, importsOf(file).some((s) => s.includes('react'))]).toEqual([file, false]);
    }
  });

  it('exports the UI from the package barrel and from its own entry', () => {
    for (const name of ['ExperimentCard', 'ExperimentsOverlay', 'useExperimentsAdmin', 'createExperimentsAdminClient', 'placeCard', 'versionRows']) {
      expect([name, typeof (ui as Record<string, unknown>)[name]]).toEqual([name, 'function']);
      expect((barrel as Record<string, unknown>)[name]).toBe((ui as Record<string, unknown>)[name]);
    }
  });

  it('is exported from the package barrel and from its own entry', () => {
    for (const name of ['createBrowserTracker', 'TrackingProvider', 'Experiment', 'useExperiment', 'useConsent', 'trackClick', 'trackSection', 'createMemoryTracker', 'hashV2']) {
      expect([name, typeof (tracking as Record<string, unknown>)[name]]).toEqual([name, 'function']);
      expect((barrel as Record<string, unknown>)[name]).toBe((tracking as Record<string, unknown>)[name]);
    }
  });
});
