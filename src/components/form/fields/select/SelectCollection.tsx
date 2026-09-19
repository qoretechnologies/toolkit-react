import {
  ReqoreButton,
  ReqoreCollection,
  ReqoreControlGroup,
  ReqoreMessage,
  ReqoreModal,
  ReqoreTag,
} from '@qoretechnologies/reqore';
import { IReqoreCollectionItemProps } from '@qoretechnologies/reqore/dist/components/Collection/item';
import { TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqorePanelAction } from '@qoretechnologies/reqore/dist/components/Panel';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreTooltip } from '@qoretechnologies/reqore/dist/types/global';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { capitalize, isEqual, size } from 'lodash';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  UNAVAILABLE_VALUE_FALLBACK_REASON,
  getRefusalMessage,
} from '../../../../helpers/options';
import { Description } from '../../../Description';

/**
 * The size the picker cannot be dragged below, measured on its own content.
 *
 * reqore floors a modal at what the DRAWER's chrome needs — its title and its
 * close control — which is all reqore can answer for. The picker needs more
 * than that, and said so the hard way: dragged to roughly 45px wide it still
 * held a search box, a list and a close button, stacked in a column nobody
 * could read.
 *
 * Measured on `components-form-select--item-actions-in-the-title-bar` at
 * 1400x1000, sweeping the width and the height of the dialog box:
 *
 * - **320px wide.** The collection is laid out in 300px columns
 *   (`minColumnWidth`), so a row is 300px wide whatever the dialog does. At
 *   300px the row overhangs the dialog by 13px and at 310px by 3px; 320px is
 *   the first round width that contains it (-7px), and from 340px the row
 *   grows with the box instead of overhanging it.
 * - **180px tall.** The panel header is 55px and the search field 26px, and
 *   both are whole from 100px — but the list below them has to show one entry
 *   in full, or there is nothing choosable in the dialog. A plain row is 56px
 *   and is whole from 160px; a row carrying a description is 70px and needs
 *   174px. The floor takes the taller of the two, because the same dialog
 *   serves both and a floor that clips the rows it is actually used with is
 *   the defect this constant exists to prevent — the assertion-kind picker in
 *   qorus-ide is the described-row case. 180px is the first round height that
 *   contains it.
 */
export const SELECT_DIALOG_MIN_WIDTH = 320;
/** See {@link SELECT_DIALOG_MIN_WIDTH}. */
export const SELECT_DIALOG_MIN_HEIGHT = 180;

/**
 * The hook a row wears while its value cannot be picked — for the stylesheet
 * below, and for a host's own tests and styling.
 */
export const UNAVAILABLE_ITEM_CLASS = 'reqraft-select-item-unavailable';

/**
 * The picker's floor, expressed where it survives the reqore we pin.
 *
 * `className` reaches the element `re-resizable` sizes and drags, and a CSS
 * `min-width` clamps THAT element's rendered box however far the drag goes —
 * so this holds against reqore 0.74.1, where a modal's floor is a hardcoded
 * 40px and `minSize` never reaches it, as well as against the `minWidth` /
 * `minHeight` props reqore grew later.
 *
 * `!important` is load-bearing, not decoration: `re-resizable` writes its own
 * `min-width` / `min-height` INLINE on this same element, and an inline
 * declaration beats a normal one from a stylesheet.
 *
 * Clamping the box from outside `re-resizable` rather than through it costs
 * one thing, and it is not the thing it looks like. The drag stays exact: each
 * move sizes the box from where the drag STARTED plus the pointer's delta, not
 * from the last size, so coming back out tracks the pointer with no dead zone
 * (measured — past the floor the box holds 320px while the inline width reads
 * 40px, and 300px back out it is 400px again). What is left behind is that
 * divergence: an inline width smaller than the box anyone can see. Read this
 * dialog's size from its rect, never from `style.width`. Once reqraft can pin
 * a reqore that has them this becomes `minWidth` / `minHeight` on the modal,
 * and the two agree again.
 *
 * Capped at the viewport so a phone gets a dialog it can see all of rather
 * than a floor wider than its screen — reqore's own maximum is 90vw / 90vh.
 */
