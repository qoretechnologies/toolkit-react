// Copyright 2026 Qore Technologies, s.r.o.
// Visual constants for the SmartEditor stack. Mirrors the styling
// vocabulary used throughout qorus-ide (`src/components/Field/multiPair.tsx`
// for effect constants, `src/constants/util.ts` for DRAWER_STYLE) so
// the editor blends in with the rest of the IDE without depending on
// qorus-ide-specific exports.
//
// Reqraft is meant to be standalone-usable — cloning these constants
// rather than re-exporting from qorus-ide keeps the dependency graph
// clean. Source attribution is in comments next to each constant.

import type { IReqoreCustomTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import type { IReqoreEffect } from '@qoretechnologies/reqore/dist/components/Effect';
import type { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';

/**
 * Frosted-glass backdrop for the completion / hover / signature
 * popovers. Matches qorus-ide's `DRAWER_CONTENT_EFFECT` so editor
 * popovers feel like the same surface family as Reqore drawers.
 * Cloned from `qorus-ide/src/constants/util.ts:DRAWER_CONTENT_EFFECT`.
 */
export const SMART_EDITOR_OVERLAY_EFFECT = {
  backgroundBlur: 20,
} as const satisfies IReqoreEffect;

/**
 * Tone for the completion / hover / signature popovers — a dark
 * IDE-page-card colour that reads on both Qonsole-tinted hosts and
 * standalone forms. Matches qorus-ide's "metrics / history panel"
 * tone (`#1a1a1a`).
 */
export const SMART_EDITOR_POPOVER_CUSTOM_THEME: IReqoreCustomTheme = {
  main: '#1a1a1a',
};

/**
 * Severity → Reqore effect mapping for the diagnostic message panel
 * below the editor. Each severity gets a coloured gradient (cloned
 * shape from `qorus-ide/src/components/Field/multiPair.tsx`
 * `NegativeColorEffect` / `WarningColorEffect` / `PendingColorEffect`).
 *
 * LSP DiagnosticSeverity:
 *   1 Error    → danger gradient
 *   2 Warning  → warning gradient
 *   3 Info     → pending gradient (subtle muted-purple)
 *   4 Hint     → pending gradient (same as info)
 */
export const DIAGNOSTIC_SEVERITY_EFFECTS: Record<number, IReqoreEffect> = {
  1: {
    gradient: {
      direction: 'to right bottom',
      colors: { 0: 'danger:lighten:3', 100: 'danger:darken:3' },
      animate: 'hover',
    },
  },
  2: {
    gradient: {
      direction: 'to right',
      colors: { 0: 'warning:lighten:2', 100: 'warning:lighten:3' },
    },
  },
  3: {
    gradient: {
      direction: 'to right bottom',
      colors: { 0: 'pending:lighten:3', 100: '#160437' },
    },
  },
  4: {
    gradient: {
      direction: 'to right bottom',
      colors: { 0: 'pending:lighten:3', 100: '#160437' },
    },
  },
};

/**
 * LSP `CompletionItemKind` → Reqore intent for the per-row kind chip.
 * Lets the chip carry visual weight beyond just `minimal: true` while
 * still being subdued enough not to compete with the row label.
 *
 * Indices align with the LSP `CompletionItemKind` enum (1 = Text,
 * 2 = Method, …). Unknown kinds get no intent (default chip).
 */
export const COMPLETION_KIND_INTENTS: Record<number, TReqoreIntent> = {
  2: 'success', // Method
  3: 'success', // Function
  5: 'info', // Field
  6: 'info', // Variable
  7: 'success', // Class
  8: 'success', // Interface
  10: 'info', // Property
  12: 'warning', // Value
  14: 'info', // Keyword
  15: 'pending', // Snippet — Qonsole uses this kind for wizard items
  21: 'warning', // Constant
};
