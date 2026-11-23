// Copyright 2026 Qore Technologies, s.r.o.

/** The words of a field's description: the reveal of its long text, and the ⓘ that opens it beside a control. */
export interface IDescriptionLabels {
  /** After a description's first lines, to show the rest of it. */
  more: string;
  /** After the whole description, to show only its first lines again. */
  less: string;
  /** What the ⓘ beside a control is called, for a screen reader: `name` is the thing it explains. */
  about: (name: string) => string;
}

/** The English words. */
export const DEFAULT_DESCRIPTION_LABELS: IDescriptionLabels = {
  more: '...more',
  less: '...less',
  about: (name) => `About ${name}`,
};
