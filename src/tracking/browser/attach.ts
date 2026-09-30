import { effectiveRatio } from '../core/sections';
import type { Tracker } from '../core/tracker';

/**
 * Connects a `Tracker` to the page: tab visibility, page leave, interactions,
 * scroll depth, the heartbeat, section visibility (IntersectionObserver on every
 * `[data-track-section]`) and clicks (one delegated listener for
 * `[data-track-click]`). Returns a function that removes all of it.
 *
 * Markup contract (see design/TRACKING.md):
 *   data-track-section="<id>"        a section: visible time, seen, exit section
 *   data-track-click="<target>"      a tracked click (`get-started`, `contact`, …)
 *   data-track-placement="<where>"   optional; defaults to the enclosing section id
 *   data-track-label="<text>"        optional; defaults to the element's text
 */

const SECTION_SELECTOR = '[data-track-section]';
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);
const TICK_MS = 250;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove', 'scroll'] as const;

export interface IAttached {
  detach: () => void;
  /** Observes an element under a synthetic id (an experiment's wrapped element); not in the page summary. */
  observeElement: (el: Element, id: string) => () => void;
}

const clean = (s: string | null | undefined, max = 80) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

export const attachToPage = (tracker: Tracker, heartbeatMs: number): IAttached => {
  const cleanup: (() => void)[] = [];
  const on = (target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts);
    cleanup.push(() => target.removeEventListener(type, fn, opts));
  };
  const safe = (fn: () => void) => () => {
    try {
      fn();
    } catch {
      /* never into the page */
    }
  };

  // ── tab visibility and page leave
  on(document, 'visibilitychange', safe(() => tracker.setTabVisible(document.visibilityState === 'visible')));
  on(window, 'pagehide', safe(() => tracker.leave()));
  if (document.visibilityState !== 'visible') tracker.setTabVisible(false);

  // ── engagement (throttled to one signal per second)
  let lastActivity = 0;
  const activity = safe(() => {
    const now = Date.now();
    if (now - lastActivity < 1000) return;
    lastActivity = now;
    tracker.activity();
  });
  ACTIVITY_EVENTS.forEach((t) => on(window, t, activity, { passive: true, capture: true }));

  // ── scroll depth (once per frame)
  let scrollQueued = false;
  const measureScroll = safe(() => {
    scrollQueued = false;
    const doc = document.documentElement;
    const scrollable = Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);
    const seen = window.scrollY + window.innerHeight;
    tracker.scrolled(scrollable > 0 ? (seen / scrollable) * 100 : 100);
  });
  on(window, 'scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(measureScroll);
  }, { passive: true });

  // ── heartbeat while visible, and the section clock
  const heartbeat = setInterval(safe(() => document.visibilityState === 'visible' && tracker.heartbeat()), heartbeatMs);
  const tick = setInterval(safe(() => tracker.sections.tick(tracker.now())), TICK_MS);
  cleanup.push(() => clearInterval(heartbeat), () => clearInterval(tick));

  // ── sections
  const ratios = new Map<Element, number>();
  const ids = new Map<Element, string>();
  const report = new Map<string, boolean>();
  const apply = (id: string) => {
    let best = 0;
    ids.forEach((other, el) => other === id && (best = Math.max(best, ratios.get(el) ?? 0)));
    tracker.sections.update(id, best, tracker.now());
  };
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) =>
            safe(() => {
              const vh = window.innerHeight || document.documentElement.clientHeight;
              entries.forEach((e) => {
                const id = ids.get(e.target);
                if (!id) return;
                ratios.set(e.target, effectiveRatio(e.intersectionRatio, e.intersectionRect.height, e.rootBounds?.height ?? vh));
                apply(id);
              });
            })(),
          { threshold: THRESHOLDS },
        )
      : null;

  const track = (el: Element, id: string, inSummary: boolean) => {
    if (ids.get(el) === id) return;
    ids.set(el, id);
    report.set(id, (report.get(id) ?? false) || inSummary);
    tracker.sections.register(id, inSummary);
    io?.observe(el);
  };
  const untrack = (el: Element) => {
    const id = ids.get(el);
    if (!id) return;
    io?.unobserve(el);
    ids.delete(el);
    ratios.delete(el);
    apply(id);
  };

  const scan = safe(() => {
    const present = new Set<Element>(Array.from(document.querySelectorAll(SECTION_SELECTOR)));
    ids.forEach((id, el) => report.get(id) && !present.has(el) && !el.isConnected && untrack(el));
    present.forEach((el) => {
      const id = (el as HTMLElement).dataset.trackSection;
      if (id) track(el, id, true);
    });
  });

  // Re-measure everything at a new page view: the section clock starts from zero,
  // and re-observing makes the observer report every element's current state.
  const remeasure = safe(() => {
    scan();
    ids.forEach((_id, el) => {
      io?.unobserve(el);
      io?.observe(el);
    });
  });
  cleanup.push(tracker.pageViewId.subscribe(remeasure));

  let scanTimer: ReturnType<typeof setTimeout> | null = null;
  const mo =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => {
          if (scanTimer) return;
          scanTimer = setTimeout(() => {
            scanTimer = null;
            scan();
          }, 150);
        })
      : null;
  mo?.observe(document.body, { childList: true, subtree: true });
  scan();
  cleanup.push(() => {
    mo?.disconnect();
    io?.disconnect();
    if (scanTimer) clearTimeout(scanTimer);
  });

  // ── clicks: one delegated listener
  const onClick = (e: Event) =>
    safe(() => {
      const el = (e.target as Element | null)?.closest?.('[data-track-click]') as HTMLElement | null;
      if (!el) return;
      const d = el.dataset;
      const link = el.closest('a');
      tracker.click({
        target: d.trackClick || 'unknown',
        placement: d.trackPlacement || (el.closest(SECTION_SELECTOR) as HTMLElement | null)?.dataset.trackSection || null,
        label: clean(d.trackLabel) ?? clean(el.innerText) ?? clean(el.getAttribute('aria-label')),
        href: d.trackHref || link?.href || null,
      });
    })();
  on(document, 'click', onClick, { capture: true });

  return {
    detach: () => cleanup.forEach((fn) => fn()),
    observeElement: (el, id) => {
      track(el, id, false);
      return () => untrack(el);
    },
  };
};
