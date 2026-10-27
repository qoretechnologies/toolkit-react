// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreMenu, ReqoreMenuDivider, ReqoreMenuItem } from '@qoretechnologies/reqore';
import { ReqorePopover } from '@qoretechnologies/reqore/dist/components/Popover';
import { IReqoreTooltip } from '@qoretechnologies/reqore/dist/types/global';
import React, { memo, useCallback, useMemo } from 'react';
import { useCoarsePointer } from '../../hooks/useCoarsePointer';
import { COMPLETION_ITEM_STYLE, COMPLETION_LIST_THEME, kindBadge } from './completionStyle';
import { MarkdownDoc } from './MarkdownDoc';
import { SMART_EDITOR_OVERLAY_EFFECT } from './styling';
import {
  ICompletionDropdownItem,
  ICompletionGroup,
  IUseLspAutocompleteResult,
} from './useLspAutocomplete';
import type { ITemplateNode } from '../../helpers/templateTree';
import {
  TEMPLATE_PICKER_WIDTH,
  TemplatePicker,
  USE_WHOLE_STYLE,
  useWholeSays,
} from '../form/fields/template/TemplatePicker';

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
  /* A template row says what it is (State data, Context, Field) and its type, named: not the LSP kind it is sent
     as, which called every template a Variable (qorus#646, David's review). */
  const marks = (item.raw?.data ?? {}) as {
    kindLabel?: string;
    typeLabel?: string;
    browseAll?: boolean;
  };
  if (marks.kindLabel || marks.typeLabel) {
    return [
      ...(marks.kindLabel ?
        [
          {
            label: marks.kindLabel,
            minimal: true as const,
            size: 'small' as const,
            intent: 'info' as const,
          },
        ]
      : []),
      ...(marks.typeLabel ?
        [{ label: marks.typeLabel, minimal: true as const, size: 'small' as const }]
      : []),
    ];
  }
  if (marks.browseAll) {
    return undefined;
  }
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

/** A row's LSP `documentation` as text and whether it is markdown, or undefined when it has none. */
function docOf(item: ICompletionDropdownItem): { text: string; markdown: boolean } | undefined {
  const doc = item.documentation;
  if (!doc) return undefined;
  const markdown = typeof doc === 'object' && doc !== null && doc.kind === 'markdown';
  const text = typeof doc === 'string' ? doc : (doc?.value ?? '');
  return text ? { text, markdown } : undefined;
}

// Tooltip prop rendering a row's LSP `documentation` (markdown/plaintext),
// or undefined when there is none.
function buildDocTooltip(item: ICompletionDropdownItem) {
  const doc = docOf(item);
  if (!doc) return undefined;
  return {
    content: <MarkdownDoc content={doc.text} markdown={doc.markdown} />,
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
  /** The pointer is a finger: no hover, and every row with documentation offers its ⓘ. */
  coarse: boolean;
  /** Its documentation is shown under it. */
  docsShown: boolean;
  onToggleDocs?: (value: string) => void;
  /** The id of the documentation under it, for its ⓘ's `aria-controls`. */
  docsId: string;
}

/** A row's description: up to three lines, wrapped, never past the row (the reqraft row rule). */
const ROW_DESCRIPTION_STYLE: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
};

/* The ⓘ's press is not the editor's: the focus, and the caret with it, stay in the text. */
const keepTheFocus = (event: React.MouseEvent) => event.preventDefault();

