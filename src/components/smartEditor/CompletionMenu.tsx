// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreMenu, ReqoreMenuDivider, ReqoreMenuItem } from '@qoretechnologies/reqore';
import { ReqorePopover } from '@qoretechnologies/reqore/dist/components/Popover';
import { IReqoreTooltip } from '@qoretechnologies/reqore/dist/types/global';
import React, { memo, useCallback, useMemo } from 'react';
import { COMPLETION_ITEM_STYLE, COMPLETION_LIST_THEME, kindBadge } from './completionStyle';
import { MarkdownDoc } from './MarkdownDoc';
import { SMART_EDITOR_OVERLAY_EFFECT } from './styling';
import {
  ICompletionDropdownItem,
  ICompletionGroup,
  IUseLspAutocompleteResult,
} from './useLspAutocomplete';

/*
 * The one list an editor offers what can be written at its caret in (qorus#646, David: "use the same
 * components ... a consistent UX"): the language server's completion after a trigger, and the field's own
 * templates and fields when the editor is clicked, tapped or tabbed into. It is drawn at the caret, never takes
 * the focus - the editor keeps it and drives the list from its keys (see `useLspAutocomplete`) - and is a
 * listbox the editor points to (`aria-controls`), its rows options.
 */

// Kind chip + a Warning chip (Qonsole flags mutating verbs) for a
// completion row; undefined when neither applies.
function buildKindBadge(
  item: ICompletionDropdownItem
): Record<string, unknown> | Array<Record<string, unknown>> | undefined {
  const kindChip = item.kindLabel ? kindBadge(item.metadata?.kind) : undefined;
  const kindBadgeProps =
    kindChip ??
    (item.kindLabel ?
      { label: item.kindLabel, minimal: true as const, size: 'small' as const }
    : null);
  const warningBadge =
    item.warning ?
      {
        label: 'Warning',
        size: 'small' as const,
        intent: 'warning' as const,
        tooltip: item.warning,
      }
    : null;
  if (warningBadge && kindBadgeProps) return [kindBadgeProps, warningBadge];
  if (warningBadge) return [warningBadge];
  if (kindBadgeProps) return kindBadgeProps;
  return undefined;
}

// Tooltip prop rendering a row's LSP `documentation` (markdown/plaintext),
// or undefined when there is none.
function buildDocTooltip(item: ICompletionDropdownItem) {
  const doc = item.documentation;
  if (!doc) return undefined;
  const isMarkdown = typeof doc === 'object' && doc !== null && doc.kind === 'markdown';
  const text = typeof doc === 'string' ? doc : (doc?.value ?? '');
  if (!text) return undefined;
  return {
    content: <MarkdownDoc content={text} markdown={isMarkdown} />,
    placement: 'right' as const,
    delay: 200,
    // The cast covers popover props missing from the older tooltip type.
    flat: true,
    transparent: true,
    backgroundBlur: 20,
  } as IReqoreTooltip;
}

interface ICompletionMenuItemProps {
  item: ICompletionDropdownItem;
  isFocused: boolean;
  onSelect: (item: ICompletionDropdownItem) => void;
}

// Memoized completion row so badge/tooltip derivation runs once per item,
// not on every SmartEditor re-render.
const CompletionMenuItem = memo(({ item, isFocused, onSelect }: ICompletionMenuItemProps) => {
  const badge = useMemo(() => buildKindBadge(item), [item]);
  const tooltip = useMemo(() => buildDocTooltip(item), [item]);
  const handleClick = useCallback(() => onSelect(item), [onSelect, item]);

  return (
    <ReqoreMenuItem
      // one option of the list the editor controls (`aria-controls`), selected as the keyboard moves
      role='option'
      aria-selected={isFocused}
      icon={item.icon as any}
      label={item.label}
      description={item.description}
      badge={badge as any}
      tooltip={tooltip as any}
      selected={isFocused}
      active={isFocused}
      minimal
      scrollIntoView={isFocused}
      onClick={handleClick}
      compact
      style={COMPLETION_ITEM_STYLE}
    />
  );
});
CompletionMenuItem.displayName = 'CompletionMenuItem';

