// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The one model of what a field can refer to (qorus#646, David: templates are offered as a Qog's are, as a
 * hierarchy, in one picker for a rich-text field and a DPQL field alike): its templates (`$…`) and, in a DPQL
 * field, the record's fields (`@…`), as a tree of nodes. Every list that offers them reads this model - the picker
 * browsed level by level (`TemplatePicker`), and the rows typing offers at the caret (`templateSearchItems`) - so
 * a template is found, named and drawn the same wherever it is offered.
 *
 * A node is a group (it has members: a Qog state, a record) or a template; a group whose members all go on from
 * one reference (`$data:receive_order.…`) stands for that reference (`reference`), which is what typing reaches it
 * by. A node with members may be a value as well (a record taken whole): it then has a `value` too.
 */
import type { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { templateBaseType, templateType } from './templateType';

/** What a node is, as its row says it: the badge a row carries and the icon it is drawn with. */
export type TTemplateNodeKind =
  'group' | 'state' | 'context' | 'config' | 'variable' | 'field' | 'template';

/** What a row says a node is, in words. A group says nothing: its members do. */
export const TEMPLATE_NODE_KIND_LABELS: Record<TTemplateNodeKind, string | undefined> = {
  group: undefined,
  state: 'State data',
  context: 'Context',
  config: 'Config',
  variable: 'Variable',
  field: 'Field',
  template: 'Template',
};

/** A catalogue row, as far as the tree reads it: a reqore dropdown item with a host's extras. */
export interface ITemplateCatalogueRow {
  label?: unknown;
  value?: unknown;
  badge?: unknown;
  description?: unknown;
  /** Where it comes from, as the host says (`withTemplateSources`). */
  source?: unknown;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
  items?: ITemplateCatalogueRow[];
  /** Members a host gives only when they are asked for - a Qog state's data, fetched when the state is opened. */
  loadItems?: () => Promise<ITemplateCatalogueRow[]>;
}

export interface ITemplateNode {
  /** Unique in its tree: the indexes of its path. */
  id: string;
  label: string;
  /** What is written for it, where it is a value: a template (`$data:{a.b}`) or a field (`@name`). */
  value?: string;
  /**
   * The reference it stands for, without braces: a template's value (`$data:a.b`), or the reference all of a
   * group's members go on from (`$data:a`). Typing reaches a node by it. None for a group of unrelated members
   * (Context Data).
   */
  reference?: string;
  kind: TTemplateNodeKind;
  /** Its type and the base type of its values (`templateType`), for a template. */
  type?: string;
  baseType?: string;
  /** What it is, in its own words. */
  description?: string;
  /** Where it comes from, as its host says. */
  source?: string;
  /** The names of the groups it is in, outermost first. */
  trail: string[];
  /** The ids of the groups it is in, outermost first. */
  trailIds: string[];
  children?: ITemplateNode[];
  /** Its members, asked for when it is opened or searched into, where its host gives them only then. */
  loadChildren?: () => Promise<ITemplateNode[]>;
  /**
   * A template that stands for a hash of any keys (`$dynamic:*`): what it holds is known only when it runs, so a
   * key is written for it (`$dynamic:order.id`) rather than chosen.
   */
  writesKey?: boolean;
  /**
   * A group that is a value of its own - a record, a Qog state's data - and can be taken whole where the field it is
   * picked for takes one (a field of any type, a hash): its "Use". Never a scalar field's: its catalogue marks the
   * groups whose value does not fit it (`filterTemplatesByType` takes their "select whole" away).
   */
  takesWhole?: boolean;
  disabled?: boolean;
  /** The catalogue row it was read from, for a host that needs its own metadata back. */
  row?: ITemplateCatalogueRow;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

/** A reference as it reads without its braces: `$data:{a.b}` and `$data:a.b` are one reference. */
export const unbracedReference = (reference: string): string => reference.replace(/[{}]/g, '');

const VARIABLE_CONTEXTS = new Set(['localvar', 'globalvar', 'autovar', 'var', 'transient']);
const CONTEXT_CONTEXTS = new Set([
  'local',
  'timestamp',
  'dynamic',
  'static',
  'temp',
  'step',
  'state',
  'test',
  'env',
  'foreach',
  'for',
  'fsminput',
]);

/** What a reference is, by its context: `$data:` a Qog state's data, `$config:` a config item, `@` a field. */
export const templateNodeKindOf = (reference: string | undefined): TTemplateNodeKind => {
  if (!reference) {
    return 'template';
  }
  if (reference.startsWith('@')) {
    return 'field';
  }
  const context = /^\$([\w-]+):/.exec(reference)?.[1];
  if (!context) {
    return 'template';
  }
  if (context === 'data') {
    return 'state';
  }
  if (context === 'config') {
    return 'config';
  }
  if (context === 'record') {
    return 'field';
  }
  if (VARIABLE_CONTEXTS.has(context)) {
    return 'variable';
  }
  return CONTEXT_CONTEXTS.has(context) ? 'context' : 'template';
};

/**
 * The reference every one of `references` goes on from, ending before a `.` (`$data:a` for `$data:a.b` and
 * `$data:a.c`); none where they share no such start (`$local:x` and `$timestamp:y`).
 */
const sharedReference = (references: string[]): string | undefined => {
  if (!references.length) {
    return undefined;
  }
  let shared = references[0];
  for (const reference of references.slice(1)) {
    let i = 0;
    while (i < shared.length && i < reference.length && shared[i] === reference[i]) {
      i++;
    }
    shared = shared.slice(0, i);
  }
  /* What all of them start with, cut back to a whole step: the members of `$data:a` all start `$data:a.`, and a
     group whose members are one template stands for that template's parent. */
  const dot = shared.lastIndexOf('.');
  if (dot <= 0) {
    return undefined;
  }
  const reference = shared.slice(0, dot);
  return /^\$[\w-]+:./.test(reference) || /^@./.test(reference) ? reference : undefined;
};

const writesKey = (value: string | undefined): boolean => !!value && /:\*$/.test(value);

/** A node and its members from a catalogue row. */
const nodeOf = (
  row: ITemplateCatalogueRow,
  id: string,
  trail: string[],
  trailIds: string[],
  wholeRecords?: boolean
): ITemplateNode => {
  const value = text(row.value);
  const label = text(row.label) ?? value ?? '';
  const childTrail = [...trail, label];
  const childTrailIds = [...trailIds, id];
  const children =
    Array.isArray(row.items) ?
      row.items.map((child, index) =>
        nodeOf(child, `${id}.${index}`, childTrail, childTrailIds, wholeRecords)
      )
    : undefined;
  const memberReferences = (children ?? [])
    .map((child) => child.reference)
    .filter((reference): reference is string => !!reference);
  const reference =
    value ? unbracedReference(value)
    : children?.length ? sharedReference(memberReferences)
    : undefined;
  const isGroup = !!children?.length || !!row.loadItems;
  const node: ITemplateNode = {
    id,
    label,
    value,
    reference,
    kind:
      value ? templateNodeKindOf(value)
      : isGroup ? 'group'
      : templateNodeKindOf(reference),
    type: value ? templateType(row) : undefined,
    baseType: value ? templateBaseType(row) : undefined,
    description: text(row.metadata?.description) ?? text(row.description),
    source: text(row.source),
    trail,
    trailIds,
    disabled: row.disabled,
    writesKey: writesKey(value),
    row,
  };
  if (children?.length) {
    node.children = children;
  }
  if (row.loadItems) {
    const load = row.loadItems;
    node.loadChildren = async () =>
      (await load()).map((child, index) =>
        nodeOf(child, `${id}.${index}`, childTrail, childTrailIds, wholeRecords)
      );
  }
  // a group of one context's data says it is that context's: a Qog state's members are its data
  if (node.kind === 'group' && reference) {
    const membersKind = templateNodeKindOf(reference);
    if (membersKind !== 'template') {
      node.kind = membersKind;
    }
  }
  /* Taken whole: a record that is a value of its own, where its catalogue keeps its "select whole" (a type filter
     takes it away where the record's value does not fit the field) and the field takes records at all; a Qog
     state's data, written `$data:{state}`, where the field takes records (`wholeRecords`). */
  if (isGroup) {
    const keepsWhole = !('leftAction' in row) || !!(row as { leftAction?: unknown }).leftAction;
    if (value) {
      node.takesWhole = wholeRecords !== false && keepsWhole;
    } else if (wholeRecords && reference && /^\$data:[^.{}]+$/.test(reference)) {
      node.value = `$data:{${reference.slice('$data:'.length)}}`;
      node.type = 'hash';
      node.takesWhole = true;
    }
  }
  return node;
};

/** A record's field, as a DPQL session describes it (`dpql/setContext`). */
export interface ITemplateTreeField {
  display_name?: string;
  short_desc?: string;
  desc?: string;
  type?: { name?: string } | string | string[];
}

/** The name of the group a DPQL field's record fields are listed under. */
export const RECORD_FIELDS_LABEL = 'Record fields';

export interface ITemplateTreeOptions {
  /** The record's fields, written as `@<name>`: listed as a group of their own, beside the templates. */
  fields?: Record<string, ITemplateTreeField>;
  /**
   * Whether the field takes a record whole (a field of any type, a hash, an expression): a record and a Qog state's
   * data are offered whole ("Use") as well as opened. `false` for a scalar field: they are only opened. Not given:
   * a record is offered whole where its catalogue keeps its "select whole", and a state is not.
   */
  wholeRecords?: boolean;
}

const fieldTypeName = (type: ITemplateTreeField['type']): string | undefined =>
  typeof type === 'string' ? type
  : Array.isArray(type) ? type.join(' or ')
  : type?.name;

/**
 * A record field's key as DPQL writes it (`DpqlSerializer::fieldReferenceForKey`): bare where the tokenizer reads it
 * bare and it has no dot (`@name`); else quoted, its dots escaped (`AbstractDataProvider::escapeFieldPathKey`), then
 * its quotes and its backslashes but those before a dot (`DpqlSerializer::escapeFieldPath`): `@"order-id"`,
 * `@"Unit\\.Price"`.
 */
export const fieldReference = (key: string): string => {
  if (/^[\p{L}_][\p{L}\p{M}\p{N}_]*$/u.test(key)) {
    return `@${key}`;
  }
  const path = key.replace(/\\/g, '\\\\').replace(/\./g, '\\.');
  let written = '';
  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    written +=
      char === '"' ? '\\"'
      : char === '\\' ?
        path[i + 1] === '.' ?
          '\\'
        : '\\\\'
      : char;
  }
  return `@"${written}"`;
};

/**
 * The tree of what a field can refer to: its templates as their catalogue nests them, and the record's fields as
 * a group of their own. A catalogue of one group is opened for the author: its members are the tree's top
 * (`templateItemsToShow`).
 */
export const templateTree = (
  templates?: IReqoreFormTemplates | { items?: unknown[] },
  { fields, wholeRecords }: ITemplateTreeOptions = {}
): ITemplateNode[] => {
  const rows = (templates?.items ?? []) as ITemplateCatalogueRow[];
  const roots = rows
    .filter((row) => !(row as { divider?: boolean }).divider)
    .map((row, index) => nodeOf(row, String(index), [], [], wholeRecords));
  const fieldNames = Object.keys(fields ?? {});
  if (fieldNames.length) {
    const id = String(roots.length);
    const trail = [RECORD_FIELDS_LABEL];
    roots.push({
      id,
      label: RECORD_FIELDS_LABEL,
      reference: undefined,
      kind: 'field',
      description: 'The fields of the record the expression is about',
      trail: [],
      trailIds: [],
      children: fieldNames.map((name, index) => {
        const field = fields[name];
        const value = fieldReference(name);
        /* named by its key, as it is written (`@name`) and as its chip names it ("record: name"); its display name
           and description say what it is */
        const said = [
          field?.display_name && field.display_name !== name ? field.display_name : undefined,
          field?.short_desc ?? field?.desc,
        ].filter(Boolean);
        return {
          id: `${id}.${index}`,
          label: name,
          value,
          reference: value,
          kind: 'field' as const,
          type: fieldTypeName(field?.type),
          description: said.length ? said.join(': ') : undefined,
          trail,
          trailIds: [id],
        };
      }),
    });
  }
  // a lone group is opened: its members are what there is to choose from
  if (roots.length === 1 && roots[0].children?.length && !roots[0].value) {
    return roots[0].children.map((child) => ({
      ...lift(child, roots[0].id),
    }));
  }
  return roots;
};

/** A node with the group above it taken off its trail, as it is when that group is opened for the author. */
const lift = (node: ITemplateNode, liftedId: string): ITemplateNode => {
  const at = node.trailIds.indexOf(liftedId);
  const trail = at < 0 ? node.trail : node.trail.slice(at + 1);
  const trailIds = at < 0 ? node.trailIds : node.trailIds.slice(at + 1);
  return {
    ...node,
    trail,
    trailIds,
    ...(node.children ? { children: node.children.map((child) => lift(child, liftedId)) } : {}),
  };
};

/** Every node of the tree, depth first, as far as it is loaded. */
export const allTemplateNodes = (roots: ITemplateNode[]): ITemplateNode[] => {
  const out: ITemplateNode[] = [];
  const walk = (nodes: ITemplateNode[] | undefined) => {
    for (const node of nodes ?? []) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(roots);
  return out;
};

/** The node with `id`, if the tree has it loaded. */
export const templateNodeById = (
  roots: ITemplateNode[],
  id: string | undefined
): ITemplateNode | undefined =>
  id === undefined ? undefined : allTemplateNodes(roots).find((node) => node.id === id);

/**
 * The node a written reference is: its value in either spelling (`$data:{a.b}`, `$data:a.b`), or one of the other
 * spellings its catalogue row answers to (`metadata.aliasValues`).
 */
export const templateNodeFor = (
  roots: ITemplateNode[],
  written: string
): ITemplateNode | undefined => {
  const reference = unbracedReference(written);
  return allTemplateNodes(roots).find(
    (node) =>
      (!!node.value && (node.value === written || node.reference === reference)) ||
      (Array.isArray(node.row?.metadata?.aliasValues) &&
        (node.row.metadata.aliasValues as unknown[]).some(
          (alias) =>
            typeof alias === 'string' &&
            (alias === written || unbracedReference(alias) === reference)
        ))
  );
};

/**
 * The nodes a reference being typed reaches (`$`, `$d`, `$data:`, `$data:receive_order.`, `@na`), as typing
 * narrows them: each node whose reference starts with what is typed, and not the members of one that does - the
 * group is offered, and opened for its members. `$d` and `$data` offer the states; `$data:` offers them too;
 * `$data:receive_order.` offers that state's data. Nothing that does not go on from what is typed is offered.
 */
export const searchTemplateReferences = (
  roots: ITemplateNode[],
  typed: string
): ITemplateNode[] => {
  const written = unbracedReference(typed).toLowerCase();
  /* `@` names a field of the record, as `$record:` does: a field the catalogue lists as a template
     (`$record:{pos}`) is reached by `@po` too. */
  const wanted = written.startsWith('@') ? [written, `$record:${written.slice(1)}`] : [written];
  const out: ITemplateNode[] = [];
  const walk = (nodes: ITemplateNode[] | undefined) => {
    for (const node of nodes ?? []) {
      const reference = node.reference?.toLowerCase();
      if (
        reference &&
        wanted.some((each) => reference.startsWith(each)) &&
        (node.value || node.children?.length || node.loadChildren)
      ) {
        out.push(node);
        continue;
      }
      // into a group that what is typed may go on into: one of unrelated members, or one it is typed past
      if (node.children && (!reference || wanted.some((each) => each.startsWith(reference)))) {
        walk(node.children);
      }
    }
  };
  walk(roots);
  return out;
};

/** Whether every word of `query` starts a word of `text`, or `text` holds it whole. */
const matchesWords = (text: string, query: string): boolean => {
  const haystack = text.toLowerCase();
  const words = haystack.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word) || words.some((each) => each.startsWith(word)));
};

