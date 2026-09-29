/**
 * The tracking module is shared by every Qore web app, so its layers stay apart:
 * `core/` has no DOM and no React, `browser/` has no React, and nothing in
 * `src/tracking/` imports the rest of Reqraft (an app can load
 * `@qoretechnologies/reqraft/dist/tracking` without Reqore, react-query or the editors).
 */
import fs from 'node:fs';
import path from 'node:path';
import * as barrel from '../../src';
import * as tracking from '../../src/tracking';

const ROOT = path.resolve(__dirname, '../../src/tracking');

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.stories.') ? [p] : [];
  });

const importsOf = (file: string) =>
  Array.from(fs.readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)).map((m) => m[1]);

const code = (file: string) =>
  fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

describe('tracking module layers', () => {
  it('imports nothing outside src/tracking but React', () => {
    for (const file of files(ROOT)) {
      for (const spec of importsOf(file)) {
        if (spec.startsWith('.')) {
          expect(path.resolve(path.dirname(file), spec).startsWith(ROOT)).toBe(true);
        } else {
          expect([file, spec]).toEqual([file, 'react']);
        }
      }
    }
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

  it('is exported from the package barrel and from its own entry', () => {
    for (const name of ['createBrowserTracker', 'TrackingProvider', 'Experiment', 'useExperiment', 'useConsent', 'trackClick', 'trackSection', 'createMemoryTracker', 'hashV2']) {
      expect([name, typeof (tracking as Record<string, unknown>)[name]]).toEqual([name, 'function']);
      expect((barrel as Record<string, unknown>)[name]).toBe((tracking as Record<string, unknown>)[name]);
    }
  });
});
