import { describe, expect, it } from 'vitest';
import { findRowFocusTarget, isTypingControl } from '../src/components/form/engine/rowFocus';

/**
 * Which control an open row hands the caret to.
 *
 * The scan used to look for `input`, `textarea` and `[contenteditable]` and
 * nothing else, so every row whose editor is a pick-one (reqore checkboxes are
 * focusable icons, not inputs) or a selector (a `<button>`) opened with the
 * caret still on whatever opened it.
 */
const cell = (html: string): HTMLElement => {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
};

describe('the control an open row offers the caret', () => {
  it('is the text box when the row takes typed text', () => {
    const container = cell('<input id="text" /><button id="menu">…</button>');
    expect(findRowFocusTarget(container)?.id).toBe('text');
  });

  it('is the text box even when the editor draws its affordances first', () => {
    // A template picker / type menu / clear button sits BEFORE the input in
    // document order on most of the engine's own editors, so "the first
    // focusable element" would answer a text field with the button beside it.
    const container = cell('<button id="templates">{…}</button><input id="text" />');
    expect(findRowFocusTarget(container)?.id).toBe('text');
  });

  it('is the pick-one control when that is all the row has', () => {
    // What ReqoreCheckbox renders: a focusable icon, not an input.
    const container = cell(
      '<span id="one" tabindex="0"></span><span id="two" tabindex="0"></span>'
    );
    expect(findRowFocusTarget(container)?.id).toBe('one');
  });

  it('is the pick-one control when its choices are native checkboxes', () => {
    // What ReqoreCheckbox renders since reqore 0.78: a native checkbox, a switch or a radio.
    const container = cell(
      '<input id="one" type="checkbox" /><input id="two" type="checkbox" role="switch" />'
    );
    expect(findRowFocusTarget(container)?.id).toBe('one');
  });

  it('is the text box beside native choices, which take no typing', () => {
    // A creatable pick-one draws its choices before the box a value is typed into.
    const container = cell(
      '<input id="choice" type="checkbox" /><input id="radio" type="radio" /><input id="text" />'
    );
    expect(findRowFocusTarget(container)?.id).toBe('text');
  });

  it('is the selector button of a dropdown row', () => {
    const container = cell('<button id="select">Choose…</button>');
    expect(findRowFocusTarget(container)?.id).toBe('select');
  });

  it('is the editable region of a rich editor', () => {
    const container = cell('<div id="editor" contenteditable="true"></div>');
    expect(findRowFocusTarget(container)?.id).toBe('editor');
  });

  it('skips what cannot take a caret', () => {
    const container = cell(
      '<input type="hidden" id="hidden" /><input id="off" disabled /><button id="dead" disabled></button><span id="skip" tabindex="-1"></span><span id="real" tabindex="0"></span>'
    );
    expect(findRowFocusTarget(container)?.id).toBe('real');
  });

  it('skips a sibling field absorbed into this row', () => {
    // An absorbed field is a DIFFERENT field that happens to be drawn in this
    // row, above the editor. The engine opened this row, so the caret belongs
    // in this row's own editor.
    const container = cell(
      '<div class="options-readfirst-absorbed"><input id="sibling" /></div><button id="own">Choose…</button>'
    );
    expect(findRowFocusTarget(container)?.id).toBe('own');
  });

  it('skips the schema-message strip above the editor', () => {
    const container = cell(
      '<div class="options-readfirst-info-panel"><button id="dismiss">×</button></div><input id="own" />'
    );
    expect(findRowFocusTarget(container)?.id).toBe('own');
  });

  it('skips chrome hidden from assistive technology', () => {
    // reqore draws focusable-looking decoration this way — an animated button
    // keeps an `aria-hidden` copy of its own label beside the live one.
    const container = cell(
      '<span aria-hidden="true"><button id="decoration">Choose…</button></span><button id="live">Choose…</button>'
    );
    expect(findRowFocusTarget(container)?.id).toBe('live');
  });

  it('is nothing at all when the row offers no control', () => {
    expect(findRowFocusTarget(cell('<span>read-only preview</span>'))).toBeUndefined();
    // The row before its editor has mounted — the caller watches for it.
    expect(findRowFocusTarget(cell(''))).toBeUndefined();
    expect(findRowFocusTarget(null)).toBeUndefined();
  });
});

describe('isTypingControl', () => {
  it('reads a text box, a text area and an editable region as typed into', () => {
    expect(isTypingControl(cell('<input id="a" />').querySelector('input'))).toBe(true);
    expect(isTypingControl(cell('<input type="email" />').querySelector('input'))).toBe(true);
    expect(isTypingControl(cell('<textarea></textarea>').querySelector('textarea'))).toBe(true);
    expect(isTypingControl(cell('<div contenteditable="true"></div>').querySelector('div'))).toBe(
      true
    );
  });

  it('does not read a checkbox, a switch, a radio or a button as typed into', () => {
    expect(isTypingControl(cell('<input type="checkbox" />').querySelector('input'))).toBe(false);
    expect(
      isTypingControl(cell('<input type="checkbox" role="switch" />').querySelector('input'))
    ).toBe(false);
    expect(isTypingControl(cell('<input type="radio" />').querySelector('input'))).toBe(false);
    expect(isTypingControl(cell('<button></button>').querySelector('button'))).toBe(false);
    expect(isTypingControl(null)).toBe(false);
  });
});
