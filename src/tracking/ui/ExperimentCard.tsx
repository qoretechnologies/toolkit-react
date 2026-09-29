import {
  ReqoreCallout,
  ReqoreEntityRow,
  ReqoreP,
  ReqorePanel,
  ReqoreProgress,
  ReqoreVerticalSpacer,
  useReqoreProperty,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import type { TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import type { IReqoreEffect } from '@qoretechnologies/reqore/dist/components/Effect';
import type { IReqoreEntityRowAction } from '@qoretechnologies/reqore/dist/components/EntityRow';
import type { IReqorePanelBottomAction } from '@qoretechnologies/reqore/dist/components/Panel';
import type { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { getLuminance } from 'polished';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import styled from 'styled-components';
import { activatesRow } from './anchor';
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
  primaryMetric,
  statusTag,
  verdictIntent,
  verdictLine,
  versionRows,
  versionsMaxHeight,
} from './card';
import type { IExperimentEntry, TExperimentAction, TExperimentActionResult } from './types';

type TMaybeAsync<T = unknown> = T | Promise<T>;

export interface IExperimentCardProps {
  /** The experiment key (`data-experiment` of `<Experiment>`). */
  experimentKey: string;
  /** The server's experiment and its results; absent while the test is not on the server. */
  test?: IExperimentEntry | null;
  /** The card's title. Default: the experiment's name, else its key. */
  name?: string;
  /** The version this page shows now: its row is marked "Shown". */
  shown?: string;
  /** The versions the page's code renders (`data-variants`); a server version outside it cannot be shown. */
  codeVariants?: string[];
  /** The room the card has (px): the versions scroll inside when it is short. */
  maxHeight?: number;
  /** Why the numbers could not be loaded. */
  loadError?: string | null;
  /** An "Open in …" link at the start of the footer (a new tab). */
  detailsUrl?: string | null;
  /** The link's label. Default `Open in admin portal`. */
  detailsLabel?: string;
  /** Who removed a version, in words, by the history's `actor` (`{ 'landing-editor': 'in the editor' }`). */
  actorLabels?: Record<string, string>;
  /** Asks before Accept, Remove, Start, Pause and Stop (Reqore's confirm dialog). Default true. */
  confirm?: boolean;
  /** A notification after each action (what happened, or the server's error). Default true. */
  notify?: boolean;
  /** A click (or Enter / Space) on a version's row: show that version on this page. Rows are not clickable without it. */
  onShow?: (variant: string) => void;
  /** Each action appears only when its callback is given; a returned promise shows the button busy until it settles. */
  onAccept?: (variant: string) => TMaybeAsync<TExperimentActionResult | unknown>;
  onRemove?: (variant: string) => TMaybeAsync<TExperimentActionResult | unknown>;
  onStart?: () => TMaybeAsync;
  onPause?: () => TMaybeAsync;
  onStop?: () => TMaybeAsync;
  /** The ✕ in the header. */
  onClose?: () => void;
}

// Solid tags: a badge with only an intent is a minimal tag, unreadable on a light theme.
const solid = (intent: 'success' | 'warning' | 'danger' | 'muted' | 'info'): IReqoreEffect => ({
  gradient: { colors: { 0: intent, 100: `${intent}:darken:1` } },
  weight: 'bold',
});

const ROW_GAP = 6;

// Layout only: the versions scroll inside the card past three and a half rows.
const StyledVersions = styled.div<{ $max: number | null }>`
  display: flex;
  flex-direction: column;
  gap: ${ROW_GAP}px;
  max-height: ${({ $max }) => ($max ? `${$max}px` : 'none')};
  overflow-y: ${({ $max }) => ($max ? 'auto' : 'visible')};
  overflow-x: hidden;
  overscroll-behavior: contain;
  min-width: 0;

  /* The rows take the card's width, never their content's, padding included: a host page
     without a global border-box reset would otherwise push each row past the card's edge. */
  > * {
    min-width: 0;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
`;

/** Header, verdict and footer take about this much of `maxHeight`; the versions get the rest. */
const CHROME_HEIGHT = 230;

/**
 * One A/B test: its name and status, the verdict in plain words, one row per version (visitors,
 * conversion, chance to beat the original, a bar; click a row to show that version; Accept, and
 * Remove at the far end), and the test's own controls (Start / Resume, Pause, Stop) with an
 * optional link to its details. Driven only by props: no requests of its own.
 */
export const ExperimentCard = ({
  experimentKey,
  test,
  name,
  shown,
  codeVariants = [],
  maxHeight,
  loadError,
  detailsUrl,
  detailsLabel = 'Open in admin portal',
  actorLabels,
  confirm = true,
  notify = true,
  onShow,
  onAccept,
  onRemove,
  onStart,
  onPause,
  onStop,
  onClose,
}: IExperimentCardProps) => {
  const entry = test ?? undefined;
  const confirmAction = useReqoreProperty('confirmAction');
  const addNotification = useReqoreProperty('addNotification');
  const theme = useReqoreTheme();
  const light = (() => {
    try {
      return getLuminance(theme.main) > 0.5;
    } catch {
      return false;
    }
  })();
  const [busy, setBusy] = useState<string | null>(null);
  const [rowHeight, setRowHeight] = useState(0);
  const firstRow = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const rows = versionRows(entry, codeVariants);
  const bars = barValues(rows);
  const metric = primaryMetric(entry?.results);
  const status = entry?.experiment.status;
  const title = name || entry?.experiment.name || experimentKey;
  const tag = statusTag(entry);
  const note = phaseNote(entry, actorLabels);
  const busyOn = (action: string, variant = '') => busy === `${action}:${variant}`;

  useLayoutEffect(() => {
    const h = firstRow.current?.offsetHeight ?? 0;
    if (h && h !== rowHeight) setRowHeight(h);
  });
  // A row's height changes with the card's width (a phone, a resized window): measure it again.
  useEffect(() => {
    const el = firstRow.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setRowHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Minimal buttons tint their text from the intent, too pale on a light theme: a deeper shade there.
  const quiet = (intent?: 'success' | 'warning' | 'danger') => ({
    minimal: true,
    ...(light && intent ?
      { effect: { color: `${intent}:darken:2` as const, weight: 'thick' as const } }
    : {}),
  });

  const act = (action: TExperimentAction, variant?: string) => {
    if (!entry) return;
    const callbacks = {
      accept: onAccept,
      remove: onRemove,
      start: onStart,
      pause: onPause,
      stop: onStop,
    };
    const callback = callbacks[action];
    if (!callback) return;
    const isVersion = action === 'accept' || action === 'remove';
    const copy = isVersion ? confirmCopy(action, entry, variant) : lifecycleCopy(action, entry);
    const titles: Record<TExperimentAction, [string, string]> = {
      accept: ['Winner accepted', 'Could not accept'],
      remove: ['Version removed', 'Could not remove'],
      start: [status === 'paused' ? 'Test resumed' : 'Test started', 'Could not start'],
      pause: ['Test paused', 'Could not pause'],
      stop: ['Test stopped', 'Could not stop'],
    };
    const run = async () => {
      setBusy(`${action}:${variant ?? ''}`);
      try {
        const result = await (callback as (v?: string) => TMaybeAsync)(variant);
        if (notify) {
          const content =
            isVersion ?
              actionOutcome(action, result as TExperimentActionResult, variant)
            : `“${title}” is ${
                action === 'start' ? 'running'
                : action === 'pause' ? 'paused'
                : 'stopped'
              }.`;
          addNotification?.({
            intent: 'success',
            title: titles[action][0],
            content,
            duration: 8000,
          });
        }
      } catch (err) {
        if (notify) {
          addNotification?.({
            intent: 'danger',
            title: titles[action][1],
            content: (err as Error)?.message ?? String(err),
            duration: 10000,
          });
        }
      } finally {
        if (mounted.current) setBusy(null);
      }
    };
    if (confirm && confirmAction) {
      confirmAction({
        title: copy.title,
        description: copy.description,
        confirmLabel: copy.confirmLabel,
        confirmButtonIntent:
          action === 'accept' || action === 'start' ? 'success'
          : action === 'pause' ? 'warning'
          : 'danger',
        onConfirm: () => void run(),
      });
    } else {
      void run();
    }
  };

  const footer: IReqorePanelBottomAction[] = [];
  if (detailsUrl) {
    footer.push({
      position: 'left',
      icon: 'ExternalLinkLine',
      label: detailsLabel,
      responsive: false,
      ...quiet(),
      tooltip: 'This test’s details (a new tab)',
      onClick: () => window.open(detailsUrl, '_blank', 'noopener'),
    });
  }
  if (entry && status) {
    // Every button in the card is minimal, except Start test / Resume: the one primary action.
    if (onStart && canStart(status)) {
      footer.push({
        position: 'right',
        icon: 'PlayLine',
        intent: 'success',
        label: status === 'paused' ? 'Resume' : 'Start test',
        responsive: false,
        disabled: !!busy,
        loading: busyOn('start'),
        tooltip:
          status === 'paused' ?
            'Split visitors between the versions again'
          : 'Start splitting visitors between the versions and counting',
        onClick: () => act('start'),
      });
    }
    if (onPause && canPause(status)) {
      footer.push({
        position: 'right',
        icon: 'PauseLine',
        intent: 'warning',
        label: 'Pause',
        responsive: false,
        ...quiet('warning'),
        disabled: !!busy,
        loading: busyOn('pause'),
        tooltip: 'Everybody sees the original until you resume',
        onClick: () => act('pause'),
      });
    }
    if (onStop && canStop(status)) {
      footer.push({
        position: 'right',
        icon: 'StopLine',
        intent: 'danger',
        label: 'Stop',
        responsive: false,
        ...quiet('danger'),
        disabled: !!busy,
        loading: busyOn('stop'),
        tooltip: 'End the test without a winner',
        onClick: () => act('stop'),
      });
    }
  }

  const accept = status ? canAccept(status) : false;
  const remove = status ? canRemove(status, rows.length) : false;
  const listMax = versionsMaxHeight({
    rows: rows.length,
    rowHeight,
    gap: ROW_GAP,
    available: maxHeight ? Math.max(rowHeight, maxHeight - CHROME_HEIGHT) : undefined,
  });

  return (
    <ReqorePanel
      className='reqraft-experiment-card'
      label={title}
      icon='FlaskLine'
      badge={{ label: tag.label, icon: tag.icon as IReqoreIconName, effect: solid(tag.intent) }}
      size='small'
      rounded
      flat={false}
      padded
      collapsible={false}
      onClose={onClose}
      closeTooltip='Close (Esc)'
      closeButtonProps={{ 'aria-label': 'Close the test card', minimal: true } as never}
      bottomActions={footer.length ? footer : undefined}
    >
      <ReqoreCallout
        size='small'
        flat
        icon='LineChartLine'
        intent={loadError && !entry ? 'warning' : verdictIntent(entry)}
        effect={{ weight: 500 }}
      >
        {loadError && !entry ?
          `Could not load the test's numbers: ${loadError}`
        : verdictLine(entry)}
      </ReqoreCallout>
      {note && (
        <>
          <ReqoreVerticalSpacer height={6} />
          <ReqoreP size='small' effect={{ opacity: 0.7 }}>
            {note}
          </ReqoreP>
        </>
      )}
      <ReqoreVerticalSpacer height={10} />
      <ReqoreP size='small' effect={{ opacity: 0.75, weight: 500 }}>
        {`${rows.length} versions${metric?.name ? ` · goal: “${metric.name}”` : ''}`}
      </ReqoreP>
      <ReqoreVerticalSpacer height={6} />
      <StyledVersions
        $max={listMax}
        role='list'
        aria-label='Versions'
        className='reqraft-experiment-versions'
      >
        {rows.map((r, i) => {
          const isShown = r.key === shown;
          const badges: TReqoreBadge[] = [];
          if (isShown) badges.push({ label: 'Shown', icon: 'EyeLine', effect: solid('info') });
          if (r.control) badges.push({ label: 'Original', icon: 'HomeLine' });
          if (!r.inCode)
            badges.push({ label: 'Not in the code', icon: 'AlertLine', effect: solid('warning') });
          // The whole row shows its version; Accept and Remove stop the click (Reqore's row actions do).
          const showable = !!onShow && r.inCode && !isShown;
          const actions: IReqoreEntityRowAction[] = [];
          if (entry && onAccept) {
            actions.push({
              size: 'small',
              icon: 'TrophyLine',
              intent: 'success',
              label: 'Accept',
              ...quiet('success'),
              disabled: !accept || !!busy,
              loading: busyOn('accept', r.key),
              tooltip:
                accept ?
                  `End the test: every visitor sees “${r.name}”`
                : 'Only a started test can be accepted',
              onClick: () => act('accept', r.key),
            });
          }
          if (entry && onRemove) {
            actions.push({
              size: 'small',
              icon: 'DeleteBinLine',
              intent: 'danger',
              label: 'Remove',
              ...quiet('danger'),
              // At the far end of the row, away from Accept, so it is not clicked by accident.
              style: { marginLeft: 'auto' },
              disabled: !remove || !!busy,
              loading: busyOn('remove', r.key),
              tooltip:
                remove ? `Drop “${r.name}” from the test` : 'This version cannot be removed now',
              onClick: () => act('remove', r.key),
            });
          }
          return (
            <div
              role='listitem'
              key={r.key}
              ref={i === 0 ? firstRow : undefined}
              data-version={r.key}
              aria-current={isShown || undefined}
            >
              <ReqoreEntityRow
                size='small'
                rounded
                flat={!isShown}
                intent={isShown ? 'info' : undefined}
                label={r.name}
                badge={badges}
                description={numbersLine(r, metric?.name, status)}
                metadata={
                  r.visitors ?
                    <ReqoreProgress
                      value={bars[i]}
                      size='tiny'
                      rounded
                      flat
                      style={{ width: '100%', minWidth: 160 }}
                      intent={
                        isShown ? 'info'
                        : r.control ?
                          'muted'
                        : 'success'
                      }
                      aria-label={`${r.name}: conversion compared with the best version`}
                    />
                  : undefined
                }
                iconHasBackground={false}
                showIcon={false}
                actions={actions.length ? actions : undefined}
                {...(showable ?
                  {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': `Show “${r.name}” on this page`,
                    tooltip: `Show “${r.name}” on this page (only here, never counted)`,
                    onClick: () => onShow(r.key),
                    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
                      if (!activatesRow(e.key, e.target === e.currentTarget)) return;
                      e.preventDefault();
                      onShow(r.key);
                    },
                  }
                : {})}
              />
            </div>
          );
        })}
      </StyledVersions>
      {!entry && (
        <>
          <ReqoreVerticalSpacer height={8} />
          <ReqoreP size='small' effect={{ opacity: 0.7 }}>
            Start, Accept and Remove appear once the test is set up on the server.
          </ReqoreP>
        </>
      )}
    </ReqorePanel>
  );
};
