// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Reqraft is an open-source library for Qorus: what it says in its sources, stories, tests and docs is read by
 * anyone. Qorus and its products (the Qorus IDE, Qonsole, Qogs, Qlip) may be named where they explain a component;
 * what is truly internal may not: people and personas, private issues and PRs, visual review builds, review, board,
 * queue and decision ids, chats and internal hosts. A reason stays (what a component does and why); where it came from does not. The gate is
 * `__tests__/publicText.test.ts`; `node scripts/publicTextGate.mjs <files>` lists what a file still names.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * What may not be named, by kind. A board id (`f66`) and a hex color written short (`'f80'`, `` `F80` ``) look
 * alike, so a quoted or code-marked one is read as a color.
 */
export const DENIED = [
  ['a private issue or PR', /\bqorus(?:-ide)? ?#\d+|qoretechnologies\/qorus(?:-ide)?(?![\w.-])/gi],
  // a build on the private visual-review dashboard, which nobody outside can open: the reason stays, the number goes
  ['a visual review build', /\bqlip(?: review of)?(?: build)? #?\d{2,}(?:-\d+)?\b|\bbuild #\d+\b/gi],
  ['a person or a persona', /\b(?:Filip|David|Nick|Dana|Foxhoundn)\b/g],
  ['a review, board or queue id', /\br-(?:qs|ed)-\d+\b|\bt-\d{2,3}\b|\bboard (?:[a-z]?\d+|t-\d+)\b|(?<![#'"`\w])f[1-9]\d\b(?![\w-])|\bqueue items?\b/gi],
  ['an internal decision id', /\bdecisions? \d{2,3}\b/gi],
  ['a chat or a host', /qorus-ide-(?:c2|ec|\d+)\b|\blibrary chat\b|\b(?:drake|spinster)\b|hq\.qoretechnologies|\bhq\b/gi],
];

/** Where people are named only as made-up data, not as the people who built the library. */
const MADE_UP_PEOPLE = /^src\/mock\//;
/**
 * The one place the stories' default instance is written (`STORY_QORUS_INSTANCE`): the instance the stories and the
 * CI talk to. A test or a story that needs a host uses that, or an example host.
 */
const THE_INSTANCE = /^src\/stories\/storyNetwork\.ts$/;
/** The gate itself, which has to name what it denies. */
const THE_GATE = /^(?:scripts\/publicTextGate\.mjs|__tests__\/publicText\.test\.ts)$/;

/** Every public text file the gate reads. */
export const publicFiles = () =>
  execSync('git ls-files src __tests__ .storybook scripts design .tasks .claude README.md vitest.config.ts', {
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => /\.(?:tsx?|mts|mjs|js|md|mdx)$/.test(file) && !THE_GATE.test(file));

/** What each file still names: `{ file, line, kind, text }`. */
export const findInternalNames = (files) =>
  files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((text, index) =>
        DENIED.flatMap(([kind, pattern]) => {
          if (kind === 'a person or a persona' && MADE_UP_PEOPLE.test(file)) {
            return [];
          }
          if (kind === 'a chat or a host' && THE_INSTANCE.test(file)) {
            return [];
          }
          return [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map((match) => ({
            file,
            line: index + 1,
            kind,
            text: match[0],
          }));
        })
      )
  );

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : publicFiles();
  const found = findInternalNames(files);
  for (const { file, line, kind, text } of found) {
    console.log(`${file}:${line}: ${text} (${kind})`);
  }
  console.log(`${found.length} found in ${new Set(found.map(({ file }) => file)).size} files`);
}
