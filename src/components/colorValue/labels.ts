// Copyright 2026 Qore Technologies, s.r.o.

/** The words a color is read with. A host that translates its interface passes its own. */
export interface IReqraftColorValueLabels {
  /** The swatch's text alternative, for the color it shows (`#6495ED`, `rgba(…)`). */
  swatch: (color: string) => string;
  /** What a value that is not a color is said to be; `shown` is the value as text. */
  invalid: (shown: string) => string;
  /** What is said when there is no color. */
  empty: string;
}

/** The English words; a compact form row's summary of a color uses them too. */
export const DEFAULT_COLOR_VALUE_LABELS: IReqraftColorValueLabels = {
  swatch: (color) => `Color ${color}`,
  invalid: (shown) => `Not a color: ${shown}`,
  empty: 'No color',
};
