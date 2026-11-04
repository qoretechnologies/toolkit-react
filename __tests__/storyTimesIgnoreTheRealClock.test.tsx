// Copyright 2026 Qore Technologies, s.r.o.
// A story that shows "3 hours ago" shows it on every day it is captured.
//
// The ticket stories date their messages from a fixed instant, but the components
// write each date relative to the real clock ("1 month ago" in one build, "3 months
// ago" a few weeks later), so their snapshots changed with nobody changing them.
//
// Each story here is rendered through the project's Storybook annotations twice,
// with the machine's clock years apart, and must come out the same both times.
import { composeStories, composeStory, setProjectAnnotations } from '@storybook/react-vite';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as preview from '../.storybook/preview';
import * as TicketConversationStories from '../src/components/supportTicket/TicketConversation.stories';
import * as TicketReferencesStories from '../src/components/ticketReferences/TicketReferences.stories';
import * as TicketThreadStories from '../src/components/ticketThread/TicketThread.stories';

setProjectAnnotations(preview);

/* Two machine clocks: a week after the stories' messages were written, and years later. */
const CLOCK_SOON = Date.UTC(2026, 6, 7, 8, 30, 0);
const CLOCK_LATER = Date.UTC(2031, 2, 15, 17, 45, 0);

/* The phrases `epoch-timeago` writes ("just now", "a minute ago", "3 hours ago" …). */
const RELATIVE_TIME = /just now|\b(an?|\d+) (minute|hour|day|week|month|year)s? ago/g;

type TComposed = ReturnType<typeof composeStory>;

const FILES: Array<[string, Record<string, TComposed>]> = [
  ['TicketThread', composeStories(TicketThreadStories)],
  ['TicketConversation', composeStories(TicketConversationStories)],
  ['TicketReferences', composeStories(TicketReferencesStories)],
];

/* The machine's clock, as the components read it.
 *
 * `Date.now` on the platform's own `Date` is what `epoch-timeago` (behind
 * `ReqoreTimeAgo` and the references' "uploaded … ago") reads. Faking it there,
 * rather than swapping `Date` itself out, keeps the fake in place whatever a
 * story decorator does to the global `Date`: a decorator that puts the
 * platform's `Date` back puts this one back with it. */
const PLATFORM_DATE = Date;

/** What `Story` shows when the machine's clock reads `clock`. */
const renderWithClockAt = async (Story: TComposed, clock: number): Promise<string> => {
  const machineClock = vi.spyOn(PLATFORM_DATE, 'now').mockReturnValue(clock);
  try {
    await Story.load();
    const { container, unmount } = render(<Story />);
    // Effects (image loading, measurement) settle before the text is read.
    await act(async () => {});
    const text = container.textContent ?? '';
    unmount();
    return text;
  } finally {
    machineClock.mockRestore();
  }
};

beforeEach(() => {
  // The stories' Reqraft asks for the current user; nothing here leaves the machine.
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(JSON.stringify({ username: 'story', permissions: [], storage: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('story times', () => {
  describe.each(FILES)('%s', (_file, stories) => {
    it.each(Object.entries(stories))(
      '%s reads the same whatever the machine clock says',
      async (_name, Story) => {
        const soon = await renderWithClockAt(Story, CLOCK_SOON);
        const later = await renderWithClockAt(Story, CLOCK_LATER);

        expect(later).toBe(soon);
      }
    );

    it('shows at least one relative time, so the comparison above means something', async () => {
      const shown: string[] = [];
      for (const Story of Object.values(stories)) {
        shown.push(...((await renderWithClockAt(Story, CLOCK_SOON)).match(RELATIVE_TIME) ?? []));
      }

      expect(shown.length).toBeGreaterThan(0);
    });
  });
});