const StyledSelectDialog = styled(ReqoreModal)`
  min-width: min(${SELECT_DIALOG_MIN_WIDTH}px, 90vw) !important;
  min-height: min(${SELECT_DIALOG_MIN_HEIGHT}px, 90vh) !important;

  /*
   * A value that cannot be picked, said in the row's own stylesheet.
   *
   * Reqore's "disabled" is NOT what marks it. That applies DisabledElement,
   * which is "pointer-events: none" — and the two places the reason can be
   * read, the row's tooltip and whatever control its title bar carries, both
   * need the pointer. Dropping onClick is what actually makes the row inert:
   * reqore derives "interactive" from the handlers a panel was given, so a row
   * with none gets no pointer cursor and no hover lift while keeping every
   * pointer event it had.
   *
   * The dimming lands on the TITLE rather than on the row, because "opacity"
   * creates a stacking context: dimming the row would dim the reason inside it,
   * and the reason is the one thing on an unavailable row that has to read.
   */
  .${UNAVAILABLE_ITEM_CLASS} {
    cursor: not-allowed;
  }

  .${UNAVAILABLE_ITEM_CLASS} > .reqore-panel-title {
    opacity: 0.55;
  }
`;

const PositiveColorEffect = {
  gradient: {
    colors: {
      0: 'success' as const,
      100: 'success' as const,
    },
  },
};

/**
 * One affordance on an offered item, as a DESCRIPTOR rather than a node.
 *
 * A caller's items routinely travel through a `JSON.stringify(items)` memo key
 * (`FieldAllowedValues`, `MultiSelectFormField`), and a rendered React element
 * is circular through its fibre — putting one on an item throws and takes the
 * whole form down with it. So an item names the component and hands it props;
 * `as` is a function or a memo object, which `JSON.stringify` simply omits.
 */
export interface ISelectFieldCollectionItemAction {
  /** The component to render. Defaults to {@link ReqoreButton}. */
  as?: React.ElementType;
  /** Props handed to it. Keep them JSON-serialisable. */
  props?: Record<string, unknown>;
}

/**
 * Content for a tooltip an item puts on its own row, under the same
 * no-React-elements rule as {@link ISelectFieldCollectionItemAction}: a plain
 * string, or a component named by `as` and given plain props.
 */
export type TSelectFieldCollectionItemTooltipContent =
  | string
  | { as: React.ElementType; props?: Record<string, unknown> };

/**
 * A per-item tooltip: a bare string, or reqore's tooltip options with the
 * content given as a descriptor.
 */
export type TSelectFieldCollectionItemTooltip =
  | string
  | (Omit<IReqoreTooltip, 'content'> & {
      content?: TSelectFieldCollectionItemTooltipContent;
    });

/** A note rendered in an item's body, in the same shape a schema sends one. */
export interface ISelectFieldCollectionItemMessage {
  intent?: TReqoreIntent;
  title?: string;
  content: string;
}

