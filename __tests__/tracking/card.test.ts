import {
  actionOutcome,
  barValues,
  canAccept,
  canPause,
  canRemove,
  canStart,
  canStop,
  confirmCopy,
  lifecycleCopy,
  numbersLine,
  phaseNote,
  statusTag,
  verdictIntent,
  verdictLine,
  versionRows,
  versionsMaxHeight,
  winnerNote,
  sortVersionRows,
  leadingVersion,
  helpSections,
} from '../../src/tracking/ui/card';
import { createExperimentsAdminClient, ExperimentsAdminError } from '../../src/tracking/ui/client';
import type { IExperimentEntry as IEditorEntry } from '../../src/tracking/ui/types';

/** An entry in the shape of the editor route (contract v2: admin experiment + admin results). */
const entry = (patch: Partial<IEditorEntry['experiment']> = {}, results: Partial<NonNullable<IEditorEntry['results']>> | null = {}): IEditorEntry => ({
  experiment: {
    key: 'hero-input',
    name: 'Hero: Qonsole input vs problem wizard',
    status: 'running',
    phase: 1,
    variants: [
      { key: 'a', name: 'Qonsole input', weight: 0.5, control: true },
      { key: 'b', name: 'Problem wizard', weight: 0.5 },
    ],
    ...patch,
  },
  results:
    results === null
      ? null
      : {
          verdict: 'too-early',
          metrics: [
            {
              key: 'get-started-click',
              name: 'Clicked Get Started',
              role: 'primary',
              variants: [
                { variant: 'a', exposed: 412, converters: 37, rate: 0.0898, chance_to_beat: null },
                { variant: 'b', exposed: 405, converters: 49, rate: 0.121, chance_to_beat: 0.893 },
              ],
            },
            { key: 'bounce', role: 'guardrail', variants: [{ variant: 'b', exposed: 1, converters: 1, rate: 1, chance_to_beat: 0.01 }] },
          ],
          ...results,
        },
});

