// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { DEFAULT_REQRAFT_LABELS } from '../src/helpers/reqraftLabels';

/*
 * Every default label is in sentence case: its first word capitalized, the rest not, apart from
 * acronyms (all capitals: AI, YAML) and names. The field help dialog's title was "Help For “…”".
 *
 * A name keeps its capital: Qorus and its products and types, and, where a label points the
 * reader at a control or a key by the words it shows ("the Expression tab", "press Enter"),
 * those words.
 */
const NAMES = /^(Qorus|Qore|Qogs?|Qonsole|Qlip|DataSchema)\b/;

/** Where a label names a control or a key by the words it shows, or a team by its name. */
const NAMES_A_CONTROL: Record<string, RegExp> = {
  'labels.valueTabs.expressionDraftNotUsed': /\bExpression tab\b/g,
  'labels.expressions.textUnreadable': /\bVisual view\b/g,
  'labels.supportTicket.supportName': /\bQorus Support\b/g,
  'labels.supportTicket.previewUnavailable': /\bDownload\b/g,
  'labels.abTest.notSetUp': /\bDesigner\b/g,
  'labels.abTest.helpNotSetUp': /\bDesigner\b/g,
  'labels.abTest.verdictDraft': /\bStart test\b/g,
  'labels.abTest.controlsNotSetUp': /\b(Accept|Remove)\b/g,
  'labels.abTest.controlsUnreachable': /\b(Accept|Remove)\b/g,
  'labels.abTest.stopDescription': /\bAccept\b/g,
  'labels.abTest.helpShow': /\bEnter\b/g,
  'labels.abTest.helpLifecycle': /\bResume\b/g,
};

/** A label's text: a string as is, a function called with lower-case stand-ins, parts joined. */
const said = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((part) => said(part) ?? '').join('');
  if (typeof value !== 'function') return undefined;
  const standIns: unknown[] = ['thing', 2, ['thing', 'other'], (part: unknown) => part];
  for (const standIn of standIns) {
    try {
      const text = said((value as (...args: unknown[]) => unknown)(...Array(3).fill(standIn)));
      if (text !== undefined) return text;
    } catch {
      // not this stand-in
    }
  }
  return undefined;
};

/** Every label's words, functions included, with the path that leads to it. */
const allSaid = (value: unknown, path: string): [string, string][] => {
  const text = said(value);
  if (text !== undefined) return [[path, text]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => allSaid(child, `${path}.${key}`));
  }
  return [];
};

/** A label's capitalized words after each sentence's first, quoted text left out. */
const titleCaseWords = (text: string): string[] =>
  text
    .replace(/“[^”]*”|"[^"]*"|`[^`]*`/g, ' ')
    .split(/[.!?:…·—(]\s+|\n/)
    .flatMap((sentence) => sentence.trim().split(/\s+/).slice(1))
    .filter((word) => /^[A-Z][a-z]/.test(word) && !NAMES.test(word));

describe('reqraft labels are in sentence case', () => {
  const all = allSaid(DEFAULT_REQRAFT_LABELS, 'labels');

  it('reads every label, the functions too', () => {
    expect(all.length).toBeGreaterThan(300);
    expect(titleCaseWords('Help For "Address"')).toEqual(['For']);
    expect(titleCaseWords('Help for "Address"')).toEqual([]);
    expect(titleCaseWords('Set by Qorus. Use YAML')).toEqual([]);
  });

  it('capitalizes no word after the first, apart from acronyms and names', () => {
    const offenders = all
      .map(([path, text]) => [
        path,
        text,
        titleCaseWords(text.replace(NAMES_A_CONTROL[path] ?? /$^/, '')),
      ])
      .filter(([, , words]) => words.length)
      .map(([path, text, words]) => `${path}: ${(words as string[]).join(', ')} in "${text}"`);
    expect(offenders).toEqual([]);
  });

  it('titles the field help dialog in sentence case', () => {
    expect(DEFAULT_REQRAFT_LABELS.formEngine.helpFor('Address')).toBe('Help for "Address"');
  });
});
