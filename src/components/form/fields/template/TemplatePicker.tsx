// Copyright 2026 Qore Technologies, s.r.o.
import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreInput,
  ReqoreMenu,
  ReqoreMenuItem,
  ReqoreP,
} from '@qoretechnologies/reqore';
import { TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import React, { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useCoarsePointer } from '../../../../hooks/useCoarsePointer';
import { TTypeLabel } from '../../../../helpers/qorusTypeCatalogue';
import {
  ITemplateNode,
  loadTemplateChildren,
  searchTemplateTree,
  TEMPLATE_NODE_KIND_LABELS,
  templateNodeById,
  templateNodeIntent,
  templateNodeFor,
  unbracedReference,
} from '../../../../helpers/templateTree';
import { COMPLETION_ITEM_STYLE, COMPLETION_LIST_THEME } from '../../../smartEditor/completionStyle';
import { SMART_EDITOR_OVERLAY_EFFECT } from '../../../smartEditor/styling';
import { useTypeLabel } from '../../typeSentenceForm';
import {
  TMarkdownRenderer,
  useMarkdownRenderer,
} from '../../../Description/markdownRendererContext';
import { markdownToProse } from '../../../../helpers/markdownText';

/*
 * The one picker a field's templates are chosen in (qorus#646, David's decisions): a rich-text field's, a DPQL
 * field's and a template control's alike, at the caret or from a button. A catalogue is browsed level by level -
 * a Qog state, a record in it - with the way back above the rows ("Templates › Receive order › Customer"); a
 * search finds a template at any depth by its name, or by its reference as it is typed (`$data:receive_order.`),
 * and says where each one it finds is. A group is opened, and one that is a value too (a record) is also taken
 * whole ("Use"). A template that stands for a hash of any keys (`$dynamic:*`) has its key written. Nothing is
 * listed flat: a level is paged.
 */

/** How many rows a level shows before "Show more". */
export const TEMPLATE_PICKER_PAGE = 50;

/** How wide the picker is: as the completion list, and never wider than a phone's screen with its margins. */
export const TEMPLATE_PICKER_WIDTH = 'min(360px, calc(100vw - 32px))';

export interface ITemplatePickerProps {
  /** What can be chosen: the field's templates and fields (`templateTree`). */
  roots: ITemplateNode[];
  /** The group it opens at (`ITemplateNode.id`): the group of a chip being replaced, or one chosen while typing. */
  levelId?: string;
  /** What it opens with in its search box: a reference being typed where it was opened. */
  initialQuery?: string;
  /** The value already chosen (a chip being replaced): its row is the one the keyboard starts on. */
  selectedValue?: string;
  /**
   * A node was chosen. `written` is what is written for it where that is not its value: a template of any keys
   * with its key (`$dynamic:order.id`).
   */
  onPick: (node: ITemplateNode, written?: string) => void;
  /** Escape: put the picker away. */
  onClose?: () => void;
  /** Its search box takes the keyboard when it opens - from a button, where typing has nowhere else to go. */
  focusFilter?: boolean;
  /**
   * The keys that move through the rows are heard from the page while the focus is elsewhere - in the text the
   * picker was opened from, which keeps the caret: the arrows, Enter, Escape and Tab.
   */
  keysFromPage?: boolean;
  /**
   * With `keysFromPage`: the text the picker was opened from is empty, so its caret has nowhere to go - ← and
   * Backspace go back a level, → opens a group, as they do in the picker's own search box.
   */
  arrowsFromPage?: boolean;
  /**
   * Fills the surface it is drawn in (a dropdown's popover, as wide as its field within the popover's bounds)
   * instead of keeping its own width, which left the popover's far side empty (qorus#646, David's review).
   */
  fill?: boolean;
  /** The listbox's id, for the control that drives it (`aria-controls`). */
  id: string;
  /** How a type is named; the surrounding form's catalogue's when not given. */
  typeLabel?: TTypeLabel;
}

const kindIcon = (node: ITemplateNode, isGroup: boolean): IReqoreIconName =>
  isGroup ? 'FolderOpenLine'
  : node.kind === 'field' ? 'Database2Line'
  : 'ExchangeDollarLine';

const isGroup = (node: ITemplateNode) => !!node.children?.length || !!node.loadChildren;

/** The press is not a move out of the text the picker was opened from: the caret stays where the pick goes. */
const keepTheFocus = (event: React.MouseEvent) => event.preventDefault();

/**
 * A row's badges: what it is (State data, Context, Field...) and its type, named; a group's app, as its catalogue
 * badges it (the app it comes from, never a type: qorus#646, 8909de2f).
 */
const rowBadges = (node: ITemplateNode, typeLabel: TTypeLabel): TReqoreBadge[] => {
  const kind = TEMPLATE_NODE_KIND_LABELS[node.kind];
  const type = node.type ? typeLabel(node.type, node.baseType) : undefined;
  const app = !node.row?.value && typeof node.row?.badge === 'string' ? node.row.badge : undefined;
  return [
    ...(app ? [{ label: app, minimal: true, size: 'small' as const }] : []),
    ...(kind ?
      // what it is, in its chip's color (`TEMPLATE_INTENT_MEANINGS`)
      [{ label: kind, minimal: true, size: 'small' as const, intent: templateNodeIntent(node) }]
    : []),
    ...(type ? [{ label: type, minimal: true, size: 'small' as const }] : []),
  ] as TReqoreBadge[];
};

/**
 * What a row says under its name: where it is, when it is found by a search ("in Receive order › Customer"), and
 * what it is, in its own words; where it comes from, as its host says, after that. Where it is and what it is are
 * drawn apart, so that a group's name is never read as a description of the row (qorus#646, David's review: each
 * state's data said "Receive order" as if it were what it is).
 */
const RowDescription = ({
  node,
  showWhere,
  renderMarkdown,
}: {
  node: ITemplateNode;
  showWhere: boolean;
  renderMarkdown?: TMarkdownRenderer;
}) => {
  const where = showWhere && node.trail.length ? node.trail.join(' › ') : undefined;
  if (!where && !node.description && !node.source) {
    return null;
  }
  return (
    <span className='template-picker-row-description' style={{ display: 'block' }}>
      {where ?
        <span className='template-picker-row-where' style={{ display: 'block', opacity: 0.7 }}>
          in {where}
        </span>
      : null}
      {node.description ?
        <span className='template-picker-row-what' style={ROW_WHAT_STYLE}>
          {/* prose, written in markdown: drawn by the host's renderer, as a row is a compact container; else its words */}
          {renderMarkdown ?
            renderMarkdown({ value: node.description, compact: true })
          : markdownToProse(node.description)}
        </span>
      : null}
      {node.source ?
        <span className='template-picker-row-source' style={{ display: 'block', opacity: 0.7 }}>
          from {node.source}
        </span>
      : null}
    </span>
  );
};

/**
 * "Use" beside a group's ">" (qorus#646, David's review): set apart from the ">" that opens the group by a divider,
 * and saying on hover that it takes the group whole.
 */
export const USE_WHOLE_STYLE: React.CSSProperties = {
  borderLeft: '1px solid color-mix(in srgb, currentColor 35%, transparent)',
  marginLeft: 4,
};

/** What "Use" beside a group says on hover. */
export const useWholeSays = (label: string) => `Use the whole record: all of ${label} as one value`;

/** What a row says it is: up to three lines, wrapped, never past the row (the reqraft row rule). */
const ROW_WHAT_STYLE: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
};