/**
 * The nodes a search box's words find, at any depth under `within` (the tree's top when not given): a reference
 * (`$`, `@`) as typing finds it, anything else by the names of the node and the groups it is in, its value, its
 * type and its description. Its members are not listed beside a group that is found: it is opened for them.
 */
export const searchTemplateTree = (
  roots: ITemplateNode[],
  query: string,
  within?: ITemplateNode
): ITemplateNode[] => {
  const scope = within?.children ?? roots;
  const trimmed = query.trim();
  if (!trimmed) {
    return scope;
  }
  if (/^[$@]/.test(trimmed)) {
    return searchTemplateReferences(scope, trimmed);
  }
  const out: ITemplateNode[] = [];
  const walk = (nodes: ITemplateNode[] | undefined) => {
    for (const node of nodes ?? []) {
      const searched = [
        node.label,
        node.value,
        node.type,
        node.description,
        node.source,
        ...node.trail,
      ]
        .filter(Boolean)
        .join(' ');
      /* Found by all of its words, and by its own name for at least one of them: a group's members all have the
         group's name in their trail, and are found under it, not beside it. */
      const ownName = `${node.label} ${node.value ? (referenceSteps(node.value).pop() ?? '') : ''}`;
      if (
        matchesWords(searched, trimmed) &&
        trimmed.split(/\s+/).some((word) => matchesWords(ownName, word))
      ) {
        out.push(node);
        continue;
      }
      walk(node.children);
    }
  };
  walk(scope);
  return out;
};

