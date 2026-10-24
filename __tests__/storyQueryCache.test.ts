// Copyright 2026 Qore Technologies, s.r.o.
// The shared query cache serves the next story what the real clock would have.
//
// The cache lives as long as the page and stamps every answer with the time it was
// fetched. The story clock takes every story back to STORY_NOW, so an answer the
// previous story fetched a few seconds into its run reads as fetched in the future,
// and counted as fresh even for a request that never caches: the useStorage stories
// showed the previous story's user instead of their own stored value.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { beforeEach as beforeEachStory } from '../.storybook/preview';
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

it('keeps an answer still fresh at the end of a story for the next one', async () => {
  startStory();
  answer = 'the catalogue';
  await ask(true);
  elapsed += 5_000;

  startStory();
  answer = 'a new catalogue';

  expect(await ask(true)).toBe('the catalogue');
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});

it('leaves a request still in flight when its story ends to finish', async () => {
  let answerTheRequest = () => {};
  let requestSent = () => {};
  const sent = new Promise<void>((resolve) => (requestSent = resolve));
  vi.mocked(globalThis.fetch).mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        answerTheRequest = () =>
          resolve(
            new Response(JSON.stringify({ answer: 'late' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        requestSent();
      })
  );
  startStory();
  const inFlight = ask(false);
  await sent;

  startStory();
  answerTheRequest();

  await expect(inFlight).resolves.toBe('late');
});

it('drops an answer that went stale during the story', async () => {
  startStory();
  answer = 'the catalogue';
  await ask(true);
  elapsed += 6 * 60_000;

  startStory();
  answer = 'a new catalogue';

  expect(await ask(true)).toBe('a new catalogue');
});
