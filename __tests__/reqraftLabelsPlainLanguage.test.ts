import { describe, expect, it } from 'vitest';
import { DEFAULT_REQRAFT_LABELS } from '../src/helpers/reqraftLabels';

/*
 * The labels reqraft shows are read by the hosts' users — supply chain managers as often as engineers — so they are
 * plain language. Technical words (network detail, run-time jargon) belong in a host's "Show more info", not in a
 * label. "known when it runs" (#161) read as confusing and ambiguous: what a label means has to be plain to a user
 * who is a supply chain manager, not an engineer.
 */
const TECHNICAL = [
  /\bhosts?\b/i,
  /\bports?\b/i,
  /\breachable\b/i,
  /\b(TLS|SSL)\b/,
  /\bcertificates?\b/i,
  /\bsockets?\b/i,
  /\b(TCP|DNS)\b/,
  /\bfirewalls?\b/i,
  /\bstack trace\b/i,
  /\berrno\b/i,
  /\bknown when it runs\b/i,
  /\bruntime\b/i,
];

/** Every string in the labels, with the path that leads to it. */
const strings = (value: unknown, path: string): [string, string][] => {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => strings(child, `${path}.${key}`));
  }
  return [];
};

describe('reqraft labels are plain language', () => {
  const all = strings(DEFAULT_REQRAFT_LABELS, 'labels');

  it('reads every label', () => {
    // the walk is what makes the check mean anything
    expect(all.length).toBeGreaterThan(100);
  });

  it('uses no technical words', () => {
    const offenders = all.flatMap(([path, text]) =>
      TECHNICAL.filter((pattern) => pattern.test(text)).map(
        (pattern) => `${path}: ${pattern} in "${text}"`
      )
    );
    expect(offenders).toEqual([]);
  });

  it('says that a value depends on the incoming data in plain words', () => {
    expect(DEFAULT_REQRAFT_LABELS.formEngine.knownWhenItRuns).toBe(
      'Depends on the incoming data, so it is checked when this runs.'
    );
  });
});

/*
 * Copy says what the reader wants, never what the code does: no UI-mechanism words in a default
 * label - no panel, drawer, row or component, no collapse or expand, no rendering, no language server or request, no
 * "the rest of the…". An open field's label said "Collapse Address", the editor's wait "Connecting to language
 * server…", the schema editor's hint "Click any row to edit it in a side panel".
 */
const MECHANISM =
  /\b(panels?|drawers?|rows?|components?|collaps\w*|expand\w*|render\w*|LSP|language server|requests?|the rest of)\b/i;

/*
 * Where a word on that list is the reader's own: reference data is the rows a database table holds, an API call
 * answers requests, and a support ticket can be a feature request.
 */
const READERS_OWN: Record<string, RegExp> = {
  'labels.schemaDefinition.referenceDataHint': /\brows?\b/gi,
  'labels.validation.apiCallNeedsRequests': /\brequests\b/gi,
  'labels.supportTicket.categories.feature': /\brequest\b/gi,
};

/** Text a label gives: a string as it is; a function called with stand-in values; a list of parts joined. */
const said = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((part) => said(part) ?? '').join('');
  if (typeof value !== 'function') return undefined;
  // a stand-in for each argument, tried in turn until the function gives words: a name, a count, a list, a renderer
  const standIns: unknown[] = ['Name', 2, ['Name', 'Other'], (part: unknown) => part];
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

describe('reqraft labels say what the reader wants', () => {
  const all = allSaid(DEFAULT_REQRAFT_LABELS, 'labels');

  it('reads every label, the functions too', () => {
    expect(all.length).toBeGreaterThan(strings(DEFAULT_REQRAFT_LABELS, 'labels').length);
    expect(all).toContainEqual(['labels.formEngine.collapse', 'Close Name']);
    expect(MECHANISM.test('Collapse Name')).toBe(true);
    expect(MECHANISM.test('Connecting to language server…')).toBe(true);
    expect(MECHANISM.test('Close Name')).toBe(false);
  });

  it('names no mechanism', () => {
    const offenders = all
      .filter(([path, text]) => MECHANISM.test(text.replace(READERS_OWN[path] ?? /$^/, '')))
      .map(([path, text]) => `${path}: "${text}"`);
    expect(offenders).toEqual([]);
  });
});
