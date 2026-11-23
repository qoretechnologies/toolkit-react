// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { findAskedFieldFocusTarget, findRowFocusTarget } from '../src/components/form/engine/rowFocus';

/**
 * A card hands the caret only to where text goes, so that nobody presses a toolbar button they never asked for. A
 * field the host asked for by name (`focusFieldRequest`) was asked for: a card with no text box takes the caret on
 * its checked choice, else its first, else its picker - never on its chrome.
 */
const card = (html: string) => {
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.appendChild(element);
  return element;
};

const CHROME = '<button class="fullscreen">Fullscreen</button>';

describe('a card the host asked for by name', () => {
  it('takes the caret on its checked choice', () => {
    const editor = card(
      `${CHROME}<input type="radio" name="k" value="a"><input type="radio" name="k" value="b" checked><input type="radio" name="k" value="c">`
    );

    expect(findRowFocusTarget(editor, { textEntryOnly: true }), 'a card alone gives it to no choice').toBeUndefined();
    expect((findAskedFieldFocusTarget(editor) as HTMLInputElement).value).toBe('b');
  });

  it('takes it on its first choice when none is checked', () => {
    const editor = card(`${CHROME}<div role="radio" tabindex="0" aria-checked="false">A</div><div role="radio" tabindex="0" aria-checked="false">B</div>`);

    expect(findAskedFieldFocusTarget(editor)?.textContent).toBe('A');
  });

  it("takes it on a picker's trigger, never on the card's chrome", () => {
    const editor = card(`${CHROME}<button aria-haspopup="listbox" class="trigger">Service</button>`);

    expect(findAskedFieldFocusTarget(editor)?.className).toBe('trigger');
  });

  it('takes it where text goes, when it has a text box', () => {
    const editor = card(`${CHROME}<input type="radio" checked><input type="text" class="typed">`);

    expect(findAskedFieldFocusTarget(editor)?.className).toBe('typed');
  });

  it('takes it nowhere when the card offers only its chrome', () => {
    expect(findAskedFieldFocusTarget(card(CHROME))).toBeUndefined();
  });
});
