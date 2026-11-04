// Copyright 2026 Qore Technologies, s.r.o.

/**
 * The words a list of templates is read with (`buildTemplates`), including the window its "?" action opens for an
 * example value too long for the list. A host that translates its interface passes its own; the rest stay English.
 */
export interface IReqraftTemplateListLabels {
  /** A template's description in the list: its example value, given as written (cut where it is long). */
  exampleValue: (value: string) => string;
  /** The tooltip of the action that opens the whole example value. */
  showFullExampleValue: string;
  /** The tooltip of the action that picks a template holding others (a record), instead of opening it. */
  selectItem: string;
  /** The example-value window's heading, for a template without a name. */
  exampleValueTitle: string;
  /** The example-value window's copy action. */
  copy: string;
  /** What the example-value window says after the value was copied. */
  copied: string;
  /**
   * What the example-value window says when the value could not be copied (the browser refused, or offers no way to
   * copy): what failed and what to do instead.
   */
  copyFailed: string;
}

/** The English words, the ones a host gets when it passes none. */
export const DEFAULT_TEMPLATE_LIST_LABELS: IReqraftTemplateListLabels = {
  exampleValue: (value) => `Example value: ${value}`,
  showFullExampleValue: 'Show the full example value',
  selectItem: 'Select this item',
  exampleValueTitle: 'Example value',
  copy: 'Copy',
  copied: 'Example value copied to clipboard',
  copyFailed:
    'Could not copy the example value: the browser did not allow access to the clipboard. Select the text and copy it yourself.',
};
