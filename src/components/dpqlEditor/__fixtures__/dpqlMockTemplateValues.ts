// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What the stories' language server answers inside `$data:`, computed as Qorus computes it (qorus#646: a story's
 * stand-in answers as the server does): `QorusClientServer::listTemplateValues()` lists, from the bound Qog's state
 * data, the states while no `.` is typed - each `{name: <state key>, display_name, description}` - and after
 * `<state>.` that state's top-level items that start with what is typed - `{name: <state>.<item name>,
 * display_name, type, description: short_desc ?? desc}`; `DpqlCompletionProvider::getTemplateValueCompletions()`
 * makes each a completion: its label the display name, its insert and filter text the whole reference
 * (`$data:<name>`), its detail the type's catalogue name, its documentation the description, its kind `template`
 * (an LSP Variable, `QorusLspWebSocketHandler`'s `CIK_VARIABLE`).
 */
import type { ITemplatesPayload } from '../../../helpers/templates';
import { builtInTypeLabel } from '../../../helpers/qorusTypeCatalogue';
import type { ILspCompletionItem } from '../../../utils/lspClient.types';

/** The LSP kind Qorus sends a template completion as. */
const CIK_VARIABLE = 6;

/** The completions Qorus answers for `$data:<prefix>` from `stateData` (`fsms?action=getStateData`). */
export const mockDataTemplateValues = (
  stateData: ITemplatesPayload,
  prefix: string
): ILspCompletionItem[] => {
  const dot = prefix.indexOf('.');
  const values: Array<{
    name: string;
    display_name?: string;
    type?: string;
    description?: string;
  }> = [];
  for (const [stateKey, state] of Object.entries(stateData)) {
    if (dot >= 0) {
      if (stateKey !== prefix.slice(0, dot)) continue;
      const fieldPrefix = prefix.slice(dot + 1).toLowerCase();
      for (const item of state.items ?? []) {
        const name = (item as { name?: string }).name ?? '';
        if (fieldPrefix && !name.toLowerCase().startsWith(fieldPrefix)) continue;
        values.push({
          name: `${stateKey}.${name}`,
          display_name: item.display_name,
          type: item.type,
          description:
            (item as { short_desc?: string }).short_desc ??
            (item as { desc?: string }).desc ??
            `State data field: ${name} (${item.type ?? 'auto'})`,
        });
      }
    } else if (!prefix || stateKey.toLowerCase().startsWith(prefix.toLowerCase())) {
      values.push({
        name: stateKey,
        display_name: state.display_name,
        description: state.display_name ?? state.short_desc ?? `State: ${stateKey}`,
      });
    }
  }
  return values.map((value) => {
    const raw = `$data:${value.name}`;
    return {
      label: value.display_name ?? raw,
      kind: CIK_VARIABLE,
      insertText: raw,
      filterText: raw,
      ...(value.type ? { detail: builtInTypeLabel(value.type) ?? value.type } : {}),
      documentation: value.description ?? `Template value: ${value.name}`,
    };
  });
};
