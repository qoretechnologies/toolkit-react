import { createContext } from 'react';

/**
 * "You are drawn under a row's label." True inside a compact row's editor, whose row already
 * names the field ("Language"), so a control that would head itself with the field's name
 * ("Language:" over its choices) says it twice. Such a control reads this and leaves its own
 * heading out; drawn anywhere else, the heading is the only name the choices have.
 */
export const RowLabelledContext = createContext<boolean>(false);
