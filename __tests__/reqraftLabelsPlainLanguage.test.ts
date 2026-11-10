import { describe, expect, it } from 'vitest';
import { DEFAULT_REQRAFT_LABELS } from '../src/helpers/reqraftLabels';

/*
 * The labels reqraft shows are read by the hosts' users — supply chain managers as often as engineers — so they are
 * plain language. Technical words (network detail, run-time jargon) belong in a host's "Show more info", not in a
 * label. Qlip review of #161 (Foxhoundn) on "known when it runs": "This is very confusing and ambiguous and needs to
 * be telegraphed more clearly to the users (especially because they are supply chain managers and not techies)".
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
