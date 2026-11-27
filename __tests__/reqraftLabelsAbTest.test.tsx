// Copyright 2026 Qore Technologies, s.r.o.
/* The A/B test card says a host's words: its sentences, its tags and buttons, the confirm step, the help and the admin
 * client's errors, and says others when the language changes. With nothing given it says the English it always did. */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reqraftLabels, setReqraftLabels } from '../src/helpers/reqraftLabels';
import {
  confirmCopy,
  helpSections,
  numbersLine,
  statusTag,
  verdictLine,
  versionRows,
  winnerNote,
} from '../src/tracking/ui/card';
import { createExperimentsAdminClient } from '../src/tracking/ui/client';
import { ExperimentCard } from '../src/tracking/ui/ExperimentCard';
import type { IExperimentEntry, TExperimentStatus } from '../src/tracking/ui/types';

afterEach(() => {
  setReqraftLabels();
});

const entry = (status: TExperimentStatus = 'running', phase = 1): IExperimentEntry => ({
  experiment: {
    key: 'hero',
    name: 'Hero copy',
    status,
    phase,
    variants: [
      { key: 'a', name: 'Short', weight: 0.5, control: true },
      { key: 'b', name: 'Long', weight: 0.5 },
    ],
  },
  results: {
    verdict: 'too-early',
    metrics: [
      {
        key: 'signup',
        name: 'Signed up',
        role: 'primary',
        variants: [
          { variant: 'a', exposed: 1228, converters: 100, rate: 0.0814, chance_to_beat: null },
          { variant: 'b', exposed: 1, converters: 0, rate: 0, chance_to_beat: 0.4 },
        ],
      },
    ],
  },
});

const card = () =>
  render(
    <ReqoreUIProvider>
      <ExperimentCard experimentKey='hero' test={entry()} onAccept={vi.fn()} onStop={vi.fn()} />
    </ReqoreUIProvider>
  );

describe('the A/B test words', () => {
  it('are the English they always were when a host gives nothing', () => {
    const rows = versionRows(entry());
    expect(verdictLine(entry())).toBe('Too early to tell.');
    expect(verdictLine(undefined)).toMatch(/^This test is in the page's code but isn't set up yet/);
    expect(statusTag(entry('running', 2)).label).toBe('Running · phase 2');
    expect(confirmCopy('accept', entry(), 'b').confirmLabel).toBe('Accept Long');
    expect(numbersLine(rows[0], 'Signed up')).toBe('1,228 visitors · 8.1% “Signed up”');
    // one visitor is one, not "1 visitors"
    expect(numbersLine(rows[1], 'Signed up')).toBe(
      '1 visitor · 0% “Signed up” · 40% chance to beat the original'
    );
    expect(winnerNote(undefined, 'b')).toBe('Winner live: Version B · code clean-up pending');
    expect(JSON.stringify(helpSections(undefined))).toMatch(/at least 200 visitors and 7 days have passed/);
  });

  it('are the host’s where it gives them, and English where it does not', () => {
    setReqraftLabels({
      abTest: {
        verdictTooEarly: 'Noch zu früh.',
        statuses: { running: 'Läuft' },
        statusInPhase: (status, phase) => `${status} · Phase ${phase}`,
        acceptConfirm: (name) => `${name} übernehmen`,
        visitorCount: (count, shown) => `${shown} ${count === 1 ? 'Besucher' : 'Besucher:innen'}`,
        versionName: (key) => `Variante ${key}`,
        winnerLive: (name) => `Gewinner live: ${name}`,
        helpTrustTitle: 'Wann das Ergebnis zählt',
        helpTooEarly: (visitors, days) => `Mindestens ${visitors} Besucher:innen und ${days} Tage.`,
      },
    });
    const rows = versionRows(entry());

    expect(verdictLine(entry())).toBe('Noch zu früh.');
    expect(statusTag(entry('running', 2)).label).toBe('Läuft · Phase 2');
    // a map is given entry by entry: the other statuses stay English
    expect(statusTag(entry('paused')).label).toBe('Paused');
    expect(confirmCopy('accept', entry(), 'b').confirmLabel).toBe('Long übernehmen');
    expect(numbersLine(rows[0], 'Signed up')).toBe('1,228 Besucher:innen · 8.1% “Signed up”');
    expect(winnerNote(undefined, 'b')).toBe('Gewinner live: Variante B');
    expect(versionRows(undefined, ['a'])[0].name).toBe('Variante A');

    const help = helpSections(entry());
    expect(help.find((section) => section.title === 'Wann das Ergebnis zählt')?.paragraphs[0]).toBe(
      'Mindestens 200 Besucher:innen und 7 Tage.'
    );
    // a card's own words come before the host's
    expect(verdictLine(undefined, { notSetUpText: 'Ask ops.' })).toBe('Ask ops.');
  });

  it('reach the admin client’s errors, read when the error happens', async () => {
    const client = (status: number, body: unknown) =>
      createExperimentsAdminClient({
        listUrl: '/api/experiments',
        fetch: async () => new Response(JSON.stringify(body), { status }),
      });

    await expect(client(403, {}).list()).rejects.toMatchObject({
      message: reqraftLabels().abTest.notAllowed,
    });

    setReqraftLabels({
      abTest: {
        notAllowed: 'Keine Berechtigung für A/B-Tests.',
        requestFailed: (status) => `Fehler ${status}`,
      },
    });
    await expect(client(401, {}).list()).rejects.toMatchObject({
      message: 'Keine Berechtigung für A/B-Tests.',
    });
    await expect(client(500, {}).list()).rejects.toMatchObject({ message: 'Fehler 500' });
  });
});

describe('the A/B test card', () => {
  it('says the English it always did when a host gives nothing', async () => {
    card();
    await waitFor(() => expect(document.body.textContent).toContain('Too early to tell.'));
    expect(document.body.textContent).toContain('2 versions · goal: “Signed up”');
    expect(document.body.textContent).toContain('Accept');
  });

  it('says a host’s words, and again when the language changes', async () => {
    setReqraftLabels({
      abTest: { verdictTooEarly: 'Noch zu früh.', versionsLine: (count) => `${count} Varianten` },
    });
    card();
    await waitFor(() => expect(document.body.textContent).toContain('Noch zu früh.'));
    expect(document.body.textContent).toContain('2 Varianten');

    act(() =>
      setReqraftLabels({ abTest: { verdictTooEarly: 'Trop tôt.', accept: 'Retenir', stop: 'Arrêter' } })
    );
    await waitFor(() => expect(document.body.textContent).toContain('Trop tôt.'));
    expect(document.body.textContent).not.toContain('Noch zu früh.');
    expect(document.body.textContent).toContain('Retenir');
    expect(document.body.textContent).toContain('Arrêter');
    // what the host no longer gives is English again
    expect(document.body.textContent).toContain('2 versions · goal: “Signed up”');
  });
});
