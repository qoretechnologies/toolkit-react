import {
  ReqoreCallout,
  ReqoreEntityRow,
  ReqoreH4,
  ReqoreModal,
  ReqoreP,
  ReqorePanel,
  ReqoreProgress,
  ReqoreVerticalSpacer,
  useReqoreProperty,
  useReqoreTheme,
} from '@qoretechnologies/reqore';
import type { TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import type { IReqoreEntityRowAction } from '@qoretechnologies/reqore/dist/components/EntityRow';
import type { IReqorePanelBottomAction } from '@qoretechnologies/reqore/dist/components/Panel';
import type { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { RADIUS_FROM_SIZE } from '@qoretechnologies/reqore/dist/constants/sizes';
import { getLuminance, rgba } from 'polished';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
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
  helpSections,
  leadingVersion,
  lifecycleCopy,
  numbersLine,
  phaseNote,
  primaryMetric,
  sortVersionRows,
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
  /** The version this page shows now: its row takes the info colour (and `aria-current`). */
  shown?: string;
  /** The versions the page's code renders (`data-variants`); a server version outside it cannot be shown. */
  codeVariants?: string[];
  /** The room the card has (px): the versions scroll inside when it is short. */
  maxHeight?: number;
  /** Why the list could not be loaded (the analytics service cannot be reached). */
  loadError?: string | null;
  /** An "Open in …" link at the start of the footer (a new tab). */
  detailsUrl?: string | null;
  /** The link's label. Default `Open in admin portal`. */
  detailsLabel?: string;
  /** One version's analytics (a new tab): a "Show analytics" action on each row; none without it. */
  versionDetailsUrl?: (variant: string) => string | null | undefined;
  /** Where the full analytics live, in the help's words. Default `the admin portal`. */
  analyticsLabel?: string;
  /** Best first (conversion on the primary metric, then visitors). Default true. */
  sort?: boolean;
  /** The words for a test that is in the page's code but not set up in the analytics service yet. */
  notSetUpText?: string;
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

type TTagIntent = 'success' | 'warning' | 'danger' | 'muted' | 'info';

// Soft tags: an outlined pill over a wash of its colour, readable on dark and light themes.
const soft = (intent: TTagIntent) => ({ intent, appearance: 'soft' as const });

type THighlight = 'winner' | 'leading' | undefined;

const ROW_GAP = 6;
/** Room around the rows for the leader's glow, taken from the card's own padding. */
const GLOW_ROOM = 6;

/**
 * The leading version, and more so the winner: a glow in the success colour around the row and
 * a wash of it from the left. Static (nothing animates), drawn over the row without taking the
 * pointer, and in the theme's own success colour, so it reads on dark and light.
 */
const StyledVersion = styled.div<{ $highlight: THighlight; $color: string; $radius: number }>`
  position: relative;
  border-radius: ${({ $radius }) => $radius}px;
  ${({ $highlight, $color }) =>
    $highlight === 'winner' ?
      `box-shadow: 0 0 0 1px ${rgba($color, 0.9)}, 0 0 14px ${rgba($color, 0.45)};`
    : $highlight === 'leading' ?
      `box-shadow: 0 0 0 1px ${rgba($color, 0.45)}, 0 0 8px ${rgba($color, 0.2)};`
    : ''}

  ${({ $highlight, $color }) =>
    $highlight ?
      `&::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(100deg, ${rgba($color, $highlight === 'winner' ? 0.24 : 0.12)} 0%, ${rgba(
          $color,
          $highlight === 'winner' ? 0.08 : 0.04
        )} 45%, ${rgba($color, 0)} 75%);
      }`
    : ''}
`;

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
  /* Room for the leader's glow, taken back from the card's padding so the rows keep their width. */
  margin: 0 -${GLOW_ROOM}px;
  padding: ${GLOW_ROOM}px;

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
  versionDetailsUrl,
  analyticsLabel = 'the admin portal',
  sort = true,
  notSetUpText,
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [rowHeight, setRowHeight] = useState(0);
  const firstRow = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const unreachable = !entry && !!loadError;
  const codeKey = codeVariants.join(',');
  // The order is decided when the data arrives (a refresh), never while the user works in the card.
  const order = useMemo(() => {
    const all = versionRows(entry, codeVariants);
    return (sort ? sortVersionRows(all) : all).map((r) => r.key);
    // `codeVariants` is followed by its keys, not its identity.
  }, [entry, codeKey, sort]);
  const unsorted = versionRows(entry, codeVariants);
  const rows = order
    .map((key) => unsorted.find((r) => r.key === key))
    .filter(Boolean)
    .concat(unsorted.filter((r) => !order.includes(r.key)));
  const leader = leadingVersion(entry, rows);
  const bars = barValues(rows);
  const metric = primaryMetric(entry?.results);
  const status = entry?.experiment.status;
  const title = name || entry?.experiment.name || experimentKey;
  const tag = statusTag(entry, unreachable);
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
  const quiet = (intent?: 'success' | 'warning' | 'danger' | 'info') => ({
    minimal: true,
    ...(light && intent ?
      {
        effect: { color: `${intent}:darken:2` as const, weight: 'thick' as const },
        iconColor: `${intent}:darken:2` as const,
      }
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
      label={<span title={title}>{title}</span>}
      labelMaxLines={1}
      icon='FlaskLine'
      badge={{ label: tag.label, icon: tag.icon as IReqoreIconName, ...soft(tag.intent) }}
      size='small'
      rounded
      flat={false}
      padded
      collapsible={false}
      onClose={onClose}
      closeTooltip='Close (Esc)'
      closeButtonProps={{ 'aria-label': 'Close the test card', minimal: true } as never}
      actions={[
        {
          icon: 'QuestionLine',
          minimal: true,
          flat: true,
          tooltip: 'How A/B tests work',
          'aria-label': 'How A/B tests work',
          onClick: () => setHelpOpen(true),
        } as never,
      ]}
      bottomActions={footer.length ? footer : undefined}
    >
      <ReqoreCallout
        size='small'
        flat
        icon='LineChartLine'
        intent={unreachable ? 'warning' : verdictIntent(entry)}
        effect={{ weight: 500 }}
      >
        {verdictLine(entry, { unreachable, notSetUpText })}
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
          const highlight: THighlight = leader?.key === r.key ? leader.kind : undefined;
          const badges: TReqoreBadge[] = [];
          if (leader?.key === r.key) {
            badges.push(
              leader.kind === 'winner' ?
                { label: 'Winner', icon: 'TrophyLine', ...soft('success') }
              : { label: 'Leading', icon: 'ArrowUpLine', ...soft('success') }
            );
          }
          if (r.control) badges.push({ label: 'Original', icon: 'HomeLine', ...soft('muted') });
          if (!r.inCode)
            badges.push({ label: 'Not in the code', icon: 'AlertLine', ...soft('warning') });
          // The whole row shows its version; Accept and Remove stop the click (Reqore's row actions do).
          const showable = !!onShow && r.inCode && !isShown;
          const actions: IReqoreEntityRowAction[] = [];
          const analytics = entry ? versionDetailsUrl?.(r.key) : null;
          if (analytics) {
            actions.push({
              size: 'small',
              icon: 'BarChartBoxLine',
              label: 'Show analytics',
              ...quiet(),
              // Neutral: the card's own surface, not the tint of the row it sits on (the shown row is blue).
              customTheme: { main: theme.main },
              ...(light ?
                {
                  effect: { color: 'main:darken:25' as const, weight: 'thick' as const },
                  iconColor: 'main:darken:25' as const,
                }
              : {}),
              tooltip: `Show analytics for “${r.name}” (a new tab)`,
              'aria-label': `Show analytics for ${r.name}`,
              onClick: () => window.open(analytics, '_blank', 'noopener'),
            } as IReqoreEntityRowAction);
          }
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
              ...quiet('danger'),
              'aria-label': `Remove version ${r.name}`,
              // At the far end of the row, away from Accept, so it is not clicked by accident.
              style: { marginLeft: 'auto' },
              disabled: !remove || !!busy,
              loading: busyOn('remove', r.key),
              tooltip:
                remove ?
                  `Remove version: drop “${r.name}” from the test`
                : 'This version cannot be removed now',
              onClick: () => act('remove', r.key),
            } as IReqoreEntityRowAction);
          }
          return (
            <StyledVersion
              role='listitem'
              key={r.key}
              ref={i === 0 ? firstRow : undefined}
              data-version={r.key}
              data-highlight={highlight}
              aria-current={isShown || undefined}
              $highlight={highlight}
              $color={theme.intents?.success ?? '#4a7110'}
              $radius={RADIUS_FROM_SIZE.small}
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
            </StyledVersion>
          );
        })}
      </StyledVersions>
      {!entry && (
        <>
          <ReqoreVerticalSpacer height={8} />
          <ReqoreP size='small' effect={{ opacity: 0.7 }}>
            {unreachable ?
              'Start, Accept and Remove come back once the analytics service answers.'
            : 'Start, Accept and Remove appear once the test is set up.'}
          </ReqoreP>
        </>
      )}
      <ReqoreModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        label='How A/B tests work'
        icon='QuestionLine'
        width='640px'
        blur={2}
        className='reqraft-experiment-help'
      >
        {helpSections(entry, analyticsLabel).map((section) => (
          <div key={section.title}>
            <ReqoreH4>{section.title}</ReqoreH4>
            <ReqoreVerticalSpacer height={4} />
            {section.paragraphs.map((text) => (
              <div key={text}>
                <ReqoreP size='small' effect={{ weight: 500 }}>
                  {text}
                </ReqoreP>
                <ReqoreVerticalSpacer height={6} />
              </div>
            ))}
            <ReqoreVerticalSpacer height={14} />
          </div>
        ))}
      </ReqoreModal>
    </ReqorePanel>
  );
};
