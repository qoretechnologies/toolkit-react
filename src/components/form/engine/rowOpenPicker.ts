import { createContext } from 'react';

/**
 * "The row you are in has just been opened, and the control you are is the one
 * it offers — so show the choices."
 *
 * A compact row is read-first: collapsed, it prints the value; clicked, it
 * mounts the editor. For a PICKER the editor is a closed trigger printing the
 * same value the read row had just printed, so the row opened and nothing on
 * screen changed — the author had to click a second time to reach the list.
 * Read-first is the collapsed row's job; it must not be the answer twice.
 *
 * The row decides, because only the row knows both things that matter: that the
 * AUTHOR opened it (a row the form opens to show a value must not throw a list
 * over it) and WHICH control it offers (`findRowFocusTarget` — the same scan
 * that hands over the caret). The control obeys, because only the control knows
 * how it opens.
 *
 * A one-shot pulse rather than a standing flag: it is `true` for exactly the
 * commit in which the editor acts on it, and false again afterwards, so an
 * editor that remounts later — a picker whose catalogue reloaded, after the
 * author had closed it — does not reopen itself off a stale instruction.
 *
 * Exported so a host's own editor can obey it too: read it with
 * `useContext(RowOpenPickerContext)` and open on the rising edge.
 */
export const RowOpenPickerContext = createContext<boolean>(false);
