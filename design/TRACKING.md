# Tracking, consent and A/B testing

First-party analytics, a consent gate and client-side A/B testing for any Qore web app (the
landing site, the Qorus IDE, the admin portal). One module, one server: every product sends to
the same collector and reads the same experiments, and **the server keeps each product's data
separate by `property`**: events, goals, experiments and results never mix between properties.

The contract (event shapes, the batch envelope, experiment definitions, goals, statistics,
storage, the admin API) is owned by qorus-api:
[`design/analytics-and-experiments-design.md`](https://git.qoretechnologies.com/qorus/qorus-api/-/blob/develop/design/analytics-and-experiments-design.md)
(introduced in [qorus-api MR !34](https://git.qoretechnologies.com/qorus/qorus-api/-/merge_requests/34)).
Change the contract there first, then the code here. Section numbers below (§3, §5 …) refer to it.

## 1. What it does

- **Anonymous, with consent.** Nothing is sent and no id exists until the user allows tracking.
  Then a random visitor id (`vid`) lives in `localStorage["<prefix>vid"]`. Declining or
  withdrawing deletes it and stops everything.
- **Events** go in batches to the collector: page views, a page summary (time, engaged time,
  scroll depth, per-section attention), clicks on tagged elements, a heartbeat, goals, custom
  events and experiment exposures.
- **Experiments** are fetched from the experiments endpoint (`?property=<property>` appended)
  and every visitor is assigned locally with GrowthBook's hash v2 on the `vid`, the same way on
  every visit and every page.
- **Fails open.** No backend, no consent, blocked storage, an error anywhere: the app works as
  without the module, every experiment shows its control, and nothing is thrown into the page.

## 2. Install and import

```bash
yarn add @qoretechnologies/reqraft
```

Everything is exported from the package root, and from its own entry, which loads nothing else
from Reqraft (no Reqore, react-query or editors; React is its only dependency). Prefer the entry
in an app that does not already use Reqraft:

```ts
import { createBrowserTracker, TrackingProvider, Experiment } from '@qoretechnologies/reqraft/dist/tracking';
// or
import { createBrowserTracker, TrackingProvider, Experiment } from '@qoretechnologies/reqraft';
```

The module has three layers, and each only imports the ones above it:

| Layer | Folder | What |
|---|---|---|
| core | `src/tracking/core/` | plain TypeScript, no DOM: `Tracker`, consent, the batching queue, section and engagement clocks, hashing, assignment, the experiments client |
| browser | `src/tracking/browser/` | the only code that touches `window` / `document`: transport (`sendBeacon` → `fetch` keepalive), storage, listeners, `IntersectionObserver` on sections, delegated clicks |
| react | `src/tracking/react/` | `<TrackingProvider>`, `useTracker`, `useConsent`, `useExperiment`, `<Experiment>` |

Plus `markup.ts` (`trackClick`, `trackSection`) and `testing.ts` (`createMemoryTracker`). The A/B test UI (the card and the overlay, on Reqore) is a fourth layer, `src/tracking/ui/`, with its own entry (§8); the engine never imports it.

## 3. Configure one tracker per app

Create the tracker once, at module level, and mount the provider at the app shell:

```tsx
import { createBrowserTracker, TrackingProvider } from '@qoretechnologies/reqraft/dist/tracking';

export const tracking = createBrowserTracker({
  property: 'ide',                                  // required: which product the data belongs to
  endpoint: '/qorus-cloud/collect',                 // required: the collector (POST)
  experimentsEndpoint: '/qorus-cloud/experiments',  // required: running experiments (GET)
  storagePrefix: 'qa.ide.',                         // when another product shares the origin
  consentVersion: 1,
  enabled: import.meta.env.PROD,
  debug: false,
});

const App = () => {
  const location = useLocation();
  return (
    <TrackingProvider tracker={tracking.tracker} attach={tracking.attach} location={location.pathname + location.search}>
      <Routes>…</Routes>
    </TrackingProvider>
  );
};
```

Each `location` change is a new page view. Without a provider (or with `tracker={null}`),
everything still renders: consent reads `unknown` and experiments show their control.

| Option | Default | Meaning |
|---|---|---|
| `property` | required | The product (`landing`, `ide`, `admin`, …). Sent with every batch and with the experiments request; the server keeps each property's data apart. |
| `endpoint` | required | Collector URL. Same origin in the products so far. |
| `experimentsEndpoint` | required | Running-experiments URL; `?property=` is appended. |
| `enabled` | `true` | `false`: nothing is ever sent and every experiment shows its control. Turn it off where a page view is not a visit (a preview iframe, a test build). |
| `consentVersion` | `1` | Bump when the consent text changes materially: stored answers to older versions count as no answer, so the prompt asks again. |
| `storagePrefix` | `qa.` | Prefix of every storage key. **Two products on one origin need different prefixes**, or they share one consent answer, one visitor id and one experiments cache. |
| `previewParam` | `qa_variant` | Query parameter of a shareable preview link. |
| `debug` | `false` | Log every batch (and every swallowed error) to the console. |
| `flushIntervalMs`, `maxQueued`, `heartbeatMs`, `sessionTimeoutMs`, `engagedWindowMs` | 5 s, 20, 15 s, 30 min, 10 s | Batching and timing. |

`resolveConfig(options)` gives the full config; `DEFAULT_CONFIG` holds the defaults.

## 4. Consent

```tsx
const { state, grant, deny, available } = useConsent(); // state: 'unknown' | 'granted' | 'denied'
```

- Stored in `localStorage["<prefix>consent"]` (`granted` | `denied`) and `<prefix>consent.v`
  (the version answered).
- Before `granted`: no id, no request to the collector, controls only, sign-up links
  undecorated. The experiments list is still fetched: it is public and carries no visitor data.
- `deny()` (declining or withdrawing) deletes `vid`, `exp`, `sid` and `utm` and drops unsent events.
- The consent prompt is the app's own UI. `openConsentSettings()` / `closeConsentSettings()` /
  `useConsentPanelOpen()` let a "Cookie settings" link reopen it.

## 5. Experiments

Wrap what is being tested:

```tsx
<Experiment id='signup-cta' trigger='pricing' variants={{ a: <Current />, b: <New /> }} />
```

or, for logic rather than markup:

```tsx
const { variant, assignment, triggerRef } = useExperiment('signup-cta', { variants: ['a', 'b'] });
```

- `a` is the control unless `control="…"` says otherwise; the control must be today's behaviour.
- **The variant is decided once when the component mounts** and kept for the page view: no
  flicker. A consent or definition that arrives later applies from the next page view.
- **Exposure** is logged once per page view, only for enrolled visitors, when the trigger is
  seen: the definition's `trigger.section`, else the `trigger` prop, else the element you put
  `triggerRef` on, else at render.
- Visitors without consent, outside `traffic`, or not targeted see the control and log nothing.
  A concluded experiment shows its winner to everybody and logs nothing.
- Order of `tracker.decide()`: a concluded winner, then the in-app switch or a preview link, then
  consent, the definition and the assignment. `assignment.reason` says which one decided.
- `<Experiment>` wraps its output in a `display: contents` element (no box, so the layout is
  unchanged) with `data-experiment`, `data-variant`, `data-variants` and
  `data-experiment-reason`, so an editor overlay can find every test on the page.
- **Preview link:** `?qa_variant=signup-cta:b` (several: `?qa_variant=a-test:b,other:a`) shows a
  version for QA, sticks for the browser session, works without consent and is never logged.
  `?qa_variant=clear` removes it.
- **In-app switch** (for an editor): `tracker.experiments.setEditorOverride(key, variant | null)`
  shows one version in this browser, live and never logged; `tracker.experiments.refresh()`
  reloads the definitions and makes mounted experiments decide again.

Assignment (§5.2): `n = fnv1a32(String(fnv1a32(key + vid))) % 10000 / 10000`; variant *i* owns
`[c_i, c_i + traffic × w_i)` where `c_i` is the sum of the weights before it. Raising `traffic`
never moves an enrolled visitor. Fixed vectors: `__tests__/tracking/hash.test.ts`; if one of them
changes, every visitor's assignment changes.

The experiment itself (key, variants, weights, traffic, targeting, trigger, metrics) is created
and started through the admin API (§9); until it runs, everybody sees the control.

## 6. Events, goals and markup

```ts
const tracker = useTracker();                   // null outside the provider: always use ?.
tracker?.goal('contact-submitted');             // a conversion the server's goals can match
tracker?.goal('demo-booked', 1);                // with a value
tracker?.custom('plan-picked', { plan: 'pro' }); // a named event with props
```

Never put free text a user typed, emails or names in props.

**Sections** (visible time, "seen", exit section) and **clicks** are tagged in markup; one
`IntersectionObserver` and one delegated click listener pick them up:

```tsx
<section data-track-section='pricing'>…</section>
<ReqoreButton data-track-click='get-started' data-track-placement='hero'>Get started</ReqoreButton>
// where JSX attributes cannot be written (object-literal props, e.g. panel actions):
<ReqorePanel actions={[{ ...trackClick('contact', 'pricing-panel'), label: 'Talk to us' }]} />
<div {...trackSection('pricing')}>…</div>
```

- `data-track-click` is what the click means (`get-started`, `contact`, …);
  `data-track-placement` is where (defaults to the enclosing section's id);
  `data-track-label` overrides the label (defaults to the element's text).
- "Seen" is at least 50 % of the section, or 50 % of the screen covered by it, for at least one
  second in one stretch, with the tab visible. Reports key on section ids: keep them stable.

**Sign-up attribution** (§5.4): `tracker.decorateSignupUrl(url)` adds
`qa_exp=<experiment>:<variant>,…` and the session's first-touch `utm_*` to a sign-up link (with
consent only, never the `vid`); the server's sign-up flow reads them.

## 7. Tests and stories

`createMemoryTracker(options)` is a tracker with no browser behind it: memory storage, a clock
and timers you drive, and a transport that records every batch.

```ts
import { createMemoryTracker } from '@qoretechnologies/reqraft/dist/tracking';

const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-1', experiments: [definition] });
m.tracker.start();
await m.advance(5000);                      // runs due timers: the queue flushes
m.sent[0].batch.events;                     // what reached the collector
m.local.get(m.keys.vid);                    // storage, under the configured prefix
```

Options: `config` (any config field; `property` defaults to `test`), `consent`, `experiments`
(a list, a function read on every load, or `'fail'`), `page` (path, search, device, …), `vid`,
`start` (the clock), `seed` (localStorage before the tracker starts). In a story, pass
`m.tracker` to `<TrackingProvider>` without `attach`; seed the experiments cache
(`KEYS.experimentsCache`) so the first render already has the definitions — see
`src/tracking/ui/ExperimentsOverlay.stories.tsx`.

Unit tests: `__tests__/tracking/` (hashing vectors, assignment, consent gating, batching,
sections, page views, sign-up links, concluded winners, the in-app switch, product config,
the React bindings, and the layer rules).

## 8. The A/B test UI: embed the overlay

The same A/B test controls every product shows, built on Reqore, in their own entry so the engine
stays light:

```ts
import { ExperimentsOverlay, ExperimentCard, useExperimentsAdmin } from '@qoretechnologies/reqraft/dist/tracking/ui';
```

| Export | What |
|---|---|
| `<ExperimentsOverlay>` | Finds every `<Experiment>` on the page (its `data-experiment` marker) and draws a dashed outline and an "A/B test · <name>" handle at its corner. Hover, keyboard focus or a click opens the test's card, anchored to the element: it scrolls and resizes with it and flips above or below the handle to stay in view. ✕, Esc and a click outside close it. An ended test shows "Winner live · code clean-up pending" instead. |
| `<ExperimentCard>` | One test: name, status tag, a "?" help and ✕; the verdict; one row per version, best first (conversion on the primary metric, then visitors; re-sorted only when new data arrives), the best one tagged "Leading", or "Winner" for a likely winner or an ended test's winner (a success-coloured glow and wash on its row, stronger for a winner; static, nothing animates), the original tagged "Original". Tags use Reqore's `appearance="soft"` (reqore 0.77.2+); a long title stays on one line with an ellipsis. A row shows visitors, conversion, chance to beat the original and a bar; the shown version is the info-coloured row (`aria-current`); the whole row shows that version (Enter / Space too). Row actions: a neutral, minimal "Show analytics" for that version (`versionDetailsUrl`), minimal Accept, and a bin icon (Remove) at the far end. Footer: the optional "Open in …" link and Start / Resume (solid), Pause, Stop. Past three and a half rows the list scrolls inside the card. Every action asks first (Reqore's confirm dialog) and notifies what happened. |
| `useExperimentsAdmin(options)` | Optional: the list and the actions from the qorus-api routes. |
| `createExperimentsAdminClient(options)` | The same without React. |
| `placeCard`, `cardReducer`, `versionRows`, `verdictLine`, `versionsMaxHeight`, … | The plain logic behind them, for tests and custom UIs. |

Both components are driven by props only: the data is the qorus-api editor / admin list (an array of
`{ experiment, results }`: the admin experiment object with `status`, `variants`, `phase`,
`phases`, `history`, `winner`, and the results object with `verdict_text` and the per-metric
numbers), and every action is a callback that may return a promise (the button shows busy until it
settles, and a rejection's message is shown). An action whose callback is not given does not
appear. Neither makes a request of its own.

```tsx
import { ExperimentsOverlay, useExperimentsAdmin } from '@qoretechnologies/reqraft/dist/tracking/ui';

const AbTestsLayer = ({ visible }: { visible: boolean }) => {
  const admin = useExperimentsAdmin({
    listUrl: '/qorus-cloud/editor/experiments?property=ide', // actions go to …/experiments/<key>/<action>
    headers: { Authorization: `Bearer ${editorToken}` },      // or leave it to a proxy
    enabled: visible,
  });
  return (
    <ExperimentsOverlay
      visible={visible}                     // the product's "hide editor elements"
      tests={admin.tests}
      loadError={admin.error}
      onAccept={admin.accept}
      onRemove={admin.remove}
      onStart={admin.start}
      onPause={admin.pause}
      onStop={admin.stop}
      detailsUrl={(key) => `${ADMIN_PORTAL}/analytics?dashboard=tracking&experiment=${key}`}
      actorLabels={{ 'ide-editor': 'in the IDE' }}
      topInset={() => document.querySelector('header')?.getBoundingClientRect().bottom ?? 0}
    />
  );
};
```

- Mount it inside `<TrackingProvider>`: then clicking a version's row uses the tracker's in-app
  switch (`tracker.experiments.setEditorOverride`, this browser only, never logged), and after
  an action the page shows what visitors see now (the switch is cleared and the tracker reloads
  the definitions). Pass `onShow` / `onSettled` to do something else.
- `versionDetailsUrl={(key, variant) => \`${ADMIN_PORTAL}/analytics?dashboard=tracking&experiment=${key}&variant=${variant}\`}`
  adds the per-version "Show analytics" action (the admin portal opens the test with that version
  expanded); without it the action is hidden. `detailsUrl` stays for the whole test.
- The "?" opens a dialog explaining the test for a marketer: every button, how visitors are split
  and counted, reading the verdict and the chance to beat, the too-early rule (the test's
  `min_sample`, 200 visitors per version and 7 days by default), a test that is not set up, and
  where the full analytics are (`analyticsLabel`).
- A test that is in the page's code (`<Experiment>`) but not registered in the analytics service
  yet shows "Not set up" and asks to have it set up (`notSetUpText` changes the words); when the list
  cannot be loaded (`loadError`) it shows "No connection" instead.
- `exclude` (a selector) skips markers inside the product's own UI (e.g. its preview frames);
  markers inside the overlay itself are always skipped.
- The same overlay works inside a phone-preview iframe: mount it in the frame's page too. The
  switch is shared through `localStorage`, so both follow it.
- `useExperimentsAdmin` reloads the list every minute (`refreshMs`) and after every action; its
  errors explain a 401 / 403 as a missing or wrong key. `actionUrl` and `createUrl` change the
  routes; `fetch` replaces the transport.
- The card on its own: `<ExperimentCard experimentKey="signup-cta" test={entry} shown="a" codeVariants={['a', 'b']} onShow={…} onAccept={…} … />`.

Stories: `Tracking/Experiment Card` (draft, running with two and five versions, paused, concluded,
no data yet, not set up, no connection, the confirm step on Remove, the help) and
`Tracking/Experiments Overlay` (anchored, flipped above near the bottom, hidden), each in dark,
light and phone. The visually empty ones (hidden, the phone flip) run as tests without a Qlip
snapshot (`parameters.qlip.skip`).