export interface ISelectFieldCollectionItem {
  value?: unknown;
  name?: unknown;
  display_name?: string;
  desc?: string;
  short_desc?: string;
  icon?: IReqoreIconName;
  image?: string;
  badge?: TReqoreBadge;
  intent?: TReqoreIntent;
  disabled?: boolean;
  groups?: string[];
  /**
   * Affordances rendered in the row's BODY, stacked under the description.
   * Each one costs the row a line of its own, which is right for something
   * with a label and wrong for a single icon on a long list — see
   * `title_actions`.
   */
  actions?: ISelectFieldCollectionItemAction[];
  /**
   * Affordances rendered in the row's TITLE BAR, inline with the name and to
   * the right of it, where a row already reserves the height.
   *
   * Separate from `actions` rather than a relocation of it: an item's body
   * actions have been rendered under the description since this collection
   * existed, and callers size and lay them out on that basis. This is the
   * opt-in for the other placement.
   */
  title_actions?: ISelectFieldCollectionItemAction[];
  /**
   * A tooltip on the ROW — the whole item is the hover target, not one control
   * inside it. Content that is more than a sentence belongs here rather than
   * in `content`, which every row pays for in height whether it is read or not.
   */
  tooltip?: TSelectFieldCollectionItemTooltip;
  messages?: ISelectFieldCollectionItemMessage[];
  /**
   * Why the value cannot be picked, when it cannot.
   *
   * Rendered FIRST in the row — above the description, not under it, where a
   * `messages` entry would land. A reader who has just been refused a choice is
   * looking for the reason, and a row that answers with its description and
   * makes them read on has answered a different question.
   *
   * Set it together with `disabled`, which is what drops the click handler.
   * Carried as data rather than as a node for the reason in
   * {@link ISelectFieldCollectionItemAction}.
   */
  unavailable?: ISelectFieldCollectionItemMessage;
  /** Added to the row's own classes — see {@link UNAVAILABLE_ITEM_CLASS}. */
  className?: string;
  /**
   * Extra words the list's search matches this row on.
   *
   * Reqore searches a row's label and the STRING of its content, and this
   * collection's content is a React element — which stringifies to
   * `[object Object]` and matches every query equally. Anything that has to be
   * findable belongs here.
   */
  searchString?: string;
  [key: string]: unknown;
}

export interface ISelectFieldCollectionProps {
  onClose: () => void;
  items: ISelectFieldCollectionItem[];
  value?: unknown;
  onItemSelect: (item: ISelectFieldCollectionItem) => void;
  filters?: string[];
}

