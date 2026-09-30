import {
  ReqoreButton,
  ReqoreTag,
  useReqoreProperty,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useTracker } from '../react/TrackingProvider';
import {
  cardReducer,
  CLOSED,
  openCard,
  OUTSIDE_IGNORE,
  placeCard,
  type IPlacement,
} from './anchor';
import { winnerNote } from './card';
import { ExperimentCard } from './ExperimentCard';
import type { IExperimentEntry, TExperimentActionResult } from './types';

type TMaybeAsync<T = unknown> = T | Promise<T>;

export interface IExperimentsOverlayProps {
  /** Draws nothing while false (an editor's "hide editor elements"). Default true. */
  visible?: boolean;
  /** The server's tests (the editor or admin list); null while loading. A test only in code still gets its versions. */
  tests?: IExperimentEntry[] | null;
  /** Why the list could not be loaded. */
  loadError?: string | null;
  /**
   * Show a version on this page. Default: the tracker's in-app switch
   * (`tracker.experiments.setEditorOverride`, never logged) when a `<TrackingProvider>` is above.
   */
  onShow?: (key: string, variant: string) => void;
  onAccept?: (key: string, variant: string) => TMaybeAsync<TExperimentActionResult | unknown>;
  onRemove?: (key: string, variant: string) => TMaybeAsync<TExperimentActionResult | unknown>;
  onStart?: (key: string) => TMaybeAsync;
  onPause?: (key: string) => TMaybeAsync;
  onStop?: (key: string) => TMaybeAsync;
  /**
   * After an action succeeded. Default: the page shows what visitors see now (the switch is
   * cleared, the tracker reloads the definitions and mounted experiments decide again).
   */
  onSettled?: (key: string) => TMaybeAsync;
  /** The test's details page (the card's "Open in …" link); none when it returns nothing. */
  detailsUrl?: (key: string) => string | null | undefined;
  /** The link's label. Default `Open in admin portal`. */
  detailsLabel?: string;
  /** One version's analytics (the rows' "Show analytics"); hidden when absent or it returns nothing. */
  versionDetailsUrl?: (key: string, variant: string) => string | null | undefined;
  /** Where the full analytics live, in the help's words. Default `the admin portal`. */
  analyticsLabel?: string;
  /** The words for a test that is in the page's code but not set up in the analytics service yet. */
  notSetUpText?: string;
  /** Who removed a version, in words, by the history's `actor`. */
  actorLabels?: Record<string, string>;
  /** The part of the viewport a sticky header covers (px, or read on every render). Default 0. */
  topInset?: number | (() => number);
  /** Markers inside elements matching this selector are ignored (e.g. an editor's own UI). */
  exclude?: string;
  /** The handle's words. Default `A/B test · <name>`. */
  handleLabel?: (name: string) => string;
}

// Overlay chrome only: the outline around a tested element, never taking the pointer.
const StyledOutline = styled.div`
  position: absolute;
  pointer-events: none;
  z-index: 880;
  border-radius: 10px;
  outline-width: 2px;
  outline-style: dashed;
  outline-offset: -3px;
`;

// Layout only: the handle and the card, in page coordinates so they scroll with the element.
const StyledFloat = styled.div<{ $card?: boolean }>`
  position: absolute;
  z-index: ${({ $card }) => ($card ? 956 : 955)};
  filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.35));
`;

/** The overlay's own root; markers inside it are never outlined. */
export const OVERLAY_ATTRIBUTE = 'data-experiments-overlay';

interface IMarked {
  key: string;
  shown: string;
  variants: string[];
  reason: string;
  box: DOMRect;
}

/** One box around the elements (viewport coordinates); tiny elements are ignored. */
export const boxOf = (els: Element[]): DOMRect | null => {
  let box: { l: number; t: number; r: number; b: number } | null = null;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    box =
      box ?
        {
          l: Math.min(box.l, r.left),
          t: Math.min(box.t, r.top),
          r: Math.max(box.r, r.right),
          b: Math.max(box.b, r.bottom),
        }
      : { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }
  return box ? new DOMRect(box.l, box.t, box.r - box.l, box.b - box.t) : null;
};

const markedOnPage = (exclude?: string): IMarked[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-experiment]'))
    .filter((el) => !el.closest(`[${OVERLAY_ATTRIBUTE}]`) && !(exclude && el.closest(exclude)))
    .map((el) => {
      const box = boxOf(Array.from(el.children));
      return box ?
          {
            key: el.dataset.experiment ?? '',
            shown: el.dataset.variant ?? '',
            variants: (el.dataset.variants ?? '').split(',').filter(Boolean),
            reason: el.dataset.experimentReason ?? '',
            box,
          }
        : null;
    })
    .filter((m): m is IMarked => !!m && !!m.key);

