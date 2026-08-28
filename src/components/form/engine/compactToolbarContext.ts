import React from 'react';
import { createContext } from 'use-context-selector';

/** Compact field sort modes (Fields menu → "Sort by"). 'schema' keeps the
 * schema's declared order (the default); the others reorder fields WITHIN each
 * group, with schema order as the stable tiebreaker. */
export type TCompactSort = 'schema' | 'alpha' | 'alpha-desc' | 'unset' | 'invalid';

/** A not-yet-selected optional field offered in the compact "Fields" menu. */
export interface ICompactToolbarOptionalField {
  value: string;
  display_name?: string;
  short_desc?: string;
  disabled?: boolean;
}

/**
 * The closure surface the extracted `CompactToolbar` reads through context.
 * Assembled (memoised) by `FormEngine` and provided around the compact render,
 * so the toolbar — which Reqore instantiates as a panel header action — can
 * reach the form's state/handlers without threading a props bag through the
 * `actions` descriptor. Primitives (counts, booleans) are passed pre-computed
 * to keep the toolbar decoupled from FormEngine's internals.
 */
export interface ICompactToolbarContext {
  readOnly?: boolean;
  /** Which parts to render, already resolved from the engine's `compactToolbar`
   *  prop — every key present, no undefined to re-default here. */
  parts: {
    completion: boolean;
    search: boolean;
    fields: boolean;
    help: boolean;
  };
  // Completion meter
  invalidCount: number;
  attentionCount: number;
  completion: { set: number; total: number; pct: number };
  // Invalid-fields banner (pinned in the sticky header)
  showInvalidOnly: boolean;
  onToggleInvalidOnly: () => void;
  // Search
  hasMultipleOptions: boolean;
  compactQuery: string;
  setCompactQuery: (value: string) => void;
  // Fields menu
  requiredOnly: boolean;
  setRequiredOnly: React.Dispatch<React.SetStateAction<boolean>>;
  // Field sort (Fields menu → "Sort by"); applied within groups.
  compactSort: TCompactSort;
  setCompactSort: React.Dispatch<React.SetStateAction<TCompactSort>>;
  showFieldTypes: boolean;
  onToggleFieldTypes: () => void;
  // Global field-info toggle (toolbar ⓘ), tri-state: undefined = default
  // (critical messages auto-open), true = show all, false = hide all.
  showAllDescriptions: boolean | undefined;
  onToggleAllDescriptions: () => void;
  filteredCount: number;
  optionalFields: ICompactToolbarOptionalField[];
  canRevert: boolean;
  onAddOptionalField: (value: unknown) => void;
  onAddAll: () => void;
  onResetDefaults: () => void;
  onRevertAll: () => void;
}

export const CompactToolbarContext = createContext<ICompactToolbarContext>(
  {} as ICompactToolbarContext
);
