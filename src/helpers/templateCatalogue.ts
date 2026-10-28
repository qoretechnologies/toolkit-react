// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A field's template catalogue, as Qorus gives it (qorus#646; Qorus `design/template-strings.md` §8): the template
 * contexts the field can really use where it is used - none that would fail there or always read nothing - each
 * with what it is (a container of keys, a set of values, a formatted or an expression argument), whether it can be
 * used whole (`$ctx:*`) and its known keys, nested, each with the exact template that reads it.
 *
 * Qorus gives it for a DPQL document as the language server's `dpql/templateCatalogue {uri, field_context?}`, and
 * for any other field from REST `PUT /api/latest/system?action=getTemplateCatalogue` with the field's context as
 * its body. The picker and typing read it as the "Template contexts" group of a field's templates
 * (`withTemplateCatalogue`): every container has its Use, every key its row.
 */
import type { ITemplateNode } from './templateTree';
import { TEMPLATE_CONTEXTS_LABEL, templateNodeKindOf, unbracedReference } from './templateTree';

/** What a context is: a container of keys, a set of values, or an argument written in a format of its own. */
export type TTemplateCatalogueContextKind = 'container' | 'values' | 'formatted' | 'expression';

/** A known key of a context, or of a key that holds keys itself. */
export interface ITemplateCatalogueKey {
  name: string;
  /** Its path in its context (`s1.customer.name`). */
  path: string;
  /** The template that reads it (`$data:s1.customer.name`). */
  template: string;
  /** It holds a value that can be used whole (a hash): its own template reads all of it. */
  use_whole?: boolean;
  /** It holds keys that are written, not all known here. */
  free_form_keys?: boolean;
  /** Where Qorus knows it from (`declared`, `state-data`, `context-info`, `loop`...). */
  source?: string;
  display_name?: string;
  type?: string;
  base_type?: string;
  description?: string;
  keys?: ITemplateCatalogueKey[];
}

/** A template context a field can use. */
export interface ITemplateCatalogueContext {
  /** Its name, as written between `$` and `:`. */
  name: string;
  display_name?: string;
  description?: string;
  kind: TTemplateCatalogueContextKind;
  sort_priority?: number;
  /** It can be used whole: `whole_template` (`$local:*`) reads all of it. */
  use_whole?: boolean;
  whole_template?: string;
  /** Its keys are written, not all known here (`$dynamic:`). */
  free_form_keys?: boolean;
  needs_arg?: boolean;
  writable?: boolean;
  type?: string;
  /** How its argument is written, for a context of values or a formatted or expression argument. */
  arg_format?: string;
  keys?: ITemplateCatalogueKey[];
}

/** Where a field is, as Qorus is told it (`field_context`): what decides the contexts the field can use. */
export interface ITemplateFieldContext {
  interface_type?:
    | 'qog'
    | 'workflow'
    | 'step'
    | 'service'
    | 'job'
    | 'pipeline'
    | 'class'
    | 'test'
    | 'alert-payload'
    | 'generic';
  interface_name?: string;
  interface_version?: string;
  /** A draft's ID, for a configuration item of an interface not saved yet. */
  interface_id?: string;
  /** A Qog: as it is edited, by its draft, or saved; makes the field a Qog field. */
  fsm?: Record<string, unknown>;
  draft_id?: string;
  fsmid?: number;
  /** The Qog state the field is in (its key or ID). */
  current_state?: string;
  /** What runs the Qog; derived from its references when not given. */
  hosts?: Array<{ type: string; name: string }>;
  record_expression?: boolean;
  record_search?: boolean;
  /** A record's fields, for a field outside a DPQL document (REST). */
  record_fields?: Record<string, unknown>;
  /** `write` for a field that names where a value is written. */
  mode?: 'read' | 'write';
  data_context?: unknown;
}

/** A field's catalogue: the context Qorus resolved for it and the contexts it can use. */
export interface ITemplateCatalogue {
  field_context?: Record<string, unknown>;
  contexts: ITemplateCatalogueContext[];
}

/** A type as a row names it: Qore's `auto` is any type (`any`), never an unknown one. */
const typeOf = (type: string | undefined): string | undefined => (type === 'auto' ? 'any' : type);

/** The id of the "Template contexts" group in a field's templates. */
export const TEMPLATE_CONTEXTS_GROUP_ID = 'contexts';