// Memoized completion row so badge/tooltip derivation runs once per item,
// not on every SmartEditor re-render.
const CompletionMenuItem = memo(
  ({
    item,
    isFocused,
    onSelect,
    coarse,
    docsShown,
    onToggleDocs,
    docsId,
  }: ICompletionMenuItemProps) => {
    const badge = useMemo(() => buildKindBadge(item), [item]);
    const marks = (item.raw?.data ?? {}) as {
      opens?: boolean;
      browseAll?: boolean;
      takesWhole?: boolean;
      templateNodeId?: string;
    };
    /* A template's row says what it is under its name, with where it is: no hover over the row's edge, no ⓘ
       (qorus#646, David's review: the description floated over the row). */
    const isTemplate = marks.templateNodeId !== undefined;
    // a hover where a pointer can hover; a finger has the ⓘ
    const tooltip = useMemo(
      () => (coarse || isTemplate ? undefined : buildDocTooltip(item)),
      [item, coarse, isTemplate]
    );
    const handleClick = useCallback(() => onSelect(item), [onSelect, item]);
    // a group taken whole: written as the template it is, not opened
    const takeWhole = useCallback(
      () =>
        onSelect({
          ...item,
          raw: { ...item.raw, data: { ...(item.raw?.data ?? {}), opens: false } },
        }),
      [onSelect, item]
    );
    const hasDocs = !isTemplate && !!docOf(item);
    /* The ⓘ that shows the documentation under the row: on the row the keyboard is on, and on every row with
     documentation where the pointer is a finger, which cannot move the keyboard's row. Its press neither
     selects the row nor takes the focus from the text. */
    const docsToggle = useMemo(
      () =>
        hasDocs && onToggleDocs && (isFocused || coarse) ?
          {
            icon: 'InformationLine' as const,
            className: 'completion-docs-toggle',
            'aria-label': docsShown ? `Hide what ${item.label} is` : `Show what ${item.label} is`,
            'aria-expanded': docsShown,
            'aria-controls': docsId,
            onMouseDown: keepTheFocus,
            onClick: () => onToggleDocs(item.value),
            ...(coarse ? { style: { minWidth: 44, minHeight: 44 } } : {}),
          }
        : undefined,
      [hasDocs, onToggleDocs, isFocused, coarse, docsShown, docsId, item.label, item.value]
    );

    const useWhole = useMemo(
      () =>
        marks.takesWhole ?
          {
            label: 'Use',
            className: 'completion-use',
            'aria-label': `Use ${item.label}`,
            tooltip: coarse ? undefined : useWholeSays(item.label),
            compact: true,
            onMouseDown: keepTheFocus,
            onClick: takeWhole,
            style: { ...USE_WHOLE_STYLE, ...(coarse ? { minWidth: 44, minHeight: 44 } : {}) },
          }
        : undefined,
      [marks.takesWhole, item.label, takeWhole, coarse]
    );
    return (
      <ReqoreMenuItem
        // one option of the list the editor controls (`aria-controls`), selected as the keyboard moves
        role='option'
        aria-selected={isFocused}
        // what it is called, for a host or a test to find it by
        data-label={item.label}
        className={
          marks.browseAll ? 'completion-browse-all'
          : marks.opens ?
            'completion-opens'
          : undefined
        }
        icon={(marks.browseAll || marks.opens ? 'FolderOpenLine' : item.icon) as any}
        // a group opens the picker at its members
        rightIcon={marks.opens || marks.browseAll ? 'ArrowRightSLine' : undefined}
        label={item.label}
        description={
          item.description ?
            <span className='completion-row-description' style={ROW_DESCRIPTION_STYLE}>
              {item.description}
            </span>
          : undefined
        }
        badge={badge as any}
        // its name, badges and description wrap inside the row: none is cut off or drawn over its edge
        wrap
        tooltip={tooltip as any}
        selected={isFocused}
        active={isFocused}
        minimal
        scrollIntoView={isFocused}
        /* the press is not a move out of the text, as its ⓘ's is not: the editor, left, drew what was being typed
           as a chip (`$data:receive_order.`), and the row picked had nothing left to take the place of
           (qorus#646, David's review) */
        onMouseDown={keepTheFocus}
        onClick={handleClick}
        rightAction={(useWhole ?? docsToggle) as any}
        compact
        style={COMPLETION_ITEM_STYLE}
      />
    );
  }
);
CompletionMenuItem.displayName = 'CompletionMenuItem';

/** A row's documentation, under the row: what its ⓘ or Ctrl+Space shows. */
const CompletionDocs = memo(({ item, id }: { item: ICompletionDropdownItem; id: string }) => {
  const doc = docOf(item);
  return doc ?
      <div
        id={id}
        className='completion-docs'
        role='note'
        aria-label={`What ${item.label} is`}
        style={{ padding: '4px 8px 8px' }}
      >
        <MarkdownDoc content={doc.text} markdown={doc.markdown} maxWidth={284} maxHeight={220} />
      </div>
    : null;
});
CompletionDocs.displayName = 'CompletionDocs';

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
  /** The empty label is what the list says where nothing can be offered, not that it is waiting: an ⓘ, not a loader. */
  emptyIsMessage?: boolean;
  /** The row whose documentation is shown under it (its `value`). */
  docsFor?: string | null;
  /** Show or put away a row's documentation (see `IUseLspAutocompleteResult.toggleDocs`). */
  onToggleDocs?: (value: string) => void;
}

