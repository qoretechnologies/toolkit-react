import { IReqorePanelAction } from '@qoretechnologies/reqore/dist/components/Panel';
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