/**
 * A reference's name as a chip says it: the outermost group, the last two steps, and "…" for the steps between
 * (`Receive order › … › address › city`); up to three steps are said whole. Its whole path is the chip's hover.
 */
export const chipPathLabel = (trail: string[], label: string): string => {
  const steps = [...trail.filter(Boolean), label];
  return steps.length <= 3 ? steps.join(' › ') : [steps[0], '…', ...steps.slice(-2)].join(' › ');
};

/** The steps a reference no catalogue lists is written in (`$data:{a.b.c}` → `a`, `b`, `c`), for its chip's name. */
export const referenceSteps = (written: string): string[] => {
  const reference = unbracedReference(written);
  const body = reference.replace(/^\$[\w-]+:/, '').replace(/^@/, '');
  return body.split('.').filter(Boolean);
};

/** The members of `node`, asking its host for them where they come only when asked; its members as loaded. */
export const loadTemplateChildren = async (node: ITemplateNode): Promise<ITemplateNode[]> => {
  if (node.children) {
    return node.children;
  }
  if (!node.loadChildren) {
    return [];
  }
  const children = await node.loadChildren();
  node.children = children;
  return children;
};

interface ICatalogueIndex {
  roots: ITemplateNode[];
  byRow: Map<ITemplateCatalogueRow, ITemplateNode>;
  byId: Map<string, ITemplateNode>;
}

