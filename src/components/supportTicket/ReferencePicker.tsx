import {
  ReqoreInput,
  ReqoreMenu,
  ReqoreMenuItem,
  ReqoreModal,
  ReqoreSpinner,
} from '@qoretechnologies/reqore';
import { TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { thinScrollbar } from '../../helpers/scrollbar';
import {
  defaultInterfaceIcon,
  defaultInterfaceKindLabel,
  IInterfaceReference,
} from './meta';

/*
 * The interface browser: kinds on one side, the selected kind's interfaces on the
 * other, and one search field that scopes both. Sits above a ticket composer, toggled
 * by the composer's "Reference interfaces" action.
 *
 * The host owns the data. Which kinds exist and what lives under one are questions only
 * the surrounding app can answer — the IDE lists them off the customer's live instance,
 * a story hands over fixtures — so this component takes `kinds` and the selected kind's
 * `items` and does the rest: selection, search, and turning a click into a reference.
 * Nothing here fetches; `kind` is the only contract, and the host maps it onto whatever
 * transport it has.
 *
 * Three rules the layout follows, in order of how often they bite:
 *
 * - Search filters the kind list down to what matches, and keeps ONE extra row: the
 *   selected kind, dimmed, when the query doesn't match it. That row is what stops the
 *   right-hand results outliving the kind they belong to — without it you'd see three
 *   interfaces and no way to tell what they were. Everything else goes, because a match
 *   that survives only by scrolling past nine dimmed rows isn't a match the user found.
 * - A picked interface STAYS in the list, selected. Dropping it on pick was a
 *   disappearing act with no undo inside the picker; now the row toggles.
 * - Below `STACK_BREAKPOINT` of its OWN width — not the viewport's, since this thing
 *   lives inside composers and drawers — the two panes collapse into one column and the
 *   selected kind's interfaces render directly beneath it. On a phone it goes further
 *   and lifts into a modal, because inline it would own the whole screen.
 */

/** How tall the panes get before they scroll: side by side, stacked, and in the modal. */
const COLUMNS_MAX_HEIGHT = '220px';
const STACKED_MAX_HEIGHT = '280px';
const MODAL_MAX_HEIGHT = '60vh';
const KIND_PANE_WIDTH = 150;
/** Container width (not viewport) below which the panes stack into one column. */
const STACK_BREAKPOINT = 420;
const BORDER = 'rgba(123, 104, 238, 0.25)';
/*
 * Marks the selected kind when the search doesn't match it — it's only still on the
 * list to say what the interfaces on the right are. Quiet, but pickable.
 */
const DIMMED_CLASS = 'reqore-reference-picker-dimmed';
/*
 * Marks an already-referenced row. Reqore paints `selected` purely through styled
 * props — no class, no aria state — so "is this row picked" is unobservable from the
 * outside without a marker of our own. Stable, so a host can style on it too.
 */
const PICKED_CLASS = 'reqore-reference-picker-picked';

/*
 * A scroll pane with the thin, unobtrusive scrollbar the Qonsole surfaces use
 * (transparent track, translucent rounded thumb) rather than the raw browser one.
 * webkit-only, like those surfaces: setting `scrollbar-width` as well would let
 * Chromium override this custom 6px with its own, wider, "thin".
 */
const Pane = styled.div<{ $right?: boolean; $maxHeight: string }>`
  ${({ $right }) =>
    $right
      ? 'flex: 1; min-width: 0;'
      : `width: ${KIND_PANE_WIDTH}px; flex: none; border-right: 1px solid ${BORDER};`}
  max-height: ${({ $maxHeight }) => $maxHeight};
  overflow-y: auto;
  padding: 4px;

  ${thinScrollbar}
`;

/** The stacked counterpart of `Pane` — one column, so one scroll region. */
const Stack = styled.div<{ $maxHeight: string }>`
  max-height: ${({ $maxHeight }) => $maxHeight};
  overflow-y: auto;
  padding: 4px;

  ${thinScrollbar}
`;

/*
 * The selected kind's interfaces once the panes have collapsed. The indent and the
 * rule are the only things left saying "these belong to the row above" — in the
 * two-pane layout the divider between the panes says it.
 */
const Nested = styled.div`
  margin: 2px 0 4px 10px;
  padding-left: 8px;
  border-left: 1px solid ${BORDER};
`;

const Frame = styled.div<{ $bare?: boolean }>`
  ${({ $bare }) => ($bare ? '' : `border: 1px solid ${BORDER}; border-radius: 8px;`)}
  overflow: hidden;

  /* Rows the search doesn't match. Set here rather than per row so the rule is
     stated once, and on the row itself (not a wrapper) so it can't disturb the
     menu's own flex layout. */
  .${DIMMED_CLASS} {
    opacity: 0.35;
  }
`;

const Panes = styled.div`
  display: flex;
`;

/*
 * An underline search field. The input itself is borderless (`flat transparent`) and
 * this wrapper carries the single bottom border, so the search reads as a line rather
 * than a full grey box — including on focus, where Reqore's default is a 2px outline
 * around the whole control. Suppressing that outline and brightening the underline
 * instead keeps a focus cue without the box. The selector is scoped under this wrapper,
 * so it outranks Reqore's without `!important`.
 *
 * `$active` (the field has a query) holds the underline at full accent, so a filtered
 * list is legible as filtered at a glance — the same signal `intent='info'` carries on
 * a plain filter control, spoken in this surface's own accent.
 */
const Search = styled.div<{ $accent: string; $active?: boolean }>`
  padding: 6px 4px 4px;
  border-bottom: 1px solid
    ${({ $accent, $active }) => ($active ? $accent : `${$accent}80`)};
  transition: border-color 0.15s ease-out;

  .reqore-control-wrapper:focus-within {
    outline: none;
  }
  &:focus-within {
    border-bottom-color: ${({ $accent }) => $accent};
  }
`;

const Note = styled.div`
  opacity: 0.4;
  padding: 8px 6px;
  font-size: 12px;
`;

const DEFAULT_ACCENT = '#762f7e';

/*
 * How a picked row reads: `info`, tinted rather than filled.
 *
 * Two Reqore details make this less obvious than `selected` + `intent`:
 *
 * - `selected` becomes `active` on the button, and the active branch paints a solid
 *   background from the intent while ignoring `minimal` and `transparent` outright.
 *   So `selected` can't be softened — it has to go, and `minimal` carries the state.
 * - `ReqoreMenuItem` sets `transparent` on every row, and `transparent` short-circuits
 *   `minimal`'s tint to nothing. Turning it off for picked rows is what lets the tint
 *   land, and it's only spread when the row IS picked — a `transparent: undefined` on
 *   the others would override the menu item's own default and flatten them all.
 *
 * The point of the tint: a solid blue bar is too much weight for "this one's already
 * in your list". The rows still up for choosing are what the user is reading, and they
 * should stay the loudest thing in the pane.
 */
const pickedItemProps = (isPicked: boolean) =>
  isPicked ? ({ intent: 'info', minimal: true, transparent: false } as const) : {};

/**
 * One interface in the list. A bare string is the name and nothing else — the common
 * case, and what a host that has only names can keep passing. The object form adds the
 * two things a name alone can't disambiguate: a `description` second line (what the
 * thing is for, an owning group, a path) and a `badge` (a version, a run count, a
 * status tag). Search reads both the name and the description, since both are on screen.
 */
export interface IReferencePickerItem {
  /** the interface name — this is what gets stored on the reference */
  name: string;
  /** a muted second line under the name */
  description?: string;
  /** trailing badge, before the add/remove icon */
  badge?: TReqoreBadge | TReqoreBadge[];
}

export type TReferencePickerItem = string | IReferencePickerItem;

/** `auto` picks `stacked` from the picker's own measured width. */
export type TReferencePickerLayout = 'auto' | 'columns' | 'stacked';
/** `auto` lifts into a modal on a phone-sized viewport, when `onClose` is given. */
export type TReferencePickerPresentation = 'auto' | 'inline' | 'modal';

export interface IReferencePickerProps {
  /** the interface kinds listed down the left pane */
  kinds: string[];
  /** the kind whose interfaces `items` holds */
  kind: string;
  onKindChange: (kind: string) => void;
  /**
   * The selected kind's interfaces — bare names, or objects carrying a description
   * and a badge. Fetching is the host's job; it knows where they come from and how
   * to cache them.
   */
  items: TReferencePickerItem[];
  /** `items` is still being fetched, so the right pane shows a spinner rather than
   *  claiming the kind is empty */
  loading?: boolean;
  /**
   * The host's fetch for this kind failed. Shown in place of the list, because an
   * empty pane would otherwise read as "this instance has no workflows" — which is a
   * different and much more alarming statement than "we couldn't ask".
   */
  error?: string;
  /** Retry the failed fetch. The error state is pressable when given. */
  onRetry?: () => void;
  /** Already-picked references. Anything of the current kind that is already picked
   *  renders selected in place — never removed from the list. */
  picked?: IInterfaceReference[];
  onAdd: (reference: IInterfaceReference) => void;
  /** Un-pick a reference from inside the picker. Without it a picked row still shows
   *  as picked, it just can't be toggled back off here. */
  onRemove?: (reference: IInterfaceReference) => void;
  /** the whole picker is inert (e.g. a reply is in flight) */
  disabled?: boolean;
  /** Per-kind icon. Consumers with their own icon vocabulary (the IDE) pass one; the
   *  built-in per-kind default is used when omitted. */
  resolveInterfaceIcon?: (kind: string) => IReqoreIconName;
  /**
   * Per-kind reading name — "Value maps" for `value-map`. The kind id is a wire value
   * and never reaches the user; this is what does. Search matches both, so typing
   * either the id or the label finds the kind. Defaults to the built-in Qorus
   * vocabulary.
   */
  resolveKindLabel?: (kind: string) => string;
  /** the underline / selected-kind colour. Defaults to the support surfaces' violet. */
  accent?: string;
  /** shown above the panes — the composer's picked-reference chips, typically */
  header?: ReactNode;
  /**
   * Dismiss the picker. Required for the modal presentation (a modal with no way out
   * is a trap); the inline presentation ignores it, since the host's own toggle is
   * what closes the picker there.
   */
  onClose?: () => void;
  /** Modal heading. */
  title?: string;
  /** How the panes arrange. `auto` (default) stacks below `STACK_BREAKPOINT` of the
   *  picker's own width; the explicit values are what stories pin. */
  layout?: TReferencePickerLayout;
  /** Where the picker renders. `auto` (default) goes to a modal on a phone-sized
   *  viewport when `onClose` is given, and stays inline otherwise. */
  presentation?: TReferencePickerPresentation;
}

/**
 * Watches an element's own width, because the viewport's is the wrong question for
 * anything that lives inside a composer, a drawer or a side panel — those stay narrow
 * on a 2560px screen. A callback ref rather than `useRef` so the observer attaches the
 * moment the node mounts; a ref that never gets attached silently reports "wide"
 * forever, which is exactly the bug this is meant to catch.
 */
const useIsNarrow = (enabled: boolean): [(node: HTMLDivElement | null) => void, boolean] => {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled || !node || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < STACK_BREAKPOINT);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [enabled, node]);

  return [setNode, narrow];
};

