// Copyright 2026 Qore Technologies, s.r.o.

/** The words a colour is read with. A host that translates its interface passes its own. */
export interface IReqraftColorValueLabels {
  /** The swatch's text alternative, for the colour it shows (`#6495ED`, `rgba(…)`). */
  swatch: (color: string) => string;
  /** What a value that is not a colour is said to be; `shown` is the value as text. */
  invalid: (shown: string) => string;
  /** What is said when there is no colour. */
  empty: string;
}

/** The English words; a compact form row's summary of a colour uses them too. */
export const DEFAULT_COLOR_VALUE_LABELS: IReqraftColorValueLabels = {
  swatch: (color) => `Colour ${color}`,
  invalid: (shown) => `Not a colour: ${shown}`,
  empty: 'No colour',
};