/* A catalogue's tree, kept for as long as the catalogue: a form hands the same catalogue to every row it draws, and
   each chip asks for its name on every render. */
const CATALOGUE_INDEXES = new WeakMap<object, ICatalogueIndex>();

const catalogueIndex = (
  templates: IReqoreFormTemplates | { items?: unknown[] }
): ICatalogueIndex => {
  let index = CATALOGUE_INDEXES.get(templates);
  if (!index) {
    const roots = templateTree(templates);
    const nodes = allTemplateNodes(roots);
    index = {
      roots,
      byRow: new Map(nodes.filter((node) => node.row).map((node) => [node.row, node])),
      byId: new Map(nodes.map((node) => [node.id, node])),
    };
    CATALOGUE_INDEXES.set(templates, index);
  }
  return index;
};

/**
 * Where a catalogue row is, for its chip and its hover: the names of the groups it is in that are data it is part
 * of (`data`: a Qog state, a record - what a chip says before its name), and of every group it is in (`all`: with
 * the groups that only gather templates, such as Context Data - what its hover says).
 */
export const catalogueRowTrail = (
  templates: IReqoreFormTemplates | { items?: unknown[] } | undefined,
  row: unknown
): { data: string[]; all: string[] } => {
  if (!templates || !row || typeof row !== 'object') {
    return { data: [], all: [] };
  }
  const index = catalogueIndex(templates);
  const node = index.byRow.get(row as ITemplateCatalogueRow);
  if (!node) {
    return { data: [], all: [] };
  }
  const ancestors = node.trailIds.map((id) => index.byId.get(id)).filter(Boolean);
  return {
    data: ancestors.filter((ancestor) => !!ancestor.reference).map((ancestor) => ancestor.label),
    all: node.trail,
  };
};

