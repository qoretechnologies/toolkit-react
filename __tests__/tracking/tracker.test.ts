import { describe, expect, it } from 'vitest';
import { createMemoryTracker } from '../../src/tracking/testing';
import { ExperimentStore } from '../../src/tracking/core/experiments';
import { KEYS, resolveConfig, type IExperimentDefinition, type ITrackedEvent } from '../../src/tracking/core/types';

const HERO: IExperimentDefinition = {
  key: 'hero-input',
  variants: [
    { key: 'a', weight: 0.5, control: true },
    { key: 'b', weight: 0.5 },
  ],
  traffic: 1,
  targeting: { paths: ['/'] },
  trigger: { section: 'hero' },
};

const events = (m: ReturnType<typeof createMemoryTracker>): ITrackedEvent[] => m.sent.flatMap((s) => s.batch.events);
const types = (m: ReturnType<typeof createMemoryTracker>) => events(m).map((e) => e.type);

describe('consent gating', () => {
  it('sends nothing and creates no id before consent', async () => {
    const m = createMemoryTracker();
    m.tracker.start();
    m.tracker.goal('signup-started');
    m.tracker.custom('hero-submitted');
    m.tracker.heartbeat();
    m.tracker.leave();
    await m.advance(60_000);
    expect(m.sent).toEqual([]);
    expect(m.local.get(KEYS.vid)).toBeNull();
    expect(m.session.get(KEYS.sid)).toBeNull();
    expect(m.tracker.decide('hero-input')).toMatchObject({ variant: 'a', enrolled: false, reason: 'no-consent' });
  });

  it('starts a page view on "Allow" and sends batches with vid, sid and property', async () => {
    const m = createMemoryTracker({ page: { search: '?utm_source=linkedin&utm_campaign=launch' } });
    m.tracker.start();
    m.tracker.grant();
    expect(m.local.get(KEYS.consent)).toBe('granted');
    expect(m.local.get(KEYS.consentVersion)).toBe('1');
    const vid = m.local.get(KEYS.vid);
    expect(vid).toMatch(/^[A-Za-z0-9_-]{22}$/);
    await m.advance(5000);
    const [batch] = m.sent.map((s) => s.batch);
    expect(batch).toMatchObject({ v: 1, property: 'test', vid, consent: 'granted' });
    expect(batch.sid).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(batch.events[0]).toMatchObject({
      type: 'pageview',
      path: '/',
      props: { title: 'Example', utm: { source: 'linkedin', campaign: 'launch' }, viewport: [1440, 900], lang: 'en-US' },
    });
    expect(batch.events[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('on "No, thanks" (or withdrawing) deletes the id, drops the queue and stops', async () => {
    const m = createMemoryTracker({ consent: 'granted' });
    m.tracker.start();
    m.tracker.custom('x');
    m.tracker.deny();
    expect(m.local.get(KEYS.vid)).toBeNull();
    expect(m.local.get(KEYS.consent)).toBe('denied');
    m.tracker.custom('y');
    await m.advance(60_000);
    expect(m.sent).toEqual([]);
  });

  it('asks again when the consent text version was bumped', () => {
    const answeredV1 = { [KEYS.consent]: 'granted', [KEYS.consentVersion]: '1' };
    expect(createMemoryTracker({ seed: answeredV1 }).tracker.consent.get()).toBe('granted');
    expect(createMemoryTracker({ seed: answeredV1, config: { consentVersion: 2 } }).tracker.consent.get()).toBe('unknown');
  });

  it('sends nothing at all when disabled', async () => {
    const m = createMemoryTracker({ consent: 'granted', config: { enabled: false } });
    m.tracker.start();
    m.tracker.goal('x');
    await m.advance(60_000);
    expect(m.sent).toEqual([]);
  });
});

describe('page views and summaries', () => {
  it('closes the page view with a summary on route change and starts a new one', async () => {
    const m = createMemoryTracker({ consent: 'granted' });
    m.tracker.start();
    m.tracker.sections.update('hero', 1, m.now());
    await m.advance(3000);
    m.tracker.activity();
    m.tracker.scrolled(42);
    m.page.path = '/pricing';
    m.tracker.pageview();
    await m.advance(5000);
    const evs = events(m);
    expect(evs.map((e) => [e.type, e.path])).toEqual([
      ['pageview', '/'],
      ['page_summary', '/'],
      ['pageview', '/pricing'],
    ]);
    expect(evs[0].pv_id).toBe(evs[1].pv_id);
    expect(evs[2].pv_id).not.toBe(evs[0].pv_id);
    expect(evs[1].props).toMatchObject({
      duration_ms: 3000,
      max_scroll_pct: 42,
      exit_section: 'hero',
      sections: [{ id: 'hero', visible_ms: 3000, seen: true, first_seen_ms: 0 }],
      seq: 1,
      final: true,
    });
    expect(evs[2].props).toMatchObject({ referrer: 'https://example.com/' });
  });

  it('sends a cumulative summary and a beacon when the tab is hidden', async () => {
    const m = createMemoryTracker({ consent: 'granted' });
    m.tracker.start();
    await m.advance(2000);
    m.tracker.setTabVisible(false);
    await m.advance(0);
    expect(m.sent[m.sent.length - 1]?.mode).toBe('beacon');
    expect(types(m)).toEqual(['pageview', 'page_summary']);
    expect(events(m)[1].props).toMatchObject({ duration_ms: 2000, final: false, seq: 1 });
  });

  it('starts a new session after 30 minutes without events', async () => {
    const m = createMemoryTracker({ consent: 'granted' });
    m.tracker.start();
    await m.advance(5000);
    m.tracker.custom('later');
    await m.advance(31 * 60 * 1000);
    m.tracker.custom('much-later');
    await m.advance(5000);
    const sids = m.sent.map((s) => s.batch.sid);
    expect(sids[0]).not.toBe(sids[sids.length - 1]);
  });

  it('shapes goal, custom and click events as the contract says', async () => {
    const m = createMemoryTracker({ consent: 'granted' });
    m.tracker.start();
    m.tracker.goal('signup-started');
    m.tracker.goal('revenue', 12);
    m.tracker.custom('wizard-problem-picked', { problem: 'late-deliveries' });
    m.tracker.click({ target: 'get-started', placement: 'hero', label: 'Design it', href: null });
    await m.advance(5000);
    expect(events(m).slice(1).map((e) => [e.type, e.props])).toEqual([
      ['goal', { goal: 'signup-started' }],
      ['goal', { goal: 'revenue', value: 12 }],
      ['custom', { name: 'wizard-problem-picked', problem: 'late-deliveries' }],
      ['click', { target: 'get-started', placement: 'hero', label: 'Design it', href: null }],
    ]);
  });
});

describe('experiments', () => {
  const ready = async (m: ReturnType<typeof createMemoryTracker>) => {
    m.tracker.start();
    await m.advance(0);
  };

  it('assigns from the vid once definitions are loaded', async () => {
    const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-1', experiments: [HERO] });
    await ready(m);
    expect(m.tracker.decide('hero-input')).toMatchObject({ variant: 'b', enrolled: true, trigger: 'hero' });
  });

  it('serves the control when the experiments endpoint is missing', async () => {
    const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-1', experiments: 'fail' });
    await ready(m);
    expect(m.tracker.experiments.status.get()).toBe('failed');
    expect(m.tracker.decide('hero-input')).toMatchObject({ variant: 'a', enrolled: false, reason: 'not-running' });
  });

  it('logs the exposure once per page view, when the trigger section is seen', async () => {
    const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-1', experiments: [HERO] });
    await ready(m);
    const a = m.tracker.decide('hero-input');
    m.tracker.watchExposure(a);
    m.tracker.sections.update('hero', 0.3, m.now());
    await m.advance(2000);
    m.tracker.sections.tick(m.now());
    expect(types(m).filter((t) => t === 'exposure')).toHaveLength(0);
    m.tracker.sections.update('hero', 0.7, m.now());
    await m.advance(1000);
    m.tracker.sections.tick(m.now());
    m.tracker.sections.update('hero', 0.1, m.now());
    m.tracker.sections.update('hero', 0.9, m.now());
    await m.advance(1500);
    m.tracker.sections.tick(m.now());
    await m.advance(5000);
    const exposures = events(m).filter((e) => e.type === 'exposure');
    expect(exposures.map((e) => e.props)).toEqual([{ experiment: 'hero-input', variant: 'b', trigger: 'view' }]);
    // A new page view that sees the hero again logs it again.
    m.page.search = '?again';
    m.tracker.pageview();
    m.tracker.sections.update('hero', 1, m.now());
    await m.advance(1000);
    m.tracker.sections.tick(m.now());
    await m.advance(5000);
    expect(events(m).filter((e) => e.type === 'exposure')).toHaveLength(2);
  });

  it('logs render-triggered exposures at once', async () => {
    const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-1', experiments: [{ ...HERO, trigger: null }] });
    await ready(m);
    m.tracker.watchExposure(m.tracker.decide('hero-input'));
    await m.advance(5000);
    expect(events(m).find((e) => e.type === 'exposure')?.props).toEqual({ experiment: 'hero-input', variant: 'b', trigger: 'render' });
  });

  it('never logs a preview (?qa_variant=) and keeps it for the session', async () => {
    const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-2', experiments: [HERO], page: { search: '?qa_variant=hero-input:b' } });
    await ready(m);
    const a = m.tracker.decide('hero-input');
    expect(a).toMatchObject({ variant: 'b', enrolled: false, reason: 'preview' });
    m.tracker.watchExposure(a);
    m.tracker.sections.update('hero', 1, m.now());
    await m.advance(2000);
    m.tracker.sections.tick(m.now());
    await m.advance(5000);
    expect(types(m)).not.toContain('exposure');
    expect(JSON.parse(m.session.get(KEYS.preview) ?? '{}')).toEqual({ 'hero-input': 'b' });
  });

  it('previews without consent too', () => {
    const m = createMemoryTracker({ page: { search: '?qa_variant=hero-input:b' } });
    expect(m.tracker.decide('hero-input')).toMatchObject({ variant: 'b', reason: 'preview' });
  });
});

describe('sign-up link decoration', () => {
  const URL_IN = 'https://app.example.com/signup?intent=signup';

  it('adds qa_exp for exposed experiments and the first-touch utm, never the vid', async () => {
    const m = createMemoryTracker({ vid: 'visitor-1', experiments: [HERO], page: { search: '?utm_source=linkedin&utm_medium=social&utm_campaign=launch' } });
    m.tracker.start();
    m.tracker.grant();
    await m.advance(0);
    m.page.search = '';
    m.tracker.watchExposure(m.tracker.decide('hero-input'));
    m.tracker.sections.update('hero', 1, m.now());
    await m.advance(1000);
    m.tracker.sections.tick(m.now());
    const out = new URL(m.tracker.decorateSignupUrl(URL_IN));
    expect(out.searchParams.get('qa_exp')).toBe('hero-input:b');
    expect(out.searchParams.get('utm_source')).toBe('linkedin');
    expect(out.searchParams.get('utm_medium')).toBe('social');
    expect(out.searchParams.get('utm_campaign')).toBe('launch');
    expect(out.searchParams.get('intent')).toBe('signup');
    expect(out.toString()).not.toContain(m.local.get(KEYS.vid) as string);
    expect([...out.searchParams.keys()].sort()).toEqual(['intent', 'qa_exp', 'utm_campaign', 'utm_medium', 'utm_source']);
  });

  it('leaves the link alone without consent', () => {
    const m = createMemoryTracker({ page: { search: '?utm_source=linkedin' } });
    expect(m.tracker.decorateSignupUrl(URL_IN)).toBe(URL_IN);
  });
});

describe('concluded experiments and the editor switch', () => {
  const CONCLUDED = { key: 'hero-input', status: 'concluded', winner: 'b' } as unknown as IExperimentDefinition;

  it('shows the winner to everybody, with or without consent, and logs no exposure', async () => {
    for (const consent of [undefined, 'granted', 'denied'] as const) {
      const m = createMemoryTracker({ consent, vid: 'visitor-2', experiments: [CONCLUDED], page: { search: '?qa_variant=hero-input:a' } });
      m.tracker.start();
      await m.advance(0);
      const a = m.tracker.decide('hero-input');
      expect(a).toMatchObject({ variant: 'b', enrolled: false, reason: 'concluded' });
      m.tracker.watchExposure(a);
      m.tracker.sections.update('hero', 1, m.now());
      await m.advance(2000);
      m.tracker.sections.tick(m.now());
      await m.advance(5000);
      expect(types(m)).not.toContain('exposure');
    }
  });

  it('ignores a concluded entry without a winner, and unknown statuses', async () => {
    const m = createMemoryTracker({
      consent: 'granted',
      vid: 'visitor-1',
      experiments: [{ key: 'x', status: 'concluded' } as unknown as IExperimentDefinition, { ...HERO, key: 'y', status: 'paused' }],
    });
    m.tracker.start();
    await m.advance(0);
    expect(m.tracker.experiments.get('x')).toBeUndefined();
    expect(m.tracker.experiments.get('y')).toBeUndefined();
  });

  it('applies the editor switch per experiment, keeps it in localStorage and never logs it', async () => {
    const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-1', experiments: [HERO, { ...HERO, key: 'other' }] });
    m.tracker.start();
    await m.advance(0);
    let changes = 0;
    m.tracker.experiments.editorOverrides.subscribe(() => changes++);
    m.tracker.experiments.setEditorOverride('hero-input', 'a');
    expect(changes).toBe(1);
    expect(JSON.parse(m.local.get(KEYS.editorVariants) ?? '{}')).toEqual({ 'hero-input': 'a' });
    const switched = m.tracker.decide('hero-input');
    expect(switched).toMatchObject({ variant: 'a', enrolled: false, reason: 'preview' });
    expect(m.tracker.decide('other')).toMatchObject({ enrolled: true, reason: 'assigned' });
    m.tracker.watchExposure(switched);
    m.tracker.sections.update('hero', 1, m.now());
    await m.advance(2000);
    m.tracker.sections.tick(m.now());
    await m.advance(5000);
    expect(types(m)).not.toContain('exposure');
    m.tracker.experiments.setEditorOverride('hero-input', null);
    expect(m.local.get(KEYS.editorVariants)).toBeNull();
    expect(m.tracker.decide('hero-input')).toMatchObject({ variant: 'b', reason: 'assigned' });
  });

  it('refresh() reloads the definitions and bumps the revision', async () => {
    const list: IExperimentDefinition[] = [HERO];
    const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-1', experiments: list });
    m.tracker.start();
    await m.advance(0);
    list[0] = CONCLUDED;
    const before = m.tracker.experiments.revision.get();
    await m.tracker.experiments.refresh();
    expect(m.tracker.experiments.revision.get()).toBe(before + 1);
    expect(m.tracker.decide('hero-input')).toMatchObject({ variant: 'b', reason: 'concluded' });
  });
});

describe('product config', () => {
  it('sends the configured property in every batch', async () => {
    const m = createMemoryTracker({ consent: 'granted', config: { property: 'ide' } });
    m.tracker.start();
    await m.advance(5000);
    expect(m.sent[0].batch.property).toBe('ide');
  });

  it('keeps two products on one origin apart with their storage prefixes', () => {
    // The first product (default prefix `qa.`) was answered; the second one has its own prefix.
    const seed = { [KEYS.consent]: 'granted', [KEYS.consentVersion]: '1', [KEYS.vid]: 'first-product-vid' };
    const m = createMemoryTracker({ seed, config: { property: 'two', storagePrefix: 'qa.two.' } });
    expect(m.keys.consent).toBe('qa.two.consent');
    expect(m.tracker.consent.get()).toBe('unknown');
    m.tracker.grant();
    expect(m.local.get('qa.two.consent')).toBe('granted');
    expect(m.local.get('qa.two.vid')).toMatch(/^[A-Za-z0-9_-]{22}$/);
    m.tracker.deny();
    expect(m.local.get('qa.two.vid')).toBeNull();
    expect(m.local.get(KEYS.vid)).toBe('first-product-vid');
    expect(m.local.get(KEYS.consent)).toBe('granted');
    expect(createMemoryTracker().tracker.keys).toEqual(KEYS);
  });

  it('reads previews from the configured query parameter', () => {
    const m = createMemoryTracker({
      config: { previewParam: 'ide_variant', storagePrefix: 'ide.' },
      page: { search: '?ide_variant=hero-input:b&qa_variant=other:b' },
    });
    expect(m.tracker.decide('hero-input')).toMatchObject({ variant: 'b', reason: 'preview' });
    expect(m.tracker.decide('other')).toMatchObject({ variant: 'a', reason: 'no-consent' });
    expect(JSON.parse(m.session.get('ide.preview') ?? '{}')).toEqual({ 'hero-input': 'b' });
  });

  it('fetches the experiments for its property from its endpoint', async () => {
    const urls: string[] = [];
    const m = createMemoryTracker({ config: { property: 'admin', experimentsEndpoint: '/api/experiments?x=1' } });
    const store = new ExperimentStore({
      property: m.tracker.config.property,
      endpoint: m.tracker.config.experimentsEndpoint,
      local: m.local,
      session: m.session,
      now: m.now,
      fetchJson: async (url) => {
        urls.push(url);
        return [];
      },
    });
    await store.load();
    expect(urls).toEqual(['/api/experiments?x=1&property=admin']);
  });

  it('fills the defaults, and an undefined option keeps its default', () => {
    const config = resolveConfig({ property: 'p', endpoint: '/c', experimentsEndpoint: '/e', debug: undefined });
    expect(config).toMatchObject({ property: 'p', debug: false, storagePrefix: 'qa.', previewParam: 'qa_variant', consentVersion: 1 });
  });
});
