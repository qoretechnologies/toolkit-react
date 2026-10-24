// Copyright 2026 Qore Technologies, s.r.o.
// Every story starts with an empty query cache.
//
// The cache lives as long as the page, so a story was served what an earlier story had
// fetched, and a story that only passed after an earlier one had fetched what it needed
// failed when it was opened on its own. The story clock makes it worse: an answer carries
// the time it was fetched, and the clock takes every story back to STORY_NOW, so an answer
// the previous story fetched a few seconds into its run reads as fetched in the future,
// fresh even for a request that never caches. The useStorage stories showed the previous
// story's user instead of their own stored value.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { beforeEach as beforeEachStory } from '../.storybook/preview';
import { ReqraftQueryClient } from '../src/providers/ReqraftProvider';
import { query } from '../src/utils/fetch';

/* Real time passing, as `performance.now()` reports it to the story clock. */
let elapsed = 0;
/* What the server answers now. */
let answer = '';
let endCurrentStory: (() => void) | undefined;

const startStory = () => {
  endCurrentStory?.();
  endCurrentStory = beforeEachStory({ parameters: {} });
};

const ask = async (cache: boolean) =>
  (await query<{ answer: string }>({ url: 'users?action=current', cache })).data.answer;

beforeEach(() => {
  elapsed = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(JSON.stringify({ answer }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
  );
});

afterEach(() => {
  endCurrentStory?.();
  endCurrentStory = undefined;
  vi.restoreAllMocks();
});

it("answers a request that never caches with this story's answer, not the previous story's", async () => {
  startStory();
  elapsed += 5_000;
  answer = 'the first story';
  await ask(false);

  startStory();
  answer = 'the second story';

  expect(await ask(false)).toBe('the second story');
});

it('fetches again what the previous story had cached', async () => {
  startStory();
  answer = 'the catalogue the first story fetched';
  await ask(true);

  startStory();
  answer = "this story's catalogue";

  expect(await ask(true)).toBe("this story's catalogue");
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

it('starts every story with nothing in the cache', () => {
  ReqraftQueryClient.setQueryData(['left by an earlier story'], { ok: true });

  startStory();

  expect(ReqraftQueryClient.getQueryCache().getAll()).toHaveLength(0);
});
