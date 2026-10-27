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

/**
 * Every row of a list fits it (qorus#646, David's review: a row's name was cut to one letter, its type label cut
 * mid-word and its description drawn over its edge): each row's name, badges, description and actions are inside
 * the row, the name and each badge are not cut off, and no row is wider than its list.
 */
export const expectRowsFit = (rows: HTMLElement[]) => {
  expect(rows.length, 'rows to check').toBeGreaterThan(0);
  for (const row of rows) {
    const box = row.getBoundingClientRect();
    const name = row.getAttribute('data-label') ?? row.textContent;
    const list = row.closest('[role="listbox"]')?.getBoundingClientRect();
    if (list) {
      expect(box.right, `the row ${name} inside its list`).toBeLessThanOrEqual(list.right + 1);
    }
    for (const part of Array.from(row.querySelectorAll<HTMLElement>('*'))) {
      const rect = part.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      expect(rect.left, `${name}: ${part.className} inside the row`).toBeGreaterThanOrEqual(
        box.left - 1
      );
      expect(rect.right, `${name}: ${part.className} inside the row`).toBeLessThanOrEqual(
        box.right + 1
      );
      expect(rect.bottom, `${name}: ${part.className} inside the row`).toBeLessThanOrEqual(
        box.bottom + 1
      );
    }
    for (const text of Array.from(
      row.querySelectorAll<HTMLElement>(
        '.reqore-button-text-content:not(.reqore-invisible), .reqore-tag-content'
      )
    )) {
      expect(text.scrollWidth, `${name}: "${text.textContent}" not cut off`).toBeLessThanOrEqual(
        text.clientWidth + 1
      );
    }
  }
};

/** The rows of the completion list open at an editor's caret. */
export const completionRows = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('.reqore-popover-content .completion-menu [data-label]')
  );
