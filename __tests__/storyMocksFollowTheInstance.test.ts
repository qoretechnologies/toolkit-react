/**
 * Story mocks name the instance the stories are configured with, never a host of their own (qorus#646).
 *
 * The storage mocks of the useStorage and Menu stories named hq's URL outright. Run against another instance
 * (or none), they matched nothing and the requests went to that instance; against hq, they hid that the
 * stories read the live server's user whenever a mock was missing. Mock URLs are built with storyApiUrl /
 * storySocketUrl (src/stories/storyNetwork.ts), the one place the default instance is written.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const INSTANCE_HOST = 'hq.qoretechnologies.com:8092';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    return statSync(path).isDirectory() ? files(path) : [path];
  });

/** Where stories and their mocks live. */
const storySources = () =>
  [
    ...files(join(ROOT, 'src')),
    ...files(join(ROOT, '.storybook')),
    join(ROOT, '__tests__', ' mock.ts'),
  ].filter(
    (path) =>
      /\.(stories\.tsx|ts|tsx)$/.test(path) &&
      (/\.stories\.tsx$/.test(path) ||
        path.includes(`${join('src', 'stories')}`) ||
        path.includes('__fixtures__') ||
        path.includes('.storybook') ||
        path.endsWith(' mock.ts'))
  );

describe('story mocks', () => {
  it('name no instance host of their own', () => {
    const named = storySources()
      .filter((path) => !path.endsWith(join('src', 'stories', 'storyNetwork.ts')))
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .map((line, index) => ({ line, at: `${relative(ROOT, path)}:${index + 1}` }))
          // what a comment says about the instance is not a request
          .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line) && line.includes(INSTANCE_HOST))
          .map(({ at }) => at)
      );
    expect(named).toEqual([]);
  });

  it('are looked for where they live', () => {
    const sources = storySources().map((path) => relative(ROOT, path));
    expect(sources).toContain(join('__tests__', ' mock.ts'));
    expect(sources).toContain(join('src', 'hooks', 'useStorage', 'useStorage.stories.tsx'));
    expect(sources.length).toBeGreaterThan(50);
  });
});
