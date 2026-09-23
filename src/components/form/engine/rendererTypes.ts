import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { firstDeclaredType } from '../../../helpers/optionUiTypes';

/**
 * A field schema that carries a template list of its own.
 *
 * `templates` is deliberately NOT added to `TQorusFormFieldSchema`: that type is
 * owned by ts-toolkit and shared with consumers that have no notion of a form
 * engine, so the capability is read through this narrow view instead of widening
 * the shared type from here. A schema that sets it is offering a list scoped to
 * one field rather than to the whole form.
 */
export type TFieldWithOwnTemplates = {
  templates?: IReqoreFormTemplates;
  /**
   * The token grammar this field's value is WRITTEN in.
   *
   * A host may spell a reference in a grammar that is not reqraft's — a Qorus
   * test writes `$._case.mode`, which has no `$key:` in it at all — and a field
   * that speaks one says so here, exactly as it hands down its own `templates`.
   * Declaring it on the schema is what lets every surface that draws the value
   * agree about it, instead of printing the raw token the author never typed.
   *
   * Both directions read it: the read-only renderings
   * (`templateTextSegments`) and the rich-text editor a row opens
   * (`templateTextToNodes`, through `RichTextFormField`'s `templateToken`
   * prop). They resolve references with the same code, so a row and the editor
   * it opens cannot disagree about what one is.
   *
   * A `RegExp` or its source: a schema that crossed a serialization boundary
   * carries the string.
   */
  templateToken?: RegExp | string;
};

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
 * A `ui_type` as the predicate takes it: any name, not only a `TQorusType`.
 * The names it exists to recognise are open-ended — `cron` is not a
 * `TQorusType`, and neither is an editor a consumer declares — so typing the
 * argument as the shared union made the predicate uncallable for exactly the
 * values it is for.
 */
export type TRendererTypeName = string | readonly string[];

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
): ((type?: TRendererTypeName) => boolean) => {
  const known = new Set<string>([...BUILT_IN_RENDERER_ONLY_UI_TYPES, ...(extraTypes ?? [])]);

  return (type?: TRendererTypeName): boolean => {
    const declared = firstDeclaredType(type);
    return declared !== undefined && known.has(declared);
  };
};

/** The default predicate — built-ins only, for module-scope callers with no props. */
export const isRendererOnlyUiType = createRendererOnlyUiTypeCheck();