/** The ids of the groups from the top to `node`, `node` included: the levels opened to show its members. */
const levelsTo = (roots: ITemplateNode[], levelId?: string): string[] => {
  /* A lone group that is a value of its own (a Qog state's data taken whole) is opened, as a lone group is
     (`templateTree`): its members are what there is to choose from, and up from them is the group, to take whole. */
  const node =
    templateNodeById(roots, levelId) ??
    (levelId === undefined && roots.length === 1 && isGroup(roots[0]) ? roots[0] : undefined);
  return node ? [...node.trailIds, node.id] : [];
};

export const TemplatePicker = memo(
  ({
    roots,
    levelId,
    initialQuery,
    selectedValue,
    onPick,
    onClose,
    focusFilter,
    keysFromPage,
    arrowsFromPage,
    fill,
    id,
    typeLabel: givenTypeLabel,
  }: ITemplatePickerProps) => {
    const coarse = useCoarsePointer();
    const formTypeLabel = useTypeLabel();
    const typeLabel = givenTypeLabel ?? formTypeLabel;
    const renderMarkdown = useMarkdownRenderer();
    const rootRef = useRef<HTMLDivElement>(null);
    // a host's members come when they are asked for: the rows are drawn again when they have come
    const [, membersCame] = useReducer((count: number) => count + 1, 0);
    const [loading, setLoading] = useState<string | null>(null);
    const [levels, setLevels] = useState<string[]>(() => levelsTo(roots, levelId));
    const [query, setQuery] = useState(initialQuery ?? '');
    const [everywhere, setEverywhere] = useState(false);
    const [shown, setShown] = useState(TEMPLATE_PICKER_PAGE);
    const [focused, setFocused] = useState(0);
    const [keyFor, setKeyFor] = useState<ITemplateNode | null>(null);
    const [keyText, setKeyText] = useState('');
    // the key's box, which takes the keyboard in the event that shows it (`pick`)
    const keyBoxRef = useRef<HTMLDivElement>(null);

    /* Opened at another group (a chip of another state replaced): that group. The same picker given more of the
       field's templates as they come (its catalogue, its language server's completions) stays where it is browsed
       to, the row it is on still the row it is on: put back at the top, the keys pressed while they came went to
       other rows than the ones the user saw (qorus#646). */
    const levelIdRef = useRef(levelId);
    useEffect(() => {
      setLevels((current) => {
        const sameOpening = levelIdRef.current === levelId;
        levelIdRef.current = levelId;
        const opening = levelsTo(roots, levelId);
        // the group it was opened at, come only now, is opened
        return (
            sameOpening &&
              current.every((id) => !!templateNodeById(roots, id)) &&
              (current.length > 0 || !opening.length)
          ) ?
            current
          : opening;
      });
    }, [roots, levelId]);

    const level = levels.length ? templateNodeById(roots, levels[levels.length - 1]) : undefined;

    // a group whose members its host gives only when asked: asked for, once, when it is opened
    useEffect(() => {
      if (!level || level.children || !level.loadChildren) return undefined;
      let current = true;
      setLoading(level.id);
      loadTemplateChildren(level)
        .catch(() => [])
        .finally(() => {
          if (current) {
            setLoading(null);
            membersCame();
          }
        });
      return () => {
        current = false;
      };
    }, [level]);

    /* A reference typed into a group whose members come only when asked (`$data:lookup_customer.`): its members
       are asked for, so that the search can go into them. */
    useEffect(() => {
      const wanted =
        /^[$@]/.test(query.trim()) ? unbracedReference(query.trim()).toLowerCase() : '';
      if (!wanted) return undefined;
      const waiting: ITemplateNode[] = [];
      const walk = (nodes: ITemplateNode[] | undefined) => {
        for (const node of nodes ?? []) {
          const reference = node.reference?.toLowerCase();
          if (reference && !wanted.startsWith(`${reference}.`)) continue;
          if (!node.children && node.loadChildren) waiting.push(node);
          walk(node.children);
        }
      };
      walk(roots);
      if (!waiting.length) return undefined;
      let current = true;
      void Promise.all(waiting.map((node) => loadTemplateChildren(node).catch(() => []))).then(
        () => {
          if (current) membersCame();
        }
      );
      return () => {
        current = false;
      };
    }, [query, roots]);

    const rows = useMemo(
      () =>
        query.trim() ?
          searchTemplateTree(roots, query, everywhere ? undefined : level)
        : (level?.children ?? roots),
      // `membersCame`: a group's members, once they have come, are its members
      [roots, query, everywhere, level, level?.children]
    );
    const visible = rows.slice(0, shown);

    // a new level or search starts at its top, or at the value already chosen
    useEffect(() => {
      setShown(TEMPLATE_PICKER_PAGE);
      const chosen = selectedValue ? templateNodeFor(visible, selectedValue) : undefined;
      const at = chosen ? visible.indexOf(chosen) : -1;
      setFocused(at >= 0 ? at : 0);
    }, [levels, query, everywhere]);

    const open = useCallback((node: ITemplateNode) => {
      setLevels([...node.trailIds, node.id]);
      setQuery('');
      setEverywhere(false);
      setKeyFor(null);
    }, []);

    const up = useCallback(() => {
      setLevels((current) => current.slice(0, -1));
      setQuery('');
      setKeyFor(null);
    }, []);

    const pick = useCallback(
      (node: ITemplateNode) => {
        if (node.disabled) return;
        if (node.writesKey) {
          // drawn now, in the event that asked for it, so that its box takes the keyboard in it too
          flushSync(() => {
            setKeyFor(node);
            setKeyText('');
          });
          keyBoxRef.current?.querySelector<HTMLInputElement>('input')?.focus();
          return;
        }
        onPick(node);
      },
      [onPick]
    );

    /** A row taken: a group is opened, anything else chosen. */
    const take = useCallback(
      (node: ITemplateNode) => (isGroup(node) ? open(node) : pick(node)),
      [open, pick]
    );

    const writeKey = useCallback(() => {
      const key = keyText.trim();
      if (!keyFor || !key) return;
      // after the context's `:` (`$dynamic:*` → `$dynamic:order.id`; `$rest:` → `$rest:system/status`)
      onPick(keyFor, `${keyFor.value?.replace(/\*$/, '') ?? keyFor.reference ?? ''}${key}`);
    }, [keyFor, keyText, onPick]);

    /** The keys the rows are moved through with, wherever they are heard. Returns whether the key was taken. */
    const handleKey = useCallback(
      (event: KeyboardEvent | React.KeyboardEvent, fromText: boolean): boolean => {
        // from a text whose caret has somewhere to go, the arrows and Backspace are the text's
        const fromPage = fromText && !arrowsFromPage;
        const inSearchBox = (event.target as HTMLElement)?.tagName === 'INPUT';
        const count = visible.length + (rows.length > shown ? 1 : 0);
        switch (event.key) {
          case 'ArrowDown':
            setFocused((at) => Math.min(at + 1, Math.max(0, count - 1)));
            return true;
          case 'ArrowUp':
            setFocused((at) => Math.max(at - 1, 0));
            return true;
          case 'Enter': {
            if (focused === visible.length && rows.length > shown) {
              setShown((current) => current + TEMPLATE_PICKER_PAGE);
              return true;
            }
            const node = visible[focused];
            if (node) take(node);
            return true;
          }
          case 'ArrowRight': {
            // in the text or the search box, the arrow moves the caret, unless the search box is at its end
            if (
              fromPage ||
              (inSearchBox && (event.target as HTMLInputElement).selectionStart < query.length)
            ) {
              return false;
            }
            const node = visible[focused];
            if (node && isGroup(node)) {
              open(node);
              return true;
            }
            return false;
          }
          case 'ArrowLeft':
          case 'Backspace':
            if (fromPage || query || !levels.length) return false;
            up();
            return true;
          case 'Escape':
            if (keyFor) {
              setKeyFor(null);
              return true;
            }
            onClose?.();
            return true;
          case 'Tab': {
            /* From the text it was opened in, Tab takes the row the keyboard is on, as Enter does (a code editor's
               key): the text keeps the focus (qorus#646, David's review: Tab left the half-typed reference as it
               was). From its own search box the focus moves on, and nothing is chosen. */
            if (fromText && !keyFor) {
              const node = visible[focused];
              if (node) {
                take(node);
                return true;
              }
            }
            onClose?.();
            return false;
          }
          default:
            return false;
        }
      },
      [
        visible,
        rows.length,
        shown,
        focused,
        take,
        open,
        up,
        query,
        levels.length,
        keyFor,
        onClose,
        arrowsFromPage,
      ]
    );

    // heard from the page while the text the picker was opened from keeps the focus
    const handleKeyRef = useRef(handleKey);
    handleKeyRef.current = handleKey;
    useEffect(() => {
      if (!keysFromPage) return undefined;
      const listener = (event: KeyboardEvent) => {
        // a key in the picker itself (its search box) is the picker's own
        if (rootRef.current?.contains(event.target as Node)) return;
        const keys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
        if (arrowsFromPage) keys.push('ArrowLeft', 'ArrowRight', 'Backspace');
        if (!keys.includes(event.key)) return;
        if (handleKeyRef.current(event, true)) {
          event.preventDefault();
          event.stopPropagation();
        }
      };
      document.addEventListener('keydown', listener, true);
      return () => document.removeEventListener('keydown', listener, true);
    }, [keysFromPage, arrowsFromPage]);

    const crumbs = useMemo(
      () => levels.map((levelId) => templateNodeById(roots, levelId)).filter(Boolean),
      [levels, roots]
    );
    // on a phone the way back says only where it is and the group above it
    const crumbsShown = coarse && crumbs.length > 2 ? crumbs.slice(-1) : crumbs;
    const crumbsHidden = crumbs.length - crumbsShown.length;
    const isReference = /^[$@]/.test(query.trim());
    const optionId = (index: number) => `${id}-option-${index}`;

    return (
      <div
        ref={rootRef}
        className='template-picker'
        style={{ width: fill ? '100%' : TEMPLATE_PICKER_WIDTH, maxWidth: '100%' }}
        onKeyDown={(event) => {
          if (keyFor && (event.target as HTMLElement)?.tagName === 'INPUT') return;
          if (handleKey(event, false)) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        // a press anywhere in the picker but its search box leaves the focus where it was: in the text
        onMouseDown={(event) => {
          if (keysFromPage && (event.target as HTMLElement)?.tagName !== 'INPUT')
            keepTheFocus(event);
        }}
      >
        <ReqoreControlGroup vertical fluid size='small' customTheme={COMPLETION_LIST_THEME}>
          <ReqoreControlGroup
            fluid
            wrap
            size='small'
            className='template-picker-crumbs'
            role='navigation'
            aria-label='Where you are in the templates'
          >
            {levels.length ?
              <ReqoreButton
                className='template-picker-back'
                icon='ArrowLeftSLine'
                fixed
                compact
                minimal
                flat
                aria-label='Back'
                tooltip={coarse ? undefined : 'Back'}
                onClick={up}
              />
            : null}
            <ReqoreButton
              className='template-picker-crumb'
              compact
              minimal
              flat
              fixed
              active={!levels.length}
              onClick={() => {
                setLevels([]);
                setQuery('');
              }}
            >
              Templates
            </ReqoreButton>
            {crumbsHidden ?
              <ReqoreButton
                compact
                minimal
                flat
                fixed
                readOnly
                className='template-picker-crumb-hidden'
              >
                › …
              </ReqoreButton>
            : null}
            {crumbsShown.map((crumb) => (
              <ReqoreButton
                key={crumb.id}
                className='template-picker-crumb'
                compact
                minimal
                flat
                fixed
                active={crumb.id === levels[levels.length - 1]}
                onClick={() => {
                  setLevels(levels.slice(0, levels.indexOf(crumb.id) + 1));
                  setQuery('');
                }}
              >
                {`› ${crumb.label}`}
              </ReqoreButton>
            ))}
          </ReqoreControlGroup>
          <ReqoreInput
            className='template-picker-search'
            icon='SearchLine'
            placeholder={level ? `Search in ${level.label}` : 'Search templates'}
            aria-label={level ? `Search in ${level.label}` : 'Search templates'}
            aria-controls={id}
            aria-activedescendant={visible.length ? optionId(focused) : undefined}
            value={query}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            onClearClick={query ? () => setQuery('') : undefined}
            // not on a touch screen: its keyboard would come up over the rows a finger is there to tap
            focusRules={focusFilter && !coarse ? { type: 'auto' } : undefined}
            minimal
            fluid
          />
          {level && query.trim() && !isReference ?
            <ReqoreButton
              className='template-picker-scope'
              compact
              minimal
              flat
              icon={everywhere ? 'FolderOpenLine' : 'GlobalLine'}
              onClick={() => setEverywhere((current) => !current)}
            >
              {everywhere ? `Only in ${level.label}` : 'Search everywhere'}
            </ReqoreButton>
          : null}
        </ReqoreControlGroup>
        {keyFor ?
          <ReqoreControlGroup
            vertical
            fluid
            size='small'
            className='template-picker-key'
            ref={keyBoxRef}
          >
            <ReqoreP size='small'>
              {
                // a context whose argument has a format of its own says it (`$rest:` <URI path>[.<key>...])
                keyFor.catalogue?.arg_format && !keyFor.catalogue.free_form_keys ?
                  `Write what ${keyFor.label} reads: ${keyFor.catalogue.arg_format}.`
                : `${keyFor.label} holds any keys: write the key to use (a path: order.id).`
              }
            </ReqoreP>
            <ReqoreControlGroup fluid size='small'>
              <ReqoreInput
                className='template-picker-key-input'
                aria-label={`Key in ${keyFor.label}`}
                placeholder={
                  keyFor.catalogue?.arg_format && !keyFor.catalogue.free_form_keys ? '' : 'order.id'
                }
                value={keyText}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setKeyText(event.target.value)
                }
                onKeyDown={(event: React.KeyboardEvent) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    writeKey();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    setKeyFor(null);
                  }
                }}
                fluid
              />
              <ReqoreButton
                fixed
                compact
                intent='info'
                disabled={!keyText.trim()}
                onClick={writeKey}
              >
                Use
              </ReqoreButton>
            </ReqoreControlGroup>
          </ReqoreControlGroup>
        : null}
        <ReqoreMenu
          id={id}
          role='listbox'
          aria-label={level ? level.label : 'Templates'}
          className='template-picker-list'
          rounded
          flat
          maxHeight='300px'
          width='100%'
          effect={SMART_EDITOR_OVERLAY_EFFECT}
          customTheme={COMPLETION_LIST_THEME}
        >
          {!visible.length ?
            <ReqoreMenuItem
              icon={loading ? 'LoaderLine' : 'InformationLine'}
              label={
                loading ? 'Loading…'
                : query.trim() ?
                  `No template matches "${query.trim()}"`
                : 'Nothing here'
              }
              className='template-picker-empty'
              disabled
              compact
              style={{ opacity: 1, cursor: 'default' }}
            />
          : null}
          {visible.map((node, index) => {
            const group = isGroup(node);
            return (
              <ReqoreMenuItem
                key={node.id}
                id={optionId(index)}
                role='option'
                aria-selected={index === focused}
                className={`template-picker-row${group ? ' template-picker-group' : ''}`}
                data-value={node.value}
                data-label={node.label}
                icon={kindIcon(node, group)}
                leftIconProps={
                  node.row?.metadata?.image ?
                    { image: node.row.metadata.image as string }
                  : undefined
                }
                label={node.label}
                description={
                  <RowDescription
                    node={node}
                    showWhere={!!query.trim()}
                    renderMarkdown={renderMarkdown}
                  />
                }
                badge={rowBadges(node, typeLabel) as any}
                // a group opens; a context only the server knows goes on into what is in it as it is typed
                rightIcon={group || node.continues ? 'ArrowRightSLine' : undefined}
                selected={index === focused}
                active={index === focused}
                disabled={node.disabled}
                scrollIntoView={index === focused}
                minimal
                compact
                wrap
                onMouseDown={keysFromPage ? keepTheFocus : undefined}
                onClick={() => take(node)}
                rightAction={
                  (group || node.continues) && node.takesWhole ?
                    ({
                      label: 'Use',
                      className: 'template-picker-use',
                      'aria-label': `Use ${node.label}`,
                      tooltip: coarse ? undefined : useWholeSays(node.label),
                      compact: true,
                      onMouseDown: keysFromPage ? keepTheFocus : undefined,
                      // the whole of it: its value, not gone on into
                      onClick: () => onPick(node, node.value),
                      style: {
                        ...USE_WHOLE_STYLE,
                        ...(coarse ? { minWidth: 44, minHeight: 44 } : {}),
                      },
                    } as any)
                  : undefined
                }
                style={{ ...COMPLETION_ITEM_STYLE, ...(coarse ? { minHeight: 44 } : {}) }}
              />
            );
          })}
          {rows.length > shown ?
            <ReqoreMenuItem
              id={optionId(visible.length)}
              role='option'
              aria-selected={focused === visible.length}
              selected={focused === visible.length}
              className='template-picker-more'
              icon='MoreLine'
              label={`Show ${Math.min(TEMPLATE_PICKER_PAGE, rows.length - shown)} more of ${rows.length - shown}`}
              compact
              minimal
              onMouseDown={keysFromPage ? keepTheFocus : undefined}
              onClick={() => setShown((current) => current + TEMPLATE_PICKER_PAGE)}
            />
          : null}
        </ReqoreMenu>
      </div>
    );
  }
);
TemplatePicker.displayName = 'TemplatePicker';
