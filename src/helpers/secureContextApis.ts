// Copyright 2026 Qore Technologies, s.r.o.
import { reqraftLabels } from './reqraftLabels';

/**
 * Browser APIs that exist only in a secure context (https, or localhost), with what to do where they do not.
 *
 * Reqraft's components are also served over plain http by address or host name, as a review Storybook or a Qorus
 * instance on a LAN is. There `navigator.clipboard`, `crypto.randomUUID` and `crypto.subtle` are undefined: a copy
 * button that called `navigator.clipboard.writeText` directly threw, and the user was told nothing. Everything in
 * reqraft goes through this module instead; `__tests__/secureContextApisOnlyThroughTheHelper.test.ts` refuses a
 * direct use anywhere else.
 */

/**
 * A random UUID (version 4): `crypto.randomUUID()` where the browser has it, and otherwise one built from
 * `crypto.getRandomValues()`, which every browser has in any context.
 *
 * It is the tracking module's event id, so there is one implementation: the tracking module imports nothing outside
 * `src/tracking/`, so it cannot take it from here.
 */
export { eventId as randomUuid } from '../tracking/core/ids';

/** Thrown when no way of copying worked, so a caller can show that the copy did not happen. */
export class ClipboardUnavailableError extends Error {
  constructor() {
    super(reqraftLabels().components.clipboardRefused);
    this.name = 'ClipboardUnavailableError';
  }
}

/**
 * Copy with a selected, off-screen text area and the browser's copy command: what works where the Clipboard API is
 * not offered. The focus and the selection the user had are put back afterwards.
 */
const copyWithSelection = (text: string): boolean => {
  if (
    typeof document === 'undefined' ||
    typeof document.execCommand !== 'function' ||
    !document.body
  ) {
    return false;
  }
  const active = document.activeElement as HTMLElement | null;
  const selection = document.getSelection();
  const ranges =
    selection && selection.rangeCount ?
      Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index))
    : [];
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  area.style.opacity = '0';
  document.body.appendChild(area);
  try {
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
    active?.focus?.({ preventScroll: true });
  }
};

/**
 * Copy text to the clipboard.
 *
 * The Clipboard API where the browser offers it (a secure context), and the browser's copy command where it does not
 * or refuses. Resolves when the text was copied; rejects with {@link ClipboardUnavailableError} when nothing worked,
 * so the caller can say so. It never throws synchronously.
 */
export const copyText = async (text: string): Promise<void> => {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (typeof clipboard?.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // refused (no permission, the document not focused): the copy command may still be allowed
    }
  }
  if (copyWithSelection(text)) {
    return;
  }
  throw new ClipboardUnavailableError();
};