describe('versionRows', () => {
  it('handles a test with no page markers (the card on its own)', () => {
    expect(versionRows(entry()).map((r) => r.inCode)).toEqual([true, true]);
  });

  it('takes versions from the server and numbers from the primary metric', () => {
    expect(versionRows(entry(), ['a', 'b'])).toEqual([
      { key: 'a', name: 'Qonsole input', control: true, visitors: 412, conversion: 0.0898, chance: null, inCode: true },
      { key: 'b', name: 'Problem wizard', control: false, visitors: 405, conversion: 0.121, chance: 0.893, inCode: true },
    ]);
  });

  it('falls back to the page’s versions (no numbers) for a test the server does not know', () => {
    expect(versionRows(undefined, ['a', 'b'])).toEqual([
      { key: 'a', name: 'Version A', control: true, visitors: null, conversion: null, chance: null, inCode: true },
      { key: 'b', name: 'Version B', control: false, visitors: null, conversion: null, chance: null, inCode: true },
    ]);
  });

  it('lists N versions, and marks one the page’s code does not render', () => {
    const five = entry({
      variants: ['a', 'b', 'c', 'd', 'e'].map((key, i) => ({ key, name: `V${key}`, weight: 0.2, control: i === 0 })),
    });
    const rows = versionRows(five, ['a', 'b', 'c', 'd']);
    expect(rows.map((r) => r.key)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(rows.map((r) => r.inCode)).toEqual([true, true, true, true, false]);
  });

  it('shows no numbers for a draft', () => {
    expect(versionRows(entry({ status: 'draft' }, null), ['a', 'b']).map((r) => r.visitors)).toEqual([null, null]);
  });
});

describe('verdictLine', () => {
  it('uses the server’s sentence when there is one', () => {
    const text = 'Problem wizard is likely better: 97% chance it beats Qonsole input on "Clicked Get Started".';
    expect(verdictLine(entry({}, { verdict: 'likely-winner', verdict_text: text }))).toBe(text);
  });

  it('falls back to plain words for each verdict', () => {
    expect(verdictLine(entry({}, { verdict: 'likely-winner', winner_variant: 'b' }))).toBe('Problem wizard is likely better than Qonsole input.');
    expect(verdictLine(entry({}, { verdict: 'likely-loser' }))).toBe('The new versions are likely worse than Qonsole input.');
    expect(verdictLine(entry({}, { verdict: 'no-clear-difference' }))).toBe('No clear difference between the versions yet.');
    expect(verdictLine(entry())).toBe('Too early to tell.');
    expect(verdictLine(entry({ status: 'draft' }, null))).toBe('Not started yet: press Start test to split visitors between the versions.');
    expect(verdictLine(entry({ status: 'concluded', winner: 'b' }))).toBe('Finished: Problem wizard won, and every visitor now sees it.');
    expect(verdictLine(undefined)).toMatch(/in the page's code but isn't set up yet: ask the Designer/);
    expect(verdictLine(undefined, { unreachable: true })).toMatch(/Can't reach the analytics service/);
    expect(verdictLine(undefined, { notSetUpText: 'Ask ops.' })).toBe('Ask ops.');
  });
});

describe('numbersLine', () => {
  it('names visitors, conversion on the primary metric and the chance to beat the original', () => {
    const [a, b] = versionRows(entry(), ['a', 'b']);
    expect(numbersLine(a, 'Clicked Get Started')).toBe('412 visitors · 9% “Clicked Get Started”');
    expect(numbersLine(b, 'Clicked Get Started')).toBe('405 visitors · 12.1% “Clicked Get Started” · 89% chance to beat the original');
    // Nothing to count: words, never a row of dashes.
    expect(numbersLine(versionRows(undefined, ['a', 'b'])[1])).toBe('No numbers yet');
    expect(numbersLine({ ...b, visitors: 0 })).toBe('No visitors yet');
    expect(numbersLine(versionRows(entry({ status: 'draft' }, null), ['a', 'b'])[1], undefined, 'draft')).toBe('Not started: no visitors yet');
  });
});

describe('bars, verdict colour and status tag', () => {
  it('scales each bar to the best conversion, 0 without numbers', () => {
    expect(barValues(versionRows(entry(), ['a', 'b']))).toEqual([74, 100]);
    expect(barValues(versionRows(undefined, ['a', 'b']))).toEqual([0, 0]);
  });

  it('colours the verdict and names the status with its phase', () => {
    expect(verdictIntent(entry({}, { verdict: 'likely-winner' }))).toBe('success');
    expect(verdictIntent(entry({}, { verdict: 'likely-loser' }))).toBe('warning');
    expect(verdictIntent(undefined)).toBe('muted');
    expect(statusTag(entry({ phase: 2 }))).toMatchObject({ label: 'Running · phase 2', intent: 'success' });
    expect(statusTag(entry({ status: 'draft' }, null)).label).toBe('Draft');
    expect(statusTag(undefined).label).toBe('Not set up');
    expect(statusTag(undefined, true)).toMatchObject({ label: 'No connection', intent: 'warning' });
  });
});

describe('what may be done', () => {
  it('accepts a started test, removes from a draft, running or paused one with more than one version', () => {
    expect(['draft', 'running', 'paused', 'stopped', 'concluded', 'archived'].map((s) => canAccept(s as never))).toEqual([false, true, true, true, false, false]);
    expect(canRemove('running', 2)).toBe(true);
    expect(canRemove('draft', 3)).toBe(true);
    expect(canRemove('running', 1)).toBe(false);
    expect(canRemove('stopped', 3)).toBe(false);
  });
});

describe('the test\'s lifecycle', () => {
  const statuses = ['draft', 'running', 'paused', 'stopped', 'concluded', 'archived'] as const;
  it('starts a draft or a paused test, pauses a running one, stops a running or paused one', () => {
    expect(statuses.map(canStart)).toEqual([true, false, true, false, false, false]);
    expect(statuses.map(canPause)).toEqual([false, true, false, false, false, false]);
    expect(statuses.map(canStop)).toEqual([false, true, true, false, false, false]);
  });

  it('says what Start, Resume, Pause and Stop do before they do it', () => {
    expect(lifecycleCopy('start', entry({ status: 'draft' }, null))).toMatchObject({
      title: 'Start “Hero: Qonsole input vs problem wizard”?',
      description: expect.stringContaining('split between “Qonsole input” and “Problem wizard”'),
      confirmLabel: 'Start the test',
    });
    expect(lifecycleCopy('start', entry({ status: 'paused' })).confirmLabel).toBe('Resume the test');
    expect(lifecycleCopy('pause', entry()).description).toMatch(/Everybody sees the original, “Qonsole input”/);
    expect(lifecycleCopy('stop', entry()).description).toMatch(/without a winner and cannot be started again/);
  });
});

describe('confirmCopy and outcomes', () => {
  it('says Accept ends the test for everybody', () => {
    expect(confirmCopy('accept', entry(), 'b')).toEqual({
      title: 'Make “Problem wizard” the winner?',
      description: expect.stringContaining('every visitor sees “Problem wizard”'),
      confirmLabel: 'Accept Problem wizard',
    });
  });

  it('warns that removing one of two versions accepts the other', () => {
    expect(confirmCopy('remove', entry(), 'a')).toMatchObject({
      title: 'Remove “Qonsole input”?',
      description: expect.stringContaining('Only “Problem wizard” would be left, so it becomes the winner'),
      confirmLabel: 'Remove and accept Problem wizard',
    });
  });

  it('says the count starts again when a version of three is removed', () => {
    const three = entry({ variants: [...entry().experiment.variants, { key: 'c', name: 'Short form', weight: 0.34 }] });
    expect(confirmCopy('remove', three, 'c').description).toMatch(/starts counting again/);
  });

  it('reports the winner after an accept or an auto-accept', () => {
    const concluded = { ...entry().experiment, status: 'concluded' as const, winner: 'b' };
    expect(actionOutcome('accept', concluded, 'b')).toBe('The test has ended: every visitor now sees “Problem wizard”.');
    expect(actionOutcome('remove', { ...concluded, auto_accepted: true }, 'a')).toBe('The test has ended: every visitor now sees “Problem wizard”.');
    expect(actionOutcome('remove', entry({ variants: entry().experiment.variants }).experiment, 'c')).toMatch(/goes on/);
    expect(winnerNote(entry({ status: 'concluded', winner: 'b' }), 'b')).toBe('Winner live: Problem wizard · code clean-up pending');
  });
});

describe('phaseNote', () => {
  it('explains a restarted count after a version was removed in the editor', () => {
    const e = entry({
      phase: 2,
      phases: [
        { phase: 1, started_at: '2026-09-20T08:00:00Z', ended_at: '2026-09-29T10:00:00Z', variants: [{ key: 'c', name: 'Short form', weight: 0.3 }] },
        { phase: 2, started_at: '2026-09-29T10:00:00Z', ended_at: null, variants: [] },
      ],
      history: [{ at: '2026-09-29T10:00:00Z', action: 'remove-variant', variant: 'c', actor: 'landing-editor' }],
    });
    expect(phaseNote(e, { 'landing-editor': 'in the editor' })).toBe('Counting since 29 Sept (phase 2): “Short form” was removed in the editor.');
    expect(phaseNote(e)).toBe('Counting since 29 Sept (phase 2): “Short form” was removed.');
    expect(phaseNote(entry())).toBeNull();
  });
});

describe('versionsMaxHeight: N versions', () => {
  const rowHeight = 60;
  const gap = 6;

  it('does not cap a list that fits (up to three rows)', () => {
    expect(versionsMaxHeight({ rows: 2, rowHeight, gap })).toBeNull();
    expect(versionsMaxHeight({ rows: 3, rowHeight, gap })).toBeNull();
  });

  it('caps at three and a half rows past that, so the half row says there is more', () => {
    expect(versionsMaxHeight({ rows: 4, rowHeight, gap })).toBe(3.5 * 60 + 3 * 6);
    expect(versionsMaxHeight({ rows: 12, rowHeight, gap })).toBe(228);
  });

  it('shrinks to the room the card has, never under one row', () => {
    expect(versionsMaxHeight({ rows: 5, rowHeight, gap, available: 150 })).toBe(150);
    expect(versionsMaxHeight({ rows: 5, rowHeight, gap, available: 20 })).toBe(60);
    // Two rows that do not fit a short card scroll too.
    expect(versionsMaxHeight({ rows: 2, rowHeight, gap, available: 100 })).toBe(100);
  });

  it('waits for a measured row', () => {
    expect(versionsMaxHeight({ rows: 5, rowHeight: 0, gap })).toBeNull();
  });
});

describe('the admin client', () => {
  const recorder = (status: number, body: unknown) => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const doFetch = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    };
    return { calls, doFetch };
  };
  const LIST = '/api/experiments?property=ide';

  it('lists from the list route, with the configured headers', async () => {
    const r = recorder(200, [entry()]);
    const client = createExperimentsAdminClient({ listUrl: LIST, headers: { Authorization: 'Bearer x' }, fetch: r.doFetch });
    await expect(client.list()).resolves.toHaveLength(1);
    expect(r.calls[0].url).toBe(LIST);
    expect(r.calls[0].init?.headers).toMatchObject({ Authorization: 'Bearer x', Accept: 'application/json' });
  });

  it('accepts a `{ experiments }` envelope too', async () => {
    const r = recorder(200, { experiments: [entry(), entry()] });
    await expect(createExperimentsAdminClient({ listUrl: LIST, fetch: r.doFetch }).list()).resolves.toHaveLength(2);
  });

  it('posts accept, remove-variant, start, pause, stop and a new draft next to the list route', async () => {
    const r = recorder(200, entry().experiment);
    const client = createExperimentsAdminClient({ listUrl: LIST, fetch: r.doFetch });
    await client.accept('hero-input', 'b');
    await client.remove('hero-input', 'a');
    await client.lifecycle('hero-input', 'start');
    await client.lifecycle('hero-input', 'pause');
    await client.lifecycle('hero-input', 'stop');
    await client.create({ key: 'cta-copy', name: 'CTA copy', property: 'ide', variants: [{ key: 'a', weight: 0.5, control: true }, { key: 'b', weight: 0.5 }], metrics: { primary: 'click' } });
    expect(r.calls.map((c) => [c.url, c.init?.method, c.init?.body])).toEqual([
      ['/api/experiments/hero-input/accept', 'POST', '{"variant":"b"}'],
      ['/api/experiments/hero-input/remove-variant', 'POST', '{"variant":"a"}'],
      ['/api/experiments/hero-input/start', 'POST', '{}'],
      ['/api/experiments/hero-input/pause', 'POST', '{}'],
      ['/api/experiments/hero-input/stop', 'POST', '{}'],
      ['/api/experiments', 'POST', expect.stringContaining('"property":"ide"')],
    ]);
  });

  it('builds action URLs the product way when it says so', async () => {
    const r = recorder(200, entry().experiment);
    const client = createExperimentsAdminClient({ listUrl: LIST, actionUrl: (key, action) => `/x/${action}?key=${key}`, fetch: r.doFetch });
    await client.accept('k', 'b');
    expect(r.calls[0].url).toBe('/x/accept?key=k');
  });

  it('explains a 401 / 403 as a missing or wrong key', async () => {
    const r = recorder(401, { err: 'unauthorized' });
    await expect(createExperimentsAdminClient({ listUrl: LIST, fetch: r.doFetch }).list()).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/key is missing or wrong/),
    });
  });

  it('turns a 409 into an error with the server’s code and words', async () => {
    const r = recorder(409, { err: 'last-variant', desc: '"hero-input" has only one version' });
    const err = await createExperimentsAdminClient({ listUrl: LIST, fetch: r.doFetch }).remove('hero-input', 'a').catch((e) => e);
    expect(err).toBeInstanceOf(ExperimentsAdminError);
    expect(err).toMatchObject({ status: 409, code: 'last-variant', message: '"hero-input" has only one version' });
  });
});