/**
 * The list itself: its rows, its look and its roles, the same wherever it is opened - at an editor's caret
 * (`CompletionMenu`) or from a control (`TemplatePicker`).
 */
export const CompletionList = memo(
  ({
    id,
    groups,
    focusedIndex,
    onSelect,
    emptyLabel,
    emptyIsMessage,
    docsFor,
    onToggleDocs,
  }: ICompletionListProps) => {
    const coarse = useCoarsePointer();
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
        width={TEMPLATE_PICKER_WIDTH}
        effect={SMART_EDITOR_OVERLAY_EFFECT}
        customTheme={COMPLETION_LIST_THEME}
      >
        {completionGroups.length === 0 && emptyLabel ?
          <ReqoreMenuItem
            icon={emptyIsMessage ? 'InformationLine' : 'LoaderLine'}
            label={emptyLabel}
            className={emptyIsMessage ? 'completion-empty-message' : undefined}
            disabled
            compact
            /* a message is read, not waited on: not dimmed as a row that cannot be picked is - dimmed, "No record
               fields here" was hard to read on the list (qorus#646) */
            style={emptyIsMessage ? { opacity: 1, cursor: 'default' } : undefined}
          />
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
              <React.Fragment key={item.value}>
                <CompletionMenuItem
                  item={item}
                  isFocused={index === focusedIndex}
                  onSelect={handleSelect}
                  coarse={coarse}
                  docsShown={docsFor === item.value}
                  onToggleDocs={onToggleDocs}
                  docsId={`${id}-docs-${index}`}
                />
                {docsFor === item.value ?
                  <CompletionDocs item={item} id={`${id}-docs-${index}`} />
                : null}
              </React.Fragment>
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
  /** The field's templates and fields, for the picker the list becomes where they are browsed (`browse`). */
  templateRoots?: ITemplateNode[];
}

/** The completion list at an editor's caret, or the template picker in its place. */
export const CompletionMenu = memo(
  ({ autocomplete, id, onSelect, pendingLabel, templateRoots }: ICompletionMenuProps) => (
    <>
      {autocomplete.isOpen && autocomplete.browse && templateRoots?.length ?
        <ReqorePopover
          key={`browse-${autocomplete.popoverKey}`}
          component='span'
          wrapperStyle={{
            position: 'fixed',
            top: autocomplete.position.top,
            left: autocomplete.position.left,
            width: '1px',
            height: '1px',
            pointerEvents: 'none',
          }}
          content={
            <TemplatePicker
              id={id}
              roots={templateRoots}
              levelId={autocomplete.browse.levelId}
              initialQuery={autocomplete.browse.query}
              selectedValue={autocomplete.browse.selectedValue}
              keysFromPage
              arrowsFromPage={autocomplete.browse.arrows}
              onPick={autocomplete.pickTemplate}
              onClose={autocomplete.close}
            />
          }
          openOnMount
          handler='click'
          closeOnOutsideClick
          {...COMPLETION_POPOVER_PROPS}
          minWidth={undefined}
          onToggleChange={(open: boolean) =>
            autocomplete.handleExternalClose(open, autocomplete.popoverKey)
          }
        />
      : null}
      {autocomplete.isOpen &&
        !autocomplete.browse &&
        (autocomplete.items.length > 0 ||
          autocomplete.isReplaceMode ||
          autocomplete.isFetching ||
          !!autocomplete.emptyMessage) && (
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
                docsFor={autocomplete.docsFor}
                onToggleDocs={autocomplete.toggleDocs}
                emptyIsMessage={!!autocomplete.emptyMessage && !autocomplete.isFetching}
                emptyLabel={
                  // what the list says where nothing can be offered: "No record fields here" (qorus#646)
                  autocomplete.emptyMessage && !autocomplete.isFetching ? autocomplete.emptyMessage
                  : autocomplete.isReplaceMode || autocomplete.isFetching ?
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
            // this popover's own key: the close of one a chip has replaced comes after the list opened there
            onToggleChange={(open: boolean) =>
              autocomplete.handleExternalClose(open, autocomplete.popoverKey)
            }
          />
        )}
    </>
  )
);
CompletionMenu.displayName = 'CompletionMenu';
