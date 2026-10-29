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

/**
 * Types `text` as a person does: one key at a time, each one a key press the editor hears (key down, the text it
 * inserts, key up), with nothing set in the editor any other way (qorus#646, David: the stories passed while
 * completion did not work for a person).
 */
export const typeAsAPerson = async (
  user: { keyboard: (keys: string) => Promise<unknown> },
  text: string
) => {
  for (const char of text) {
    // `{` and `[` start user-event's key names: doubled, they are the characters
    await user.keyboard(
      char === '{' ? '{{'
      : char === '[' ? '[['
      : char
    );
  }
};

/** Whether `element` is drawn where a person sees it: laid out, in the window, and not hidden. */
const seen = (element: HTMLElement) => {
  const box = element.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  if (
    box.bottom < 0 ||
    box.right < 0 ||
    box.top > window.innerHeight ||
    box.left > window.innerWidth
  )
    return false;
  for (let at: HTMLElement | null = element; at; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0)
      return false;
    if (at.getAttribute('data-popper-reference-hidden') === 'true') return false;
  }
  return true;
};

/** The names of the completion rows a person sees at the caret, in order: those laid out in the window. */
export const seenCompletionLabels = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('.reqore-popover-content .completion-menu [data-label]')
  )
    .filter(seen)
    .map((row) => row.getAttribute('data-label'));

/** The completion row a person sees highlighted: the one the keyboard is on. */
export const highlightedCompletionLabel = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '.reqore-popover-content .completion-menu [data-label][aria-selected="true"]'
    )
  )
    .filter(seen)
    .map((row) => row.getAttribute('data-label'))[0];

/** What the editor says of its text under it: its diagnostics, as a person reads them. */
export const saidOfTheText = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-severity]'))
    .map((item) => (item.textContent ?? '').trim())
    .filter(Boolean);

/**
 * A template picker drawn in a dropdown's popover fills it (qorus#646, David's review: the popover spanned 950px
 * around a 715px list, its far side empty): its edges are the popover's, less the popover's own padding.
 */
export const expectPickerFillsItsPopover = () => {
  const picker = document.querySelector<HTMLElement>('.template-picker');
  expect(picker, 'the template picker').toBeTruthy();
  const popover = picker!.closest<HTMLElement>('.reqore-popover-content');
  expect(popover, "the picker's popover").toBeTruthy();
  const inner = picker!.getBoundingClientRect();
  const outer = popover!.getBoundingClientRect();
  expect(outer.right - inner.right, 'empty space right of the picker').toBeLessThanOrEqual(16);
  expect(inner.left - outer.left, 'empty space left of the picker').toBeLessThanOrEqual(16);
};
