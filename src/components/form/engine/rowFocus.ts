/**
 * Which control an open compact row hands the caret to.
 *
 * A row's editor is whatever the field's type asks for, and only some of those
 * take typed text. A pick-one renders `ReqoreCheckbox`es (a `[tabindex]`
 * element), a selector renders a `<button>`, a code field a `[contenteditable]`
 * — so a scan that looked for `input`, `textarea` and `[contenteditable]` alone
 * found nothing on most of the first questions a form asks ("which kind?",
 * "which connection?", "which interface?"). The row opened and the caret stayed
 * on whatever made it open.
 *
 * Text entry wins when the row offers it. Every editor that takes typing also
 * draws affordances around it — a template picker, a type menu, a clear button
 * — and those come first in document order often enough that "the first
 * focusable element" would answer a text field with a button beside it.
 */

/** Controls the reader types into. */
const TEXT_ENTRY_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]';

/**
 * Everything else a row can offer. `[tabindex]` is what carries reqore's own
 * controls: a checkbox is an icon element made focusable, not an `<input>`.
 */
const OTHER_CONTROL_SELECTOR =
  'button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Subtrees inside the row's value cell that are NOT this field's editor: a
 * sibling field absorbed into this row (a different field, which the engine did
 * not open) and the schema-message strip above the editor (guidance about the
 * value, never a place to put one).
 */
const NOT_THE_FIELDS_OWN_EDITOR = '.options-readfirst-absorbed, .options-readfirst-info-panel';

const belongsToTheFieldsOwnEditor = (container: HTMLElement, element: Element): boolean => {
  const foreign = element.closest(NOT_THE_FIELDS_OWN_EDITOR);
  // `closest` walks past the container too, so a match only disqualifies the
  // element when it is inside THIS container.
  return !foreign || !container.contains(foreign);
};

const firstMatch = (container: HTMLElement, selector: string): HTMLElement | undefined => {
  const matches = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return matches.find(
    (element) =>
      belongsToTheFieldsOwnEditor(container, element) &&
      // An element hidden from assistive technology is not a destination for a
      // caret either — reqore draws decorative, focusable-looking chrome that
      // way.
      !element.closest('[aria-hidden="true"]')
  );
};

/**
 * The control an open row should focus, or `undefined` when it offers none —
 * a read-only preview, or an editor that has not mounted yet (see the caller,
 * which watches for it to arrive).
 *
 * @param container the row's value cell
 */
export const findRowFocusTarget = (
  container: HTMLElement | null | undefined
): HTMLElement | undefined => {
  if (!container) {
    return undefined;
  }
  return (
    firstMatch(container, TEXT_ENTRY_SELECTOR) ?? firstMatch(container, OTHER_CONTROL_SELECTOR)
  );
};

/**
 * Controls whose ONLY behaviour is to reveal the choices.
 *
 * A row that opens hands the caret to the control it offers, and for most
 * editors that is the end of it: a text box takes typing, a pick-one's
 * checkboxes take a click. A PICKER is different — its closed state prints the
 * value it already holds, which is the very thing the read row printed, so
 * opening the row changed nothing on screen and the author had to click a
 * second time to see the list. Read-first belongs to the collapsed row; it must
 * not be the answer twice.
 *
 * Declared with `aria-haspopup`, which is what the attribute means and is
 * already the contract with assistive technology — so a host's own editor opts
 * in by being accessible rather than by knowing about this file. `aria-expanded`
 * is respected: a picker that is already showing its list is not re-activated.
 */
const PICKER_TRIGGER_SELECTOR =
  '[aria-haspopup="listbox"], [aria-haspopup="dialog"], [aria-haspopup="menu"], [aria-haspopup="tree"], [aria-haspopup="grid"]';

/**
 * Whether this control is a picker that is still closed — i.e. whether
 * activating it is what "open the editor" means for this row.
 */
export const isClosedPickerTrigger = (element: HTMLElement | null | undefined): boolean =>
  !!element &&
  typeof element.matches === 'function' &&
  element.matches(PICKER_TRIGGER_SELECTOR) &&
  element.getAttribute('aria-expanded') !== 'true';
