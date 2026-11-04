// Copyright 2026 Qore Technologies, s.r.o.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClipboardUnavailableError, copyText, randomUuid } from '../src/helpers/secureContextApis';

/**
 * The secure-context APIs, with what reqraft does where they do not exist: a page served over plain http by address
 * or host name has no `navigator.clipboard` and no `crypto.randomUUID`.
 */

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Gives `target` an own `key` for the test, and puts back what it had. */
const overrides: (() => void)[] = [];
const override = (target: object, key: string, value: unknown) => {
  const own = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  overrides.push(() => {
    if (own) {
      Object.defineProperty(target, key, own);
    } else {
      delete (target as Record<string, unknown>)[key];
    }
  });
};

/** The page with no Clipboard API, as over plain http. */
const withoutClipboardApi = () => override(navigator, 'clipboard', undefined);

/** The page's copy command: answers `copies` and records the text selected when it ran. */
const copyCommand = (copies: boolean | 'throws') => {
  const copied: string[] = [];
  const execCommand = vi.fn((command: string) => {
    if (copies === 'throws') {
      throw new Error('not allowed');
    }
    const area = document.body.querySelector(':scope > textarea') as HTMLTextAreaElement | null;
    if (command === 'copy' && area) {
      copied.push(area.value.slice(area.selectionStart, area.selectionEnd));
    }
    return copies;
  });
  override(document, 'execCommand', execCommand);
  return { execCommand, copied };
};

/** A Clipboard API whose `writeText` resolves or rejects. */
const clipboardApi = (writes: 'resolves' | 'rejects') => {
  const writeText = vi.fn((_text: string) =>
    writes === 'resolves' ?
      Promise.resolve()
    : Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'))
  );
  override(navigator, 'clipboard', { writeText });
  return writeText;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  overrides
    .splice(0)
    .reverse()
    .forEach((restore) => restore());
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('copies with the Clipboard API where the page has it, and does not run the copy command', async () => {
    const writeText = clipboardApi('resolves');
    const { execCommand } = copyCommand(true);

    await expect(copyText('the value')).resolves.toBeUndefined();

    expect(writeText).toHaveBeenCalledExactlyOnceWith('the value');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('copies with the copy command where the page has no Clipboard API (plain http)', async () => {
    withoutClipboardApi();
    const { execCommand, copied } = copyCommand(true);

    await expect(copyText('line one\nline two')).resolves.toBeUndefined();

    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    // the whole text was selected when the command ran
    expect(copied).toEqual(['line one\nline two']);
  });

  it('falls back to the copy command when the Clipboard API refuses', async () => {
    const writeText = clipboardApi('rejects');
    const { execCommand, copied } = copyCommand(true);

    await expect(copyText('the value')).resolves.toBeUndefined();

    expect(writeText).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(copied).toEqual(['the value']);
  });

  it('rejects with ClipboardUnavailableError when the Clipboard API refuses and the copy command does not copy', async () => {
    clipboardApi('rejects');
    copyCommand(false);

    const result = copyText('the value');

    await expect(result).rejects.toBeInstanceOf(ClipboardUnavailableError);
    await expect(result).rejects.toThrow('The browser did not allow copying to the clipboard.');
  });

  it('rejects when there is no Clipboard API and the copy command does not copy', async () => {
    withoutClipboardApi();
    const { execCommand } = copyCommand(false);

    await expect(copyText('the value')).rejects.toBeInstanceOf(ClipboardUnavailableError);
    expect(execCommand).toHaveBeenCalledOnce();
  });

  it('rejects, and does not throw, when the copy command throws', async () => {
    withoutClipboardApi();
    copyCommand('throws');

    let result: Promise<void> | undefined;
    expect(() => {
      result = copyText('the value');
    }).not.toThrow();
    await expect(result).rejects.toBeInstanceOf(ClipboardUnavailableError);
  });

  it('rejects, and does not throw, when the page has neither the Clipboard API nor a copy command', async () => {
    withoutClipboardApi();
    override(document, 'execCommand', undefined);

    let result: Promise<void> | undefined;
    expect(() => {
      result = copyText('the value');
    }).not.toThrow();
    await expect(result).rejects.toBeInstanceOf(ClipboardUnavailableError);
  });

  it('rejects when the Clipboard API has no writeText and the copy command does not copy', async () => {
    override(navigator, 'clipboard', {});
    copyCommand(false);

    await expect(copyText('the value')).rejects.toBeInstanceOf(ClipboardUnavailableError);
  });

  it('leaves nothing in the page, and gives the focus and the selection back', async () => {
    withoutClipboardApi();
    copyCommand(true);
    document.body.innerHTML = '<input id="field" value="typed"><p id="text">some text</p>';
    const field = document.getElementById('field') as HTMLInputElement;
    field.focus();
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('text') as HTMLElement);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    await copyText('the value');

    expect(document.body.querySelectorAll('textarea')).toHaveLength(0);
    expect(document.activeElement).toBe(field);
    expect(document.getSelection()?.toString()).toBe('some text');
  });

  it('removes the text area when the copy command fails too', async () => {
    withoutClipboardApi();
    copyCommand('throws');

    await expect(copyText('the value')).rejects.toBeInstanceOf(ClipboardUnavailableError);
    expect(document.body.querySelectorAll('textarea')).toHaveLength(0);
  });
});

describe('randomUuid', () => {
  it('is the browser’s crypto.randomUUID where it exists', () => {
    const randomUUID = vi.fn(() => '123e4567-e89b-42d3-a456-426614174000' as const);
    override(globalThis.crypto, 'randomUUID', randomUUID);

    expect(randomUuid()).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('is a version 4 UUID built from crypto.getRandomValues where randomUUID does not exist (plain http)', () => {
    override(globalThis.crypto, 'randomUUID', undefined);
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues');

    const ids = Array.from({ length: 200 }, () => randomUuid());

    ids.forEach((id) => expect(id).toMatch(V4));
    expect(new Set(ids).size).toBe(ids.length);
    expect(getRandomValues).toHaveBeenCalledTimes(200);
  });

  it('sets the version and variant bits whatever the random bytes are', () => {
    override(globalThis.crypto, 'randomUUID', undefined);
    for (const fill of [0x00, 0xff]) {
      vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementationOnce(
        <T extends ArrayBufferView | null>(array: T) => {
          new Uint8Array((array as unknown as Uint8Array).buffer).fill(fill);
          return array;
        }
      );
      const id = randomUuid();
      expect(id).toMatch(V4);
      expect(id).toBe(
        fill === 0 ? '00000000-0000-4000-8000-000000000000' : 'ffffffff-ffff-4fff-bfff-ffffffffffff'
      );
    }
  });
});