const inside = (
  r: { left: number; top: number; right: number; bottom: number },
  x: number,
  y: number
) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

/** Re-renders the caller on scroll, resize and every 700 ms (content arriving), while `active`. */
const useFollowPage = (active: boolean) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const bump = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTick((t) => t + 1));
    };
    window.addEventListener('scroll', bump, { passive: true, capture: true });
    window.addEventListener('resize', bump);
    const id = window.setInterval(bump, 700);
    return () => {
      window.removeEventListener('scroll', bump, { capture: true });
      window.removeEventListener('resize', bump);
      window.clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, [active]);
};

const HANDLE_ESTIMATE = { width: 240, height: 30 };

/**
 * Every `<Experiment>` on the page (its `data-experiment` marker) gets a dashed outline and a
 * handle, "A/B test · <name>", at its top-left corner. Hovering the element, focusing the handle,
 * or clicking / tapping it opens the test's `<ExperimentCard>`, anchored to the element: it moves
 * and resizes with it and flips above or below the handle to stay in view. ✕, Esc and a click
 * outside close it. An ended test shows "Winner live" instead. Data and actions come in as props
 * (`useExperimentsAdmin` provides them from the qorus-api routes).
 */
export const ExperimentsOverlay = ({
  visible = true,
  tests,
  loadError,
  onShow,
  onAccept,
  onRemove,
  onStart,
  onPause,
  onStop,
  onSettled,
  detailsUrl,
  detailsLabel,
  versionDetailsUrl,
  analyticsLabel,
  notSetUpText,
  actorLabels,
  topInset = 0,
  exclude,
  handleLabel = (name) => `A/B test · ${name}`,
}: IExperimentsOverlayProps) => {
  const tracker = useTracker();
  const theme = useReqoreTheme();
  const hoverCapable = useReqoreProperty('isHoverCapable') !== false;
  const [cards, dispatch] = useReducer(cardReducer, CLOSED);
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const boxes = useRef(new Map<string, DOMRect>());
  const floats = useRef(new Map<string, HTMLDivElement>());
  const sides = useRef(new Map<string, 'below' | 'above'>());
  const open = visible ? openCard(cards) : null;

  const marked = visible && typeof document !== 'undefined' ? markedOnPage(exclude) : [];
  useFollowPage(visible);
  // A version switch, an accept or a removal re-renders the tested element; a resize moves it.
  const [, setSeen] = useState(0);
  const markedKeys = marked.map((m) => m.key).join(',');
  useEffect(() => {
    if (!visible) return undefined;
    const bump = () => setSeen((n) => n + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-variant', 'data-experiment-reason'],
    });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(bump);
    document.querySelectorAll('[data-experiment] > *').forEach((el) => ro?.observe(el));
    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, [markedKeys, visible]);

  // Hover: the pointer over a tested element, its handle or its card. Leaving waits a moment,
  // so the pointer can cross the gap between the handle and the card.
  useEffect(() => {
    if (!hoverCapable || !visible) return undefined;
    let leave = 0;
    const onMove = (e: PointerEvent) => {
      let hit: string | null = null;
      boxes.current.forEach((box, key) => {
        if (!hit && inside(box, e.clientX, e.clientY)) hit = key;
      });
      floats.current.forEach((el, id) => {
        if (!hit && inside(el.getBoundingClientRect(), e.clientX, e.clientY))
          hit = id.split('|')[0];
      });
      window.clearTimeout(leave);
      if (hit) dispatch({ type: 'hover', key: hit });
      else leave = window.setTimeout(() => dispatch({ type: 'hover', key: null }), 220);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.clearTimeout(leave);
      document.removeEventListener('pointermove', onMove);
    };
  }, [hoverCapable, visible]);

  // Esc and a click outside the card close it (a click in the confirm step it opened does not).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'close' });
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.(OUTSIDE_IGNORE)) return;
      dispatch({ type: 'close' });
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open]);

  // The handles' and the card's real sizes, for the placement.
  useLayoutEffect(() => {
    const next: Record<string, { width: number; height: number }> = {};
    floats.current.forEach((el, id) => {
      next[id] = { width: el.offsetWidth, height: el.offsetHeight };
    });
    const same =
      Object.keys(next).length === Object.keys(sizes).length &&
      Object.entries(next).every(
        ([k, v]) => sizes[k]?.width === v.width && sizes[k]?.height === v.height
      );
    if (!same) setSizes(next);
  });

  /** After an action the page shows what visitors see now: no switch, fresh definitions, a new decision. */
  const settle = useCallback(
    async (key: string) => {
      if (onSettled) {
        await onSettled(key);
        return;
      }
      tracker?.experiments.setEditorOverride(key, null);
      await tracker?.experiments.refresh();
    },
    [onSettled, tracker]
  );

  const settled = <A extends unknown[]>(
    key: string,
    fn?: (key: string, ...args: A) => TMaybeAsync
  ) =>
    fn ?
      async (...args: A) => {
        const result = await fn(key, ...args);
        await settle(key);
        return result;
      }
    : undefined;

  const show =
    onShow ??
    (tracker ?
      (key: string, variant: string) => tracker.experiments.setEditorOverride(key, variant)
    : undefined);

  if (!visible || typeof document === 'undefined') return null;
  boxes.current.clear();
  const viewport = {
    width: document.documentElement.clientWidth || window.innerWidth,
    height: window.innerHeight,
  };
  const scroll = { x: window.scrollX, y: window.scrollY };
  const inset = typeof topInset === 'function' ? topInset() : topInset;

  const setFloat = (id: string) => (el: HTMLDivElement | null) => {
    if (el) floats.current.set(id, el);
    else floats.current.delete(id);
  };

  return createPortal(
    <div {...{ [OVERLAY_ATTRIBUTE]: '' }}>
      {marked.map((m) => {
        const entry = tests?.find((e) => e.experiment.key === m.key);
        const concluded = m.reason === 'concluded' || entry?.experiment.status === 'concluded';
        const name = entry?.experiment.name || m.key;
        const isOpen = !concluded && open === m.key;
        const place: IPlacement = placeCard({
          box: m.box,
          viewport,
          scroll,
          handle: sizes[`${m.key}|handle`] ?? HANDLE_ESTIMATE,
          card: isOpen ? (sizes[`${m.key}|card`] ?? { height: 420 }) : null,
          topInset: inset,
          side: sides.current.get(m.key),
        });
        if (place.card) sides.current.set(m.key, place.card.side);
        else sides.current.delete(m.key);
        boxes.current.set(m.key, m.box);
        if (!place.visible) return null;
        const onBlur = (e: FocusEvent<HTMLDivElement>) => {
          if (
            !(e.relatedTarget as Element | null)?.closest?.(`[data-experiment-float="${m.key}"]`)
          ) {
            dispatch({ type: 'blur', key: m.key });
          }
        };
        const floatProps = {
          'data-experiment-float': m.key,
          onFocus: () => dispatch({ type: 'focus', key: m.key }),
          onBlur,
        };
        return (
          <div key={m.key}>
            <StyledOutline
              style={{ ...place.outline, outlineColor: theme.intents?.info }}
              data-experiment-outline={m.key}
            />
            <StyledFloat ref={setFloat(`${m.key}|handle`)} style={place.handle} {...floatProps}>
              {concluded ?
                <ReqoreTag
                  icon='TrophyLine'
                  label={winnerNote(entry, m.shown)}
                  tooltip='Every visitor sees this version. A developer removes the other versions’ code later.'
                  effect={{
                    gradient: { colors: { 0: 'success', 100: 'success:darken:1' } },
                    weight: 'bold',
                  }}
                />
              : <ReqoreButton
                  pill
                  size='small'
                  icon='FlaskLine'
                  intent='info'
                  active={isOpen}
                  aria-expanded={isOpen}
                  tooltip={isOpen ? undefined : 'A/B test: see its versions and numbers'}
                  onClick={() => dispatch({ type: 'toggle', key: m.key })}
                >
                  {handleLabel(name)}
                </ReqoreButton>
              }
            </StyledFloat>
            {isOpen && place.card && (
              <StyledFloat
                $card
                ref={setFloat(`${m.key}|card`)}
                style={{ top: place.card.top, left: place.card.left, width: place.card.width }}
                data-side={place.card.side}
                {...floatProps}
              >
                <ExperimentCard
                  experimentKey={m.key}
                  test={entry}
                  name={name}
                  shown={m.shown}
                  codeVariants={m.variants}
                  maxHeight={place.card.maxHeight}
                  loadError={loadError}
                  detailsUrl={detailsUrl?.(m.key)}
                  detailsLabel={detailsLabel}
                  versionDetailsUrl={
                    versionDetailsUrl ? (variant) => versionDetailsUrl(m.key, variant) : undefined
                  }
                  analyticsLabel={analyticsLabel}
                  notSetUpText={notSetUpText}
                  actorLabels={actorLabels}
                  onClose={() => dispatch({ type: 'close' })}
                  onShow={show ? (variant) => show(m.key, variant) : undefined}
                  onAccept={settled(m.key, onAccept)}
                  onRemove={settled(m.key, onRemove)}
                  onStart={settled(m.key, onStart)}
                  onPause={settled(m.key, onPause)}
                  onStop={settled(m.key, onStop)}
                />
              </StyledFloat>
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );
};
