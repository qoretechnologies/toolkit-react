// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What the stories of the template picker (`TemplatePicker`) and the rows typing opens (`CompletionList`) read:
 * the rows by their names, a row by its name, and what an editor holds - its chips by what they say, and its text
 * that is not a chip.
 */
import { expect, waitFor } from 'storybook/test';

/** The names of the rows of the completion list open at an editor's caret, in order. */
export const completionLabels = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('.reqore-popover-content .completion-menu [data-label]')
  ).map((row) => row.getAttribute('data-label'));

/** The completion list's row named `label`. */
export const completionRow = (label: string) =>
  waitFor(
    () => {
      const row = document.querySelector<HTMLElement>(
        `.reqore-popover-content .completion-menu [data-label="${label}"]`
      );
      expect(row, `the row ${label}`).toBeTruthy();
      return row!;
    },
    { timeout: 30000 }
  );

/** The names of the template picker's rows, in order. */
export const pickerLabels = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.template-picker .template-picker-row')).map(
    (row) => row.getAttribute('data-label')
  );

/** The template picker's row named `label`. */
export const pickerRow = (label: string) =>
  waitFor(
    () => {
      const row = document.querySelector<HTMLElement>(
        `.template-picker .template-picker-row[data-label="${label}"]`
      );
      expect(row, `the picker's row ${label}`).toBeTruthy();
      return row!;
    },
    { timeout: 30000 }
  );

/** The name of the template picker's row the keyboard is on. */
export const pickerFocused = () =>
  document.querySelector('.template-picker-row[aria-selected="true"]')?.getAttribute('data-label');

/** The template picker's search box. */
export const pickerSearch = () =>
  waitFor(() => {
    const input = document.querySelector<HTMLInputElement>('.template-picker input');
    expect(input, 'the search box').toBeTruthy();
    return input!;
  });

/** What the template picker's way back says, from the top to where it is. */
export const pickerCrumbs = () =>
  document.querySelector('.template-picker-crumbs')?.textContent ?? '';

/** The text of an editor that is not a chip. */
export const plainTextOf = (editable: HTMLElement) =>
  Array.from(editable.querySelectorAll<HTMLElement>('[data-slate-string]'))
    .map((node) => node.textContent ?? '')
    .join('')
    .replace(/﻿/g, '')
    .trim();

/** The chips in an editor, by what they say. */
export const chipsOf = (editable: HTMLElement) =>
  Array.from(editable.querySelectorAll<HTMLElement>('.reqore-tag')).map((chip) =>
    (chip.textContent ?? '').replace(/﻿/g, '').trim()
  );