/** Phone-sized viewport. Its own media query rather than reqore's `isMobile`, which
 *  is pinned to `false` under NODE_ENV=test and so never fires in a story run. */
const usePhoneViewport = (enabled: boolean): boolean => {
  const [phone, setPhone] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const query = window.matchMedia('(max-width: 480px)');
    const sync = () => setPhone(query.matches);

    sync();
    query.addEventListener('change', sync);

    return () => query.removeEventListener('change', sync);
  }, [enabled]);

  return phone;
};

export const ReferencePicker = ({
  kinds,
  kind,
  onKindChange,
  items,
  loading,
  error,
  onRetry,
  picked,
  onAdd,
  onRemove,
  disabled,
  resolveInterfaceIcon = defaultInterfaceIcon,
  resolveKindLabel = defaultInterfaceKindLabel,
  accent = DEFAULT_ACCENT,
  header,
  onClose,
  title = 'Reference interfaces',
  layout = 'auto',
  presentation = 'auto',
}: IReferencePickerProps) => {
  const [query, setQuery] = useState<string>('');
  const needle = query.trim().toLowerCase();

  const [frameRef, narrow] = useIsNarrow(layout === 'auto');
  const phone = usePhoneViewport(presentation === 'auto');

  const asModal = presentation === 'modal' || (presentation === 'auto' && phone && !!onClose);
  const stacked = layout === 'stacked' || (layout === 'auto' && narrow);
  const label = resolveKindLabel(kind);

  /* A kind matches on its id or its reading name, so "value map" and `value-map`
   * both find it. */
  const matchesKind = useCallback(
    (candidate: string) =>
      !needle ||
      candidate.toLowerCase().includes(needle) ||
      resolveKindLabel(candidate).toLowerCase().includes(needle),
    [needle, resolveKindLabel]
  );

  /* The matches, plus the selected kind whether or not it matched — it keeps its
   * natural position rather than jumping to the top, so the list a user is reading
   * doesn't reorder under them mid-keystroke. */
  const visibleKinds = useMemo(
    () => kinds.filter((candidate) => candidate === kind || matchesKind(candidate)),
    [kinds, kind, matchesKind]
  );

  const pickedNames = useMemo(
    () =>
      new Set(
        (picked ?? [])
          .filter((reference) => reference.interface_kind === kind)
          .map((reference) => reference.interface_name)
      ),
    [picked, kind]
  );

  /** One shape from here down, whichever of the two the host passed. */
  const normalizedItems = useMemo(
    () => items.map((item) => (typeof item === 'string' ? { name: item } : item)),
    [items]
  );

  /*
   * The interfaces the search leaves standing. When the KIND itself matches
   * ("workflow"), its interfaces all stay — you searched for the kind, so you want to
   * see what's in it. Otherwise the name and the description are both fair game,
   * because both are text the user can see.
   */
  const visibleItems = useMemo(() => {
    const kindMatches = matchesKind(kind);

    return normalizedItems.filter(
      (item) =>
        !needle ||
        kindMatches ||
        item.name.toLowerCase().includes(needle) ||
        !!item.description?.toLowerCase().includes(needle)
    );
  }, [normalizedItems, kind, needle, matchesKind]);

  /* Drives the "…but other types do" hint: with the kind list now always on screen,
   * an empty result is only puzzling when the answer is sitting in another row. */
  const otherKindsMatch = useMemo(
    () => !!needle && kinds.some((candidate) => candidate !== kind && matchesKind(candidate)),
    [kinds, kind, needle, matchesKind]
  );

  const toggle = (name: string) => {
    const reference: IInterfaceReference = { interface_kind: kind, interface_name: name };

    if (pickedNames.has(name)) {
      onRemove?.(reference);
    } else {
      onAdd(reference);
    }
  };

  const emptyNote = () => {
    if (!needle) {
      return `No ${label.toLowerCase()} on this instance`;
    }

    return otherKindsMatch
      ? `No ${label.toLowerCase()} match “${query.trim()}” — other types do`
      : `Nothing matches “${query.trim()}”`;
  };

  /* Both panes are `ReqoreMenu`s of `ReqoreMenuItem`s — a vertical selectable list is
     exactly what Menu is, so the selection (`selected`), the left-icon + right-icon,
     and the item chrome come from reqore rather than hand-styled buttons. The wrappers
     still own the scroll and the layout; the menus render transparent inside them.
     Only menu items go inside a `ReqoreMenu`: it clones every child with its own props,
     so a spinner or a note nested in one would be handed props it can't take. */
  const kindItems = visibleKinds.map((option) => (
    <ReqoreMenuItem
      key={option}
      className={matchesKind(option) ? undefined : DIMMED_CLASS}
      icon={resolveInterfaceIcon(option)}
      label={resolveKindLabel(option)}
      selected={option === kind}
      disabled={disabled}
      onClick={() => onKindChange(option)}
    />
  ));

  const interfaces = (() => {
    if (error) {
      return (
        <ReqoreMenu transparent flat padded={false} width='100%' size='small'>
          <ReqoreMenuItem
            icon='ErrorWarningLine'
            rightIcon={onRetry ? 'RefreshLine' : undefined}
            intent='danger'
            label={`Couldn't load ${label.toLowerCase()}`}
            /* the specific failure is the tooltip — the pane states the outcome */
            tooltip={error}
            onClick={onRetry}
          />
        </ReqoreMenu>
      );
    }

    if (loading) {
      return (
        <ReqoreSpinner iconColor='info' size='small' centered>
          Loading {label.toLowerCase()}…
        </ReqoreSpinner>
      );
    }

    if (!visibleItems.length) {
      return <Note>{emptyNote()}</Note>;
    }

    return (
      <ReqoreMenu transparent flat padded={false} width='100%' size='small'>
        {visibleItems.map(({ name, description, badge }) => {
          const isPicked = pickedNames.has(name);
          const removable = isPicked && !!onRemove;

          return (
            <ReqoreMenuItem
              key={name}
              className={isPicked ? PICKED_CLASS : undefined}
              icon={resolveInterfaceIcon(kind)}
              rightIcon={isPicked ? 'CheckLine' : 'AddLine'}
              label={name}
              description={description}
              badge={badge}
              disabled={disabled}
              tooltip={
                isPicked
                  ? removable
                    ? `Remove “${name}”`
                    : `“${name}” is already referenced`
                  : `Reference “${name}”`
              }
              onClick={!isPicked || removable ? () => toggle(name) : undefined}
              {...pickedItemProps(isPicked)}
            />
          );
        })}
      </ReqoreMenu>
    );
  })();

  const maxHeight = asModal
    ? MODAL_MAX_HEIGHT
    : stacked
      ? STACKED_MAX_HEIGHT
      : COLUMNS_MAX_HEIGHT;

  /* Stacked: one column, with the selected kind's interfaces spliced in directly
     under its row. A kind the host hasn't listed puts them at the end rather than
     dropping them. */
  const selectedIndex = visibleKinds.indexOf(kind);
  const splitAt = selectedIndex === -1 ? visibleKinds.length : selectedIndex + 1;

  const body = (
    <Frame ref={frameRef} $bare={asModal}>
      {header}
      <Search $accent={accent} $active={!!needle}>
        <ReqoreInput
          value={query}
          onChange={(event) => setQuery((event.target as HTMLInputElement).value)}
          placeholder='Search types and interfaces…'
          icon='SearchLine'
          minimal
          flat
          transparent
          fluid
          disabled={disabled}
          onClearClick={query ? () => setQuery('') : undefined}
        />
      </Search>
      {stacked ? (
        <Stack $maxHeight={maxHeight}>
          <ReqoreMenu transparent flat padded={false} width='100%' size='small'>
            {kindItems.slice(0, splitAt)}
          </ReqoreMenu>
          <Nested>{interfaces}</Nested>
          {splitAt < kindItems.length ? (
            <ReqoreMenu transparent flat padded={false} width='100%' size='small'>
              {kindItems.slice(splitAt)}
            </ReqoreMenu>
          ) : null}
        </Stack>
      ) : (
        <Panes>
          <Pane $maxHeight={maxHeight}>
            <ReqoreMenu transparent flat padded={false} width='100%' size='small'>
              {kindItems}
            </ReqoreMenu>
          </Pane>
          <Pane $right $maxHeight={maxHeight}>
            {interfaces}
          </Pane>
        </Panes>
      )}
    </Frame>
  );

  if (!asModal) {
    return body;
  }

  return (
    <ReqoreModal isOpen icon='LinksLine' label={title} width='100%' blur={3} onClose={onClose}>
      {body}
    </ReqoreModal>
  );
};