/** What a template's color says (`getTemplateTagStyle`), the same on its chip, its row's badge and its hover. */
export type TTemplateIntent = 'success' | 'custom1' | 'info';

/**
 * What each color a template is drawn in means, as its hover says it (qorus#646, David: "what is the significance
 * of the colors?"): green is the data of the event that starts the Qog, purple a value Qorus gives, blue any other
 * template (which its hover does not need to say).
 */
export const TEMPLATE_INTENT_MEANINGS: Record<TTemplateIntent, string> = {
  success: 'From the event that starts the Qog.',
  custom1: 'A value Qorus gives.',
  info: 'Any other data this value can use.',
};

/** The color a catalogue row's template is drawn in: its own metadata's, else its first member's. */
export const templateRowIntent = (
  metadata: Record<string, unknown> | undefined
): TTemplateIntent =>
  metadata?.isEventTrigger ? 'success'
  : metadata?.builtIn ? 'custom1'
  : 'info';

/** The color a node is drawn in: its row's, or for a group, that of the first of its members that has one. */
export const templateNodeIntent = (node: ITemplateNode): TTemplateIntent => {
  const metadata = node.row?.metadata;
  if (metadata && (metadata.isEventTrigger || metadata.builtIn || node.value)) {
    return templateRowIntent(metadata);
  }
  const member = node.children?.find((child) => child.row?.metadata);
  return member ? templateNodeIntent(member) : templateRowIntent(metadata);
};

