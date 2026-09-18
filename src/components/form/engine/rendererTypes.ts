import { TQorusType } from '@qoretechnologies/ts-toolkit';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';

/**
 * A field schema that carries a template list of its own.
 *
 * `templates` is deliberately NOT added to `TQorusFormFieldSchema`: that type is
 * owned by ts-toolkit and shared with consumers that have no notion of a form
 * engine, so the capability is read through this narrow view instead of widening
 * the shared type from here. A schema that sets it is offering a list scoped to
 * one field rather than to the whole form.
 */
export type TFieldWithOwnTemplates = { templates?: IReqoreFormTemplates };

/**
 * A schema entry carries two type-ish keys with different jobs:
 *
 * - `type` names how the value is STORED and validated (`string`, `hash`, `list`…).
 * - `ui_type` names which EDITOR renders it.
 *
 * For most fields `ui_type` is a storage-compatible refinement (`long-string`,
 * `enum`, `url`) and it is safe to let it win for both jobs. But some `ui_type`s
 * name a bespoke editor whose value is still stored as the plainer `type` — a
 * `cron` editor stores a string, `processor-mappings` stores a hash. Writing
 * those renderer names into the field's `type` breaks validation and round-trips
 * the value through the wrong branch, which is what `RENDERER_ONLY_UI_TYPES`
 * exists to prevent.
 *
 * There is deliberately no derivation here: a renderer-only `ui_type` is not
 * distinguishable from a storage-compatible one by inspecting the value or the
 * `TQorusType` union (`code-editor` and `tool-catalog` are members of it, and
 * the validator has cases for `cron` and `schema-definition`). It is a fact
 * about which editor a name selects, so it has to be declared.
 *
 * `markdown` is the case that makes the rule concrete: the server describes a
 * description field as `type: 'string'` with a `markdown` flag, and a string is
 * exactly what it stores -- but the editor is the split editor/preview one, and
 * the read-first row renders the document rather than printing its source.
 * Without the declaration `getValueType` keeps preferring the stored `string`
 * and neither ever fires.
 */
export const BUILT_IN_RENDERER_ONLY_UI_TYPES: readonly string[] = [
  'active-windows',
  'alert-threshold',
  'code-editor',
  'cron',
  'dpql',
  'markdown',
  'processor-mappings',
  'schema-definition',
  'test-cases',
  'test-value-contract',
  'tool-catalog',
];

/**
 * Build the renderer-only predicate for one FormEngine instance.
 *
 * Consumers inject their own editors through `componentOverrides`, so the set of
 * renderer-only names is open-ended — the IDE ships editors reqraft has never
 * heard of. `extraTypes` (the `rendererOnlyUiTypes` prop) lets a consumer declare
 * its own without waiting on a reqraft release, which is what previously made
 * every new IDE editor a silent value-corruption bug until this list caught up.
 */
export const createRendererOnlyUiTypeCheck = (
  extraTypes?: readonly string[]
): ((type?: TQorusType | TQorusType[]) => boolean) => {
  const known = new Set<string>([...BUILT_IN_RENDERER_ONLY_UI_TYPES, ...(extraTypes ?? [])]);

  return (type?: TQorusType | TQorusType[]): boolean =>
    typeof type === 'string' && known.has(type);
};

/** The default predicate — built-ins only, for module-scope callers with no props. */
export const isRendererOnlyUiType = createRendererOnlyUiTypeCheck();
