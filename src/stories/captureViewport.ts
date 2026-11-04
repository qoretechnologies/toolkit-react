// Copyright 2026 Qore Technologies, s.r.o.

/**
 * The size of the frame qlip captures a story at, unless the story asks for another
 * (`parameters.qlip.viewport`). The story test run's own config hands it to qlip (vitest.config.ts), so
 * the two cannot drift apart. It is not the size a play runs at: Storybook gives each story's frame its own
 * size as the story starts, and qlip resizes the frame to this one once the play has ended.
 */
export const CAPTURE_VIEWPORT = Object.freeze({ width: 1920, height: 1080 });