const normalizeSelectItemDescription = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const seen = new Set<string>();

  return value
    .split('\n')
    .filter((line) => {
      const normalized = line.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

      if (!normalized) {
        return true;
      }

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .join('\n')
    .trim();
};

export const getSelectItemDescription = (
  item: Pick<ISelectFieldCollectionItem, 'desc' | 'short_desc'>
): string | undefined => {
  const desc = normalizeSelectItemDescription(item.desc);
  const shortDesc = normalizeSelectItemDescription(item.short_desc);
  return desc ?? shortDesc;
};

export const getSelectItemShortDescription = (
  item: Pick<ISelectFieldCollectionItem, 'desc' | 'short_desc'> | undefined,
  defaultDesc = ''
): string | undefined => {
  if (!item) {
    return defaultDesc || undefined;
  }

  const shortDescription = normalizeSelectItemDescription(item.short_desc);

  return shortDescription || defaultDesc || undefined;
};

export const getSelectItemDescriptionProps = (
  item: Pick<ISelectFieldCollectionItem, 'desc' | 'short_desc'>
): { longDescription?: string; shortDescription?: string } => {
  const longDescription = normalizeSelectItemDescription(item.desc);

  if (longDescription) {
    return { longDescription };
  }

  const shortDescription = normalizeSelectItemDescription(item.short_desc);

  return { shortDescription };
};

/**
 * Why an item cannot be picked, in the words the row will print.
 *
 * Two shapes reach here and they mean the same thing. A caller that resolved
 * the availability itself sends `unavailable`; a caller — or a server — that
 * only marked the value `disabled` and explained it in `messages` gets the same
 * treatment, because a refusal nobody worded is still a refusal, and a row that
 * silently ignores a click is the defect this answers.
 *
 * Which message explains a refusal is decided in one place
 * ({@link getRefusalMessage}), so the picker and the form's own resolver cannot
 * word the same refusal differently.
 */
export const getSelectItemUnavailability = (
  item: Pick<ISelectFieldCollectionItem, 'unavailable' | 'disabled' | 'messages'>
): ISelectFieldCollectionItemMessage | undefined => {
  if (item.unavailable) {
    return item.unavailable;
  }

  if (!item.disabled) {
    return undefined;
  }

  const explanation = getRefusalMessage(item.messages);

  return {
    intent: explanation?.intent || 'warning',
    title: explanation?.title,
    content: explanation?.content || UNAVAILABLE_VALUE_FALLBACK_REASON,
  };
};

/**
 * An item's title-bar affordances as reqore panel actions.
 *
 * `as` is defaulted here rather than left to reqore: reqore renders an action
 * with no `as` as a `ReqoreButton` built from the action's OWN keys and drops
 * `props` on the floor, so a descriptor that named only props would render an
 * empty button. Defaulting `as` keeps one descriptor shape for both
 * placements.
 *
 * `size` is a default, not an override — the row is `tiny`, so a control in
 * its title bar is too unless the caller says otherwise. The body renderer
 * below forces `size` after the caller's props and cannot be given a
 * different one; that is the older behaviour and it is left alone.
 *
 * An unavailable row leads with a padlock, before whatever the caller declared.
 * It is a TAG, not a control: the words are already on the row and in its
 * tooltip, and a second popover saying the same thing over the first is worse
 * than one. It is also not the compact form's "Depends on" chip, whose whole
 * value is clicking through to the blocking field — from inside a modal that
 * covers that field, there is nowhere for such a click to go.
 */
export const getSelectItemTitleActions = (
  item: Pick<ISelectFieldCollectionItem, 'title_actions'>,
  unavailable?: ISelectFieldCollectionItemMessage
): IReqorePanelAction[] | undefined => {
  const declared = (item.title_actions || []).map(
    ({ as = ReqoreButton, props, ...rest }): IReqorePanelAction => ({
      ...rest,
      as,
      props: { size: 'tiny', ...props },
    })
  );

  const actions = unavailable ? [UNAVAILABLE_TITLE_ACTION, ...declared] : declared;

  return actions.length ? actions : undefined;
};

/** The padlock an unavailable row wears — see {@link getSelectItemTitleActions}. */
const UNAVAILABLE_TITLE_ACTION: IReqorePanelAction = {
  as: ReqoreTag,
  props: {
    size: 'tiny',
    icon: 'LockLine',
    minimal: true,
    className: 'reqraft-select-item-lock',
  },
};

/**
 * An item's row tooltip as reqore's own tooltip prop.
 *
 * The descriptor is turned into an element HERE — after the caller's items
 * have been through whatever memo key they travel under — which is the whole
 * reason the item carries `{ as, props }` and not a node.
 */
export const buildSelectItemTooltip = (
  tooltip: ISelectFieldCollectionItem['tooltip']
): string | IReqoreTooltip | undefined => {
  if (!tooltip) {
    return undefined;
  }

  if (typeof tooltip === 'string') {
    return tooltip;
  }

  const { content, ...rest } = tooltip;

  if (content === undefined) {
    return rest;
  }

  if (typeof content === 'string') {
    return { ...rest, content };
  }

  const { as: Component, props } = content;

  return { ...rest, content: <Component {...props} /> };
};

export const SelectFieldCollection = ({
  onClose,
  items,
  value,
  onItemSelect,
  filters,
}: ISelectFieldCollectionProps) => {
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      let isMatch = true;

      if (appliedFilters.length > 0) {
        isMatch = appliedFilters.some((filter) => item[filter]);
      }

      return isMatch;
    });
  }, [items, appliedFilters]);

  return (
    <StyledSelectDialog
      isOpen
      // A library-owned hook for hosts and their tests to target the picker
      // (qorus-ide's helpers looked for its own `.q-select-dialog`, which
      // this modal never carried).
      className='reqraft-select-dialog'
      icon='ListOrdered'
      onClose={onClose}
      label='Select from items'
      badge={size(items)}
      width='700px'
      customTheme={{ main: '#010811' }}
    >
      <ReqoreCollection
        filterable
        sortable
        responsiveTitle={false}
        showSelectedFirst
        selectedIcon='CheckLine'
        fill
        columnsGap='5px'
        minColumnWidth='300px'
        inputProps={{
          rightIcon: 'KeyboardFill',
          focusRules: {
            type: 'auto',
            clearOnFocus: true,
          },
        }}
        customTheme={{ main: '#010811' }}
        transparent={false}
        size='tiny'
        showLayoutSwitch={false}
        items={filteredItems.map((item): IReqoreCollectionItemProps => {
          const { longDescription, shortDescription } = getSelectItemDescriptionProps(item);
          const unavailable = getSelectItemUnavailability(item);
          /* One `messages` entry can be the refusal itself — a server that sent
             `disabled` with its reason, resolved into `unavailable` upstream.
             It is already printed above the description, so it is not printed
             again underneath it. */
          const messages = (item.messages || []).filter(
            (message) => !unavailable || message.content !== unavailable.content
          );

          return {
            label: item.display_name || item.value?.toString(),
            size: 'tiny',
            groups: item.groups,
            className: [item.className, unavailable ? UNAVAILABLE_ITEM_CLASS : undefined]
              .filter(Boolean)
              .join(' '),
            /* Inline with the name, in height the title bar already spends.
               `actions` on the item stays where it has always been, in the
               body under the description. */
            actions: getSelectItemTitleActions(item, unavailable),
            /* The row is the hover target, so an explanation costs the list
               nothing until it is asked for. */
            tooltip: buildSelectItemTooltip(item.tooltip ?? unavailable?.content),
            /* Reqore searches a row's label and its stringified content, and
               the content below is an element — so every row matches
               `[object Object]` and nothing matches a word inside it. A reason
               nobody can search for in a list of hundreds is a reason nobody
               finds. */
            searchString: [item.searchString, unavailable?.title, unavailable?.content]
              .filter(Boolean)
              .join(' '),
            customTheme: { main: '#08182d' },
            responsiveTitle: false,
            content: (
              <ReqoreControlGroup vertical fluid>
                {unavailable ? (
                  <ReqoreMessage
                    flat
                    icon='LockLine'
                    intent={unavailable.intent || 'warning'}
                    title={unavailable.title}
                    size='small'
                    opaque={false}
                  >
                    {unavailable.content}
                  </ReqoreMessage>
                ) : null}
                {longDescription || shortDescription ? (
                  <Description
                    longDescription={longDescription || ''}
                    shortDescription={shortDescription}
                    size='small'
                    margin='none'
                  />
                ) : null}
                {item.actions?.map(({ as: Component = ReqoreButton, props, ...rest }, index) => (
                  <Component
                    key={index}
                    {...rest}
                    {...props}
                    fixed
                    size='tiny'
                  />
                ))}
                {messages.map(({ intent, title, content }, index) => (
                  <ReqoreMessage
                    flat
                    intent={intent}
                    title={title}
                    key={title || index}
                    size='small'
                    opaque={false}
                  >
                    {content}
                  </ReqoreMessage>
                ))}
              </ReqoreControlGroup>
            ),
            flat: false,
            minimal: true,
            selected: item.value !== undefined && item.value !== null && isEqual(item.value, value),
            intent:
              item.value !== undefined && item.value !== null && isEqual(item.value, value)
                ? 'info'
                : item.intent,
            badge: item.badge,
            icon: item.icon,
            iconImage: item.image,
            iconProps: {
              size: '20px',
              rounded: true,
            },
            /* No handler is what makes an unavailable row inert, and it is
               deliberately NOT reqore's `disabled`: see the stylesheet on
               `StyledSelectDialog`. */
            onClick: !item.disabled && !unavailable
              ? (e) => {
                  if (e.currentTarget.contains(e.target as Node)) {
                    onItemSelect(item);
                    onClose?.();
                  }
                }
              : undefined,
          };
        })}
        actions={filters?.map((filter) => ({
          label: capitalize(filter.replace('_', ' ')),
          badge: items.filter((item) => item[filter]).length,
          active: appliedFilters.includes(filter),
          effect: appliedFilters.includes(filter) ? PositiveColorEffect : undefined,
          size: 'tiny' as const,
          onClick: () => {
            if (!appliedFilters.includes(filter)) {
              setAppliedFilters([...appliedFilters, filter]);
            } else {
              setAppliedFilters(appliedFilters.filter((appliedFilter) => appliedFilter !== filter));
            }
          },
        }))}
      />
    </StyledSelectDialog>
  );
};