/* A catalogue's tree with each Qog state's data a value of its own (`$data:{state}`), kept for as long as the
   catalogue, for the name of a state taken whole. */
const WHOLE_STATE_TREES = new WeakMap<object, ITemplateNode[]>();

/**
 * The group a reference stands for whole, where no row of the catalogue is it: a Qog state's data taken whole
 * (`$data:{receive_order}`) is named by its state ("Receive order"), its whole path its hover's.
 */
export const catalogueGroupFor = (
  templates: IReqoreFormTemplates | { items?: unknown[] } | undefined,
  written: string
): { label: string; path: string; row?: ITemplateCatalogueRow } | undefined => {
  if (!templates) {
    return undefined;
  }
  let roots = WHOLE_STATE_TREES.get(templates);
  if (!roots) {
    roots = templateTree(templates, { wholeRecords: true });
    WHOLE_STATE_TREES.set(templates, roots);
  }
  const node = templateNodeFor(roots, written);
  return node && (node.children?.length || node.loadChildren) ?
      { label: node.label, path: [...node.trail, node.label].join(' › '), row: node.row }
    : undefined;
};

/**
 * Whether a reference names nothing the field is given (qorus#646, David's review: a half-typed reference was left
 * standing as if it were one): a reference into a context whose templates the catalogue lists, every one, which
 * none of them is. A context the catalogue lists nothing of, or one whose keys are written freely (`$dynamic:*`),
 * or a part of the catalogue not loaded yet, says nothing either way.
 */
export const referenceNamesNothing = (roots: ITemplateNode[], written: string): boolean => {
  const reference = unbracedReference(written);
  const context = /^(\$[\w-]+:)./.exec(reference)?.[1];
  if (!context || context === '$record:') {
    return false;
  }
  const nodes = allTemplateNodes(roots);
  const inContext = nodes.filter(
    (node) =>
      node.reference?.startsWith(context) || (typeof node.value === 'string' && node.value.startsWith(context))
  );
  if (!inContext.length || inContext.some((node) => node.writesKey)) {
    return false;
  }
  if (templateNodeFor(roots, written)) {
    return false;
  }
  // inside a group whose members are not loaded yet: not known to be nothing
  return !inContext.some(
    (node) =>
      !!node.loadChildren &&
      !node.children?.length &&
      !!node.reference &&
      reference.startsWith(`${unbracedReference(node.reference)}.`)
  );
};

/** What a diagnostic says of a reference that names nothing here. */
export const referenceNamesNothingMessage = (written: string): string =>
  `No template here is called \`${written}\`: pick one from the list, or remove it.`;
