import { ReqoreInput, ReqoreMenu, ReqoreMenuItem, ReqoreSpinner } from '@qoretechnologies/reqore';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { ReactNode, useMemo, useState } from 'react';
import styled from 'styled-components';
import { thinScrollbar } from '../../helpers/scrollbar';
import { defaultInterfaceIcon, IInterfaceReference } from './meta';

/*
 * The two-pane interface browser: kinds down the left, the selected kind's interfaces
 * on the right, and one search field that scopes both. Sits above a ticket composer,
 * toggled by the composer's "Reference interfaces" action.
 *
 * The host owns the data. Which kinds exist and what lives under one are questions only
 * the surrounding app can answer — the IDE lists them off the customer's live instance,
 * a story hands over fixtures — so this component takes `kinds` and the selected kind's
 * `items` and does the rest: selection, search, and turning a click into a reference.
 */

/** How many interfaces the right pane shows before it scrolls. */
const PANE_MAX_HEIGHT = 180;
const KIND_PANE_WIDTH = 150;

/*
 * A scroll pane with the thin, unobtrusive scrollbar the Qonsole surfaces use
 * (transparent track, translucent rounded thumb) rather than the raw browser one.
 * webkit-only, like those surfaces: setting `scrollbar-width` as well would let
 * Chromium override this custom 6px with its own, wider, "thin".
 */
const Pane = styled.div<{ $right?: boolean }>`
  ${({ $right }) =>
    $right
      ? 'flex: 1; min-width: 0;'
      : `width: ${KIND_PANE_WIDTH}px; flex: none; border-right: 1px solid rgba(123, 104, 238, 0.25);`}
  max-height: ${PANE_MAX_HEIGHT}px;
  overflow-y: auto;
  padding: 4px;

  ${thinScrollbar}
`;

const Frame = styled.div`
  border: 1px solid rgba(123, 104, 238, 0.25);
  border-radius: 8px;
  overflow: hidden;
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
 */
const Search = styled.div<{ $accent: string }>`
  padding: 6px 4px 4px;
  border-bottom: 1px solid ${({ $accent }) => `${$accent}80`};
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

export interface IReferencePickerProps {
  /** the interface kinds listed down the left pane */
  kinds: string[];
  /** the kind whose interfaces `items` holds */
  kind: string;
  onKindChange: (kind: string) => void;
  /**
   * The selected kind's interfaces, by name. Fetching is the host's job — it knows
   * where they come from and how to cache them.
   */
  items: string[];
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
  /** Already-picked references. Anything of the current kind that is already picked is
   *  dropped from the right pane, so a reference can't be added twice. */
  picked?: IInterfaceReference[];
  onAdd: (reference: IInterfaceReference) => void;
  /** the whole picker is inert (e.g. a reply is in flight) */
  disabled?: boolean;
  /** Per-kind icon. Consumers with their own icon vocabulary (the IDE) pass one; the
   *  built-in per-kind default is used when omitted. */
  resolveInterfaceIcon?: (kind: string) => IReqoreIconName;
  /** the underline / selected-kind colour. Defaults to the support surfaces' violet. */
  accent?: string;
  /** shown above the panes — the composer's picked-reference chips, typically */
  header?: ReactNode;
}

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
  disabled,
  resolveInterfaceIcon = defaultInterfaceIcon,
  accent = DEFAULT_ACCENT,
  header,
}: IReferencePickerProps) => {
  const [query, setQuery] = useState<string>('');
  const needle = query.trim().toLowerCase();

  const visibleKinds = useMemo(
    () => (needle ? kinds.filter((k) => k.toLowerCase().includes(needle)) : kinds),
    [kinds, needle]
  );

  /*
   * The right pane drops what's already been picked and then applies the search. When
   * the KIND itself matches the search ("workflow"), its interfaces all stay — you
   * searched for the kind, so you want to see what's in it.
   */
  const visibleItems = useMemo(() => {
    const already = new Set(
      (picked ?? [])
        .filter((reference) => reference.interface_kind === kind)
        .map((reference) => reference.interface_name)
    );
    const kindMatches = kind.toLowerCase().includes(needle);
    return items.filter(
      (name) =>
        !already.has(name) && (!needle || kindMatches || name.toLowerCase().includes(needle))
    );
  }, [items, picked, kind, needle]);

  return (
    <Frame>
      {header}
      <Search $accent={accent}>
        <ReqoreInput
          value={query}
          onChange={(event) => setQuery((event.target as HTMLInputElement).value)}
          placeholder='Search kinds and interfaces…'
          icon='SearchLine'
          minimal
          flat
          transparent
          fluid
          disabled={disabled}
          onClearClick={query ? () => setQuery('') : undefined}
        />
      </Search>
      <Panes>
        {/* Both panes are `ReqoreMenu`s of `ReqoreMenuItem`s — a vertical selectable
            list is exactly what Menu is, so the selection (`selected`), the left-icon +
            right-icon, and the item chrome come from reqore rather than hand-styled
            buttons. The Pane wrapper still owns the scroll (fixed/flex width +
            thinScrollbar); the menus render transparent inside it. */}
        <Pane>
          {visibleKinds.length ? (
            <ReqoreMenu transparent flat padded={false} width='100%' size='small'>
              {visibleKinds.map((option) => (
                <ReqoreMenuItem
                  key={option}
                  icon={resolveInterfaceIcon(option)}
                  label={option}
                  selected={option === kind}
                  disabled={disabled}
                  onClick={() => onKindChange(option)}
                />
              ))}
            </ReqoreMenu>
          ) : (
            <Note>No kinds</Note>
          )}
        </Pane>
        <Pane $right>
          {error ? (
            <ReqoreMenu transparent flat padded={false} width='100%' size='small'>
              <ReqoreMenuItem
                icon='ErrorWarningLine'
                rightIcon={onRetry ? 'RefreshLine' : undefined}
                intent='danger'
                label={`Couldn't load ${kind}s`}
                /* the specific failure is the tooltip — the pane states the outcome */
                tooltip={error}
                onClick={onRetry}
              />
            </ReqoreMenu>
          ) : loading ? (
            <ReqoreSpinner iconColor='info' size='small' centered>
              Loading {kind}s…
            </ReqoreSpinner>
          ) : visibleItems.length ? (
            <ReqoreMenu transparent flat padded={false} width='100%' size='small'>
              {visibleItems.map((name) => (
                <ReqoreMenuItem
                  key={name}
                  icon={resolveInterfaceIcon(kind)}
                  rightIcon='AddLine'
                  label={name}
                  disabled={disabled}
                  tooltip={`Reference ${kind} ${name}`}
                  onClick={() => onAdd({ interface_kind: kind, interface_name: name })}
                />
              ))}
            </ReqoreMenu>
          ) : (
            <Note>No matching {kind}</Note>
          )}
        </Pane>
      </Panes>
    </Frame>
  );
};
