// Copyright 2026 Qore Technologies, s.r.o.
// The ways a page can copy, chosen for a story or a test.
//
// Whether a copy works depends on the page, not on the component: the Clipboard
// API exists only in a secure context (https, or localhost), and a headless
// browser refuses it a permission, so a story that clicked Copy showed "copied"
// on one machine and "could not copy" on another. A story or a test that copies
// therefore says which page it is on:
// - `clipboard-api`: a secure page whose Clipboard API copies;
// - `copy-command`: a page served over plain http, with no Clipboard API, whose
//   copy command (`document.execCommand('copy')`) copies;
// - `none`: a page where neither copies, so the copy fails.
//
// What was copied is recorded in `copied`, whichever way it was copied.

export type TStoryClipboard = 'clipboard-api' | 'copy-command' | 'none';

export interface IStoryClipboard {
  /** The texts copied, in order. */
  copied: string[];
  /** Puts back the page's own clipboard and copy command. */
  restore: () => void;
}

/** Gives `target` an own `key`, returning what puts back what it had. */
const override = (target: object, key: string, value: unknown): (() => void) => {
  const own = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  return () => {
    if (own) {
      Object.defineProperty(target, key, own);
    } else {
      delete (target as Record<string, unknown>)[key];
    }
  };
};

/** The text area the copy command copies from: the selected one appended to the body. */
const selectedText = (): string | undefined => {
  const area = document.body.querySelector(
    ':scope > textarea:last-of-type'
  ) as HTMLTextAreaElement | null;
  return area ? area.value.slice(area.selectionStart, area.selectionEnd) : undefined;
};

/** Makes the page copy as `kind` says, until `restore` is called. */
export const stubClipboard = (kind: TStoryClipboard): IStoryClipboard => {
  const copied: string[] = [];
  const restores: (() => void)[] = [];
  try {
    restores.push(
      override(
        navigator,
        'clipboard',
        kind === 'clipboard-api' ?
          {
            writeText: async (text: string) => {
              copied.push(text);
            },
          }
        : undefined
      )
    );
    restores.push(
      override(document, 'execCommand', (command: string) => {
        if (kind !== 'copy-command' || command !== 'copy') {
          return false;
        }
        const text = selectedText();
        if (text === undefined) {
          return false;
        }
        copied.push(text);
        return true;
      })
    );
  } catch (error) {
    restores.reverse().forEach((restore) => restore());
    throw error;
  }
  return {
    copied,
    restore: () =>
      restores
        .splice(0)
        .reverse()
        .forEach((restore) => restore()),
  };
};

/** The clipboard of the story running now, if it chose one. */
let storyClipboard: IStoryClipboard | undefined;

/** A story's `beforeEach` that makes the page copy as `kind` says, for that story only. */
export const withStoryClipboard = (kind: TStoryClipboard) => () => {
  const clipboard = stubClipboard(kind);
  storyClipboard = clipboard;
  return () => {
    storyClipboard = undefined;
    clipboard.restore();
  };
};

/** The texts the running story copied (see `withStoryClipboard`). */
export const storyCopiedTexts = (): string[] => {
  if (!storyClipboard) {
    throw new Error(
      'The story did not choose a clipboard: give it `beforeEach: withStoryClipboard(…)`.'
    );
  }
  return storyClipboard.copied;
};