export interface ICompletionListProps {
  /** The listbox's id, for the control that drives it (`aria-controls`). */
  id: string;
  /** What is listed, in groups (see `groupCompletionItems`). */
  groups: ICompletionGroup[];
  /** The row the keyboard is on, counted across the groups. */
  focusedIndex: number;
  onSelect: (item: ICompletionDropdownItem) => void;
  /** Said in place of the rows while there are none: a loading or an empty list. */
  emptyLabel?: string;
}

/**
 * The list itself: its rows, its look and its roles, the same wherever it is opened - at an editor's caret
 * (`CompletionMenu`) or from a control (`TemplatePicker`).
 */
export const CompletionList = memo(
  ({ id, groups, focusedIndex, onSelect, emptyLabel }: ICompletionListProps) => {
    // Flatten groups into rows carrying a flat index to compare against
    // `focusedIndex` (which is flat across all groups).
    const completionGroups = useMemo(() => {
      let flatIndex = 0;
      return groups.map((group) => ({
        label: group.label,
        items: group.items.map((item) => ({ item, index: flatIndex++ })),
      }));
    }, [groups]);
    const handleSelect = useCallback((item: ICompletionDropdownItem) => onSelect(item), [onSelect]);
    return (
      <ReqoreMenu
        id={id}
        role='listbox'
        className='completion-menu'
        rounded
        flat
        maxHeight='300px'
        width='300px'
        effect={SMART_EDITOR_OVERLAY_EFFECT}
        customTheme={COMPLETION_LIST_THEME}
      >
        {completionGroups.length === 0 && emptyLabel ?
          <ReqoreMenuItem icon='LoaderLine' label={emptyLabel} disabled compact />
        : null}
        {completionGroups.map((group) => (
          <React.Fragment key={group.label || '_default'}>
            {group.label && (
              <ReqoreMenuDivider
                label={group.label}
                // @ts-expect-error — intent type not in older Reqore
                intent='muted'
              />
            )}
            {group.items.map(({ item, index }) => (
              <CompletionMenuItem
                key={item.value}
                item={item}
                isFocused={index === focusedIndex}
                onSelect={handleSelect}
              />
            ))}
          </React.Fragment>
        ))}
      </ReqoreMenu>
    );
  }
);
CompletionList.displayName = 'CompletionList';

/** How the list's popover is drawn: borderless, arrowless, the menu's own look. */
export const COMPLETION_POPOVER_PROPS = {
  noArrow: true,
  placement: 'bottom-start' as const,
  closeOnInsideClick: false,
  minWidth: '300px',
  flat: true,
  // Transparent so the popover wrapper doesn't frame the menu.
  transparent: true,
};

export interface ICompletionMenuProps {
  /** The editor's completion state: what is listed, where, and which row the keyboard is on. */
  autocomplete: IUseLspAutocompleteResult;
  /** The listbox's id, for the editor's `aria-controls`. */
  id: string;
  onSelect: (item: ICompletionDropdownItem) => void;
  /** Said while nothing can be listed yet (the session connecting); otherwise "Loading" or "No alternatives". */
  pendingLabel?: string;
}

/** The completion list at an editor's caret. */
export const CompletionMenu = memo(
  ({ autocomplete, id, onSelect, pendingLabel }: ICompletionMenuProps) => (
    <>
      {autocomplete.isOpen &&
        (autocomplete.items.length > 0 ||
          autocomplete.isReplaceMode ||
          autocomplete.isFetching) && (
          <ReqorePopover
            key={autocomplete.popoverKey}
            component='span'
            wrapperStyle={{
              // `fixed` anchor at the cursor's screen coords — avoids
              // parent-offset math.
              position: 'fixed',
              top: autocomplete.position.top,
              left: autocomplete.position.left,
              width: '1px',
              height: '1px',
              pointerEvents: 'none',
            }}
            content={
              <CompletionList
                id={id}
                groups={autocomplete.groups}
                focusedIndex={autocomplete.focusedIndex}
                onSelect={onSelect}
                emptyLabel={
                  autocomplete.isReplaceMode || autocomplete.isFetching ?
                    (pendingLabel ??
                    (autocomplete.isFetching ? 'Loading completions…' : (
                      'No alternatives available'
                    )))
                  : undefined
                }
              />
            }
            openOnMount
            handler='click'
            closeOnOutsideClick
            {...COMPLETION_POPOVER_PROPS}
            onToggleChange={autocomplete.handleExternalClose}
          />
        )}
    </>
  )
);
CompletionMenu.displayName = 'CompletionMenu';
