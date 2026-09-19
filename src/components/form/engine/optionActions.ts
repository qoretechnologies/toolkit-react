import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import {
  IReqorePanelAction,
  IReqorePanelSubAction,
} from '@qoretechnologies/reqore/dist/components/Panel';
import { IQorusFormField, IQorusFormSchema } from '@qoretechnologies/ts-toolkit';

/**
 * The context an `optionActions` factory receives for a single option — the
 * option's name, its schema entry, and its current field value. This is the
 * IDE's `AiAssistanceAction` context (it injects its `allowAi` button here).
 */
export interface IOptionActionsContext {
  name: string;
  schema: IQorusFormSchema[string];
  value?: IQorusFormField;
}

/**
 * SEAM (reqraft): per-option injected actions. Either a static list applied to
 * every option, or a factory invoked once per option with that option's context.
 */
export type TOptionActions =
  | IReqorePanelAction[]
  | ((context: IOptionActionsContext) => IReqorePanelAction[]);

/**
 * Resolve the `optionActions` seam for one option.
 *
 * Both render paths go through this so a consumer's factory is called with the
 * same context and its result shaped the same way: the classic path feeds the
 * result to `ReqorePanel`'s `actions`, the compact path renders the buttons
 * itself. Falsy entries are dropped so a factory can return conditional actions
 * inline (`cond && {...}`) without each caller re-filtering.
 */
export const resolveOptionActions = (
  optionActions: TOptionActions | undefined,
  context: IOptionActionsContext
): IReqorePanelAction[] => {
  const actions =
    typeof optionActions === 'function' ? optionActions(context) : (optionActions ?? []);

  return (actions ?? []).filter((action): action is IReqorePanelAction => !!action);
};

/** How many injected actions a row shows as buttons before the rest go into its menu. */
export const MAX_INLINE_OPTION_ACTIONS = 2;

/**
 * Which injected actions stay as buttons, and which move into the row's menu.
 *
 * Everything moves on touch and on narrow viewports (`collapse`) — a button
 * that waits for a hover is unreachable without one — and anything past the
 * inline cap moves regardless, so a consumer injecting ten actions can never
 * push the row's value out of view. Both render paths decide it here.
 */
export const splitOptionActions = (
  actions: IReqorePanelAction[],
  collapse: boolean
): [IReqorePanelAction[], IReqorePanelAction[]] =>
  collapse ?
    [[], actions]
  : [actions.slice(0, MAX_INLINE_OPTION_ACTIONS), actions.slice(MAX_INLINE_OPTION_ACTIONS)];

/**
 * An injected action as a row in a menu.
 *
 * A panel action labels itself with `label`, but an icon-only one (the IDE's
 * AI-assist button) carries its name in the tooltip — and a menu row has no
 * hover to fall back on.
 */
export const optionActionAsMenuItem = (
  action: IReqorePanelAction,
  index: number
): IReqoreDropdownItem => ({
  /* A menu row's label has to be text. `tooltip` may be a tooltip OBJECT
     (`IReqoreTooltip`), which is why this was cast before — an action with a
     configured tooltip and no label put that object where a string belongs. */
  label:
    action.label ??
    (typeof action.tooltip === 'string' ? action.tooltip : undefined) ??
    `Action ${index + 1}`,
  icon: action.icon,
  intent: action.intent,
  disabled: action.disabled,
  className: action.className,
  onClick: () => action.onClick?.(),
});

export interface IOptionRowActionsInput {
  /** The consumer's actions for this option, already resolved. */
  injected: IReqorePanelAction[];
  /** Move every injected action into the menu (touch, narrow viewport). */
  collapse: boolean;
  /** The row's own secondary actions; a falsy entry is one that does not apply. */
  menu: (IReqorePanelSubAction | false | null | undefined | 0 | '')[];
}

/**
 * A classic form row's header actions.
 *
 * Injected actions stay as buttons up to the inline cap; the rest, and the
 * row's own secondary actions, go into ONE ⋯ menu that is always drawn, so
 * nothing the row offers is reachable only by hovering it.
 */
export const optionRowActions = ({
  injected,
  collapse,
  menu,
}: IOptionRowActionsInput): IReqorePanelAction[] => {
  const [inline, overflow] = splitOptionActions(injected, collapse);
  const items: IReqorePanelSubAction[] = [
    ...overflow.map(optionActionAsMenuItem),
    ...menu.filter((item): item is IReqorePanelSubAction => !!item),
  ];

  const more: IReqorePanelAction = {
    icon: 'More2Fill',
    size: 'tiny',
    minimal: true,
    flat: true,
    className: 'options-item-more',
    tooltip: 'More actions',
    actions: items,
  };

  return [...inline, ...(items.length ? [more] : [])];
};