describe('order and the leader', () => {
  const five = entry(
    {
      variants: ['a', 'b', 'c', 'd'].map((key, i) => ({ key, name: `V${key}`, weight: 0.25, control: i === 0 })),
    },
    {
      metrics: [
        {
          key: 'goal',
          name: 'Goal',
          role: 'primary',
          variants: [
            { variant: 'a', exposed: 100, converters: 10, rate: 0.1, chance_to_beat: null },
            { variant: 'b', exposed: 100, converters: 15, rate: 0.15, chance_to_beat: 0.8 },
            { variant: 'c', exposed: 300, converters: 30, rate: 0.1, chance_to_beat: 0.5 },
          ],
        },
      ],
    }
  );

  it('sorts best conversion first, ties by visitors, versions without numbers last in their order', () => {
    expect(sortVersionRows(versionRows(five, [])).map((r) => r.key)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('marks the best-converting version as leading, and nobody on a tie or without numbers', () => {
    expect(leadingVersion(five, versionRows(five, []))).toEqual({ key: 'b', kind: 'leading' });
    const tie = versionRows(five, []).map((r) => (r.key === 'b' ? { ...r, conversion: 0.1 } : r));
    expect(leadingVersion(five, tie)).toBeNull();
    expect(leadingVersion(undefined, versionRows(undefined, ['a', 'b']))).toBeNull();
  });

  it('names a winner for a likely-winner verdict or an ended test', () => {
    const likely = entry({}, { verdict: 'likely-winner', winner_variant: 'b' });
    expect(leadingVersion(likely, versionRows(likely, []))).toEqual({ key: 'b', kind: 'winner' });
    const ended = entry({ status: 'concluded', winner: 'a' });
    expect(leadingVersion(ended, versionRows(ended, []))).toEqual({ key: 'a', kind: 'winner' });
  });
});

describe('the help', () => {
  it('explains the buttons, the split, the numbers, the too-early rule and a test that is not set up', () => {
    const text = JSON.stringify(helpSections(entry({ min_sample: { per_variant: 500, days: 14 }, traffic: 0.5 })));
    expect(text).toMatch(/Accept ends the test/);
    expect(text).toMatch(/Remove \(the bin icon\)/);
    expect(text).toMatch(/Pause shows everyone the original/);
    expect(text).toMatch(/50% of the visitors who allow analytics/);
    expect(text).toMatch(/Chance to beat the original/);
    expect(text).toMatch(/at least 500 visitors and 14 days/);
    expect(text).toMatch(/Not set up yet/);
    expect(JSON.stringify(helpSections(undefined))).toMatch(/at least 200 visitors and 7 days/);
  });
});