/** A context, written to go on into it: `$local:`. */
export const catalogueContextReference = (context: ITemplateCatalogueContext): string =>
  `$${context.name}:`;

const keyNode = (
  key: ITemplateCatalogueKey,
  id: string,
  trail: string[],
  trailIds: string[],
  wholeRecords?: boolean
): ITemplateNode => {
  const label = key.display_name ?? key.name;
  const children = key.keys?.map((child, index) =>
    keyNode(child, `${id}.${index}`, [...trail, label], [...trailIds, id], wholeRecords)
  );
  return {
    id,
    label,
    value: key.template,
    // what typing reaches it by: its reference without braces (`$static:order.customer-name`)
    reference: unbracedReference(key.template),
    kind: templateNodeKindOf(key.template),
    type: typeOf(key.type),
    baseType: key.base_type,
    description: key.description,
    source: key.source,
    trail,
    trailIds,
    ...(children?.length ?
      // a key that holds keys: what is in it, and all of it where the value takes a record
      { children, takesWhole: wholeRecords !== false && !!key.use_whole }
    : {}),
  };
};

/**
 * A context's node: `$local:` - a container of its keys, used whole as `$local:*` where the value takes a record
 * and Qorus reads it whole. A context of keys written freely, or of an argument written in its own format, goes on
 * into what is written after its `:` (`continues`) where none of its keys is known.
 */
export const catalogueContextNode = (
  context: ITemplateCatalogueContext,
  wholeRecords?: boolean,
  parentId = TEMPLATE_CONTEXTS_GROUP_ID,
  trail: string[] = [TEMPLATE_CONTEXTS_LABEL]
): ITemplateNode => {
  const reference = catalogueContextReference(context);
  const id = `${parentId}.${reference}`;
  const children = context.keys?.map((key, index) =>
    keyNode(key, `${id}.${index}`, [...trail, reference], [parentId, id], wholeRecords)
  );
  const whole = wholeRecords !== false && !!context.use_whole && !!context.whole_template;
  return {
    id,
    label: reference,
    reference,
    kind: 'context',
    description: [context.display_name, context.description, context.arg_format]
      .filter(Boolean)
      .join(' · '),
    type: typeOf(context.type),
    trail,
    trailIds: [parentId],
    catalogue: context,
    // keys written freely are not offered as one row each: what is written after the `:` is the key
    writesKey: !!context.free_form_keys,
    ...(children?.length ? { children } : { continues: true }),
    ...(whole ? { value: context.whole_template, takesWhole: true } : {}),
  };
};

/**
 * A field's templates with its catalogue's contexts as the "Template contexts" group (qorus#646, David's review:
 * every container that can be used has Use, and the picker offers what typing offers): each context the field can
 * use, in the catalogue's order, with its keys. It replaces a "Template contexts" group read from the field's own
 * templates, which could only guess what Qorus reads.
 */
export const withTemplateCatalogue = (
  roots: ITemplateNode[],
  catalogue: ITemplateCatalogue | undefined,
  wholeRecords?: boolean
): ITemplateNode[] => {
  if (!catalogue?.contexts?.length) {
    return roots;
  }
  const group: ITemplateNode = {
    id: TEMPLATE_CONTEXTS_GROUP_ID,
    label: TEMPLATE_CONTEXTS_LABEL,
    kind: 'context',
    description: 'Each context, to pick what is in it or to take it whole',
    trail: [],
    trailIds: [],
    // in the order Qorus means them to be read (`sort_priority`), as it lists them where it gives none
    children: catalogue.contexts
      .map((context, index) => ({ context, index }))
      .sort(
        (a, b) =>
          (a.context.sort_priority ?? Number.MAX_SAFE_INTEGER) -
            (b.context.sort_priority ?? Number.MAX_SAFE_INTEGER) || a.index - b.index
      )
      .map(({ context }) => catalogueContextNode(context, wholeRecords)),
  };
  return [...roots.filter((node) => node.id !== TEMPLATE_CONTEXTS_GROUP_ID), group];
};

/** The catalogue context a reference is written in (`local` of `$local:type`), if the catalogue offers it. */
export const catalogueContextOf = (
  catalogue: ITemplateCatalogue | undefined,
  reference: string
): ITemplateCatalogueContext | undefined => {
  const name = /^\$([\w-]+):/.exec(reference)?.[1];
  return name ? catalogue?.contexts.find((context) => context.name === name) : undefined;
};
