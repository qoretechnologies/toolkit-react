// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Template catalogues as Qorus gives them, for the stories' stand-in servers (qorus#646, David: each story shows
 * what a real field of its kind shows).
 *
 * `templateCatalogueFixtures/*.json` are Qorus's own responses for typical fields, written by its catalogue
 * (Qorus `test/template-catalogue-fixtures`, `UPDATE_TEMPLATE_CATALOGUE_FIXTURES=1
 * test/QorusTemplateCatalogue.unit.qtest`; `design/template-strings.md` §8.5), copied here unchanged: refresh them
 * from there when Qorus's catalogue changes. What a story adds to one - a Qog's state data, a record's fields - is
 * built as Qorus's catalogue builds it (`QorusTemplateCatalogue::makeStateDataKeys()`, `makeRecordKeys()`).
 *
 * The completions a DPQL document's template being written gets are made from the catalogue as Qorus makes them
 * (`QorusTemplateCatalogue::listContexts()` / `listValues()`) and as Qore's `DpqlCompletionProvider` turns those into
 * completion items (`getTemplateContextCompletions()` / `getTemplateValueCompletions()`).
 */
import type {
  ITemplateCatalogue,
  ITemplateCatalogueContext,
  ITemplateCatalogueKey,
} from '../helpers/templateCatalogue';
import alertPayload from './templateCatalogueFixtures/alert-payload.json';
import genericSandboxed from './templateCatalogueFixtures/generic-sandboxed.json';
import generic from './templateCatalogueFixtures/generic.json';
import job from './templateCatalogueFixtures/job.json';
import qogLoops from './templateCatalogueFixtures/qog-loops.json';
import qogUnhosted from './templateCatalogueFixtures/qog-unhosted.json';
import qogWorkflowHost from './templateCatalogueFixtures/qog-workflow-host.json';
import service from './templateCatalogueFixtures/service.json';
import workflowTypedStatic from './templateCatalogueFixtures/workflow-typed-static.json';
import workflowUntypedStatic from './templateCatalogueFixtures/workflow-untyped-static.json';
import writeMode from './templateCatalogueFixtures/write-mode.json';

interface IFixture {
  description: string;
  response: ITemplateCatalogue;
}

/** Qorus's catalogues for typical fields, by the fixture's name. */
export const TEMPLATE_CATALOGUE_FIXTURES = {
  'alert-payload': alertPayload,
  'generic-sandboxed': genericSandboxed,
  generic,
  job,
  'qog-loops': qogLoops,
  'qog-unhosted': qogUnhosted,
  'qog-workflow-host': qogWorkflowHost,
  service,
  'workflow-typed-static': workflowTypedStatic,
  'workflow-untyped-static': workflowUntypedStatic,
  'write-mode': writeMode,
} as unknown as Record<TTemplateCatalogueFixture, IFixture>;

export type TTemplateCatalogueFixture =
  | 'alert-payload'
  | 'generic-sandboxed'
  | 'generic'
  | 'job'
  | 'qog-loops'
  | 'qog-unhosted'
  | 'qog-workflow-host'
  | 'service'
  | 'workflow-typed-static'
  | 'workflow-untyped-static'
  | 'write-mode';

/** A fixture's catalogue, a copy of its own. */
export const templateCatalogueFixture = (name: TTemplateCatalogueFixture): ITemplateCatalogue =>
  structuredClone(TEMPLATE_CATALOGUE_FIXTURES[name].response);

/** Qorus's spelling of a template (`QorusTemplateCatalogue::makeTemplate()`): braced where the path is not a name. */
const makeTemplate = (context: string, path: string): string =>
  path === '*' || /^\w+[\w.]*$/.test(path) ?
    `$${context}:${path}`
  : `$${context}:{${path.replace(/\\/g, '\\\\').replace(/[{}]/g, '\\$&')}}`;

const makeKey = (
  context: string,
  name: string,
  parent: string | undefined,
  facts: { display_name?: string; type?: string; description?: string },
  source: string
): ITemplateCatalogueKey => {
  const path = parent ? `${parent}.${name}` : name;
  return {
    name,
    path,
    template: makeTemplate(context, path),
    use_whole: false,
    free_form_keys: false,
    source,
    ...(facts.display_name ? { display_name: facts.display_name } : {}),
    ...(facts.type ? { type: facts.type } : {}),
    ...(facts.description ? { description: facts.description } : {}),
  };
};

/** A Qog's state data, as `dpql/setFsmContext` gives its states: each with its display name and items. */
export type TStoryStateData = Record<
  string,
  {
    display_name?: string;
    short_desc?: string;
    items?: Array<{
      name: string;
      display_name?: string;
      type?: string;
      base_type?: string;
      short_desc?: string;
      items?: unknown[];
    }>;
  }
>;

type TStateItem = NonNullable<TStoryStateData[string]['items']>[number];

const stateItemKeys = (items: TStateItem[], parent: string): ITemplateCatalogueKey[] =>
  items
    .filter((item) => !!item.name)
    .map((item) => {
      /* a key's name in its parent: a flat payload names an item by its path in its state (`customer.name`,
         `doGetFlatOutputInfo()`) */
      const key = makeKey(
        'data',
        item.name.split('.').pop()!,
        parent,
        { display_name: item.display_name, type: item.type, description: item.short_desc },
        'state-data'
      );
      if (item.base_type) key.base_type = item.base_type;
      if (item.items?.length) {
        key.keys = stateItemKeys(item.items as TStateItem[], key.path);
        key.use_whole = true;
      }
      return key;
    });

/** The catalogue with the Qog's state data as `$data:`'s keys (`makeStateDataKeys()`); none, no `$data:`. */
export const withStateData = (
  catalogue: ITemplateCatalogue,
  stateData: TStoryStateData | undefined
): ITemplateCatalogue => {
  // no state data given: the catalogue's own
  if (!stateData) return catalogue;
  const keys = Object.entries(stateData)
    .filter(([state]) => !state.startsWith('_'))
    .map(([state, info]) => {
      const key = makeKey(
        'data',
        state,
        undefined,
        { display_name: info.display_name, type: 'hash<auto>', description: info.short_desc },
        'state-data'
      );
      key.use_whole = true;
      if (info.items?.length) key.keys = stateItemKeys(info.items, key.path);
      return key;
    });
  const contexts = catalogue.contexts.filter((context) => context.name !== 'data');
  if (!keys.length) return { ...catalogue, contexts };
  const data: ITemplateCatalogueContext = {
    name: 'data',
    display_name: 'Qog state data',
    description: 'The output data of the Qog states that run before this one',
    kind: 'container',
    sort_priority: 3,
    use_whole: true,
    free_form_keys: false,
    needs_arg: true,
    writable: false,
    type: 'hash<auto>',
    keys,
    whole_template: '$data:*',
  };
  // after the contexts Qorus lists before it (`local`, `fsminput`)
  const at = contexts.findIndex((context) => (context.sort_priority ?? 99) > 3);
  return {
    ...catalogue,
    contexts: at < 0 ? [...contexts, data] : [...contexts.slice(0, at), data, ...contexts.slice(at)],
  };
};

/** A record's fields, as a DPQL document is bound to them: each with its type, name and description. */
export type TStoryRecordFields = Record<
  string,
  { type?: string | { name?: string }; display_name?: string; short_desc?: string; desc?: string }
>;

/**
 * The catalogue of a record expression (`record_expression`): `$record:` with the record's fields as its keys
 * (`makeRecordKeys()`), its keys written freely where the fields are not known; a search condition cannot use the
 * whole record.
 */
export const withRecord = (
  catalogue: ITemplateCatalogue,
  fields: TStoryRecordFields | undefined,
  search = false
): ITemplateCatalogue => {
  // a record's fields not given: the catalogue's own record context, if it has one
  if (!fields && catalogue.contexts.some((context) => context.name === 'record')) return catalogue;
  const keys = Object.entries(fields ?? {}).map(([name, field]) =>
    makeKey(
      'record',
      name,
      undefined,
      {
        display_name: field.display_name,
        type: typeof field.type === 'string' ? field.type : field.type?.name,
        description: field.short_desc ?? field.desc,
      },
      'record'
    )
  );
  const record: ITemplateCatalogueContext = {
    name: 'record',
    display_name: 'Current record',
    description: 'A field of the current record',
    kind: 'container',
    sort_priority: 13,
    use_whole: !search,
    free_form_keys: !keys.length,
    needs_arg: true,
    writable: false,
    ...(search ? {} : { type: 'hash<auto>', whole_template: '$record:*' }),
    ...(keys.length ? { keys } : {}),
  };
  const contexts = catalogue.contexts.filter((context) => context.name !== 'record');
  const at = contexts.findIndex((context) => (context.sort_priority ?? 99) > 13);
  return {
    ...catalogue,
    contexts:
      at < 0 ? [...contexts, record] : [...contexts.slice(0, at), record, ...contexts.slice(at)],
  };
};

/** The aliases Qorus reads as another context (`getCanonicalContext()`); never offered, but written they work. */
const ALIASES: Record<string, string> = { globalvar: 'transient', localvar: 'var' };

const findKey = (
  keys: ITemplateCatalogueKey[] | undefined,
  path: string
): ITemplateCatalogueKey | undefined => {
  for (const key of keys ?? []) {
    if (key.path === path) return key;
    if (path.startsWith(`${key.path}.`)) return findKey(key.keys, path);
  }
  return undefined;
};

/** `QorusTemplateCatalogue::listValues()`: what can follow `$ctx:` - `*` first where the context is used whole. */
export const catalogueValues = (
  catalogue: ITemplateCatalogue,
  context: string,
  prefix: string
):
  | Array<{
      name: string;
      display_name?: string;
      type?: string;
      description: string;
      template?: string;
      use_whole?: boolean;
    }>
  | undefined => {
  const canonical = ALIASES[context] ?? context;
  const info = catalogue.contexts.find((each) => each.name === canonical);
  if (!info) return undefined;
  const out: NonNullable<ReturnType<typeof catalogueValues>> = [];
  let candidates: ITemplateCatalogueKey[] = [];
  const dot = prefix.lastIndexOf('.');
  if (dot < 0) {
    if (info.use_whole && (!prefix || prefix === '*')) {
      out.push({
        name: '*',
        type: info.type ?? 'hash<auto>',
        description: `All of ${(info.display_name ?? info.name).toLowerCase()}: ${info.whole_template}`,
        template: info.whole_template,
        use_whole: true,
      });
    }
    candidates = info.keys ?? [];
  } else {
    candidates = [
      ...(findKey(info.keys, prefix.slice(0, dot))?.keys ?? []),
      // loop levels are keys whose names hold a dot ("1.value")
      ...(info.keys ?? []).filter((key) => key.path.includes('.')),
    ];
  }
  const wanted = prefix.toLowerCase();
  for (const key of candidates) {
    if (wanted && !key.path.toLowerCase().startsWith(wanted)) continue;
    out.push({
      name: key.path,
      display_name: key.display_name,
      type: key.type,
      description:
        key.description ??
        `${info.display_name} ${key.path}${key.type ? ` (${key.type})` : ''}`,
      template: key.template,
      ...(key.use_whole ? { use_whole: true } : {}),
    });
  }
  return out;
};

/**
 * The completions a DPQL document's template being written gets (`written`: `$`, `$lo`, `$local:`, `$data:s1.`), as
 * Qore's `DpqlCompletionProvider` makes them from Qorus's lists: the contexts its name starts, each labelled as it is
 * written and sorted so; after the `:`, the context's values, each written whole and labelled by its name where it
 * has one. `typeName` names a value's type as Qore's DataTypeCatalogue does.
 */
export const catalogueCompletions = (
  catalogue: ITemplateCatalogue,
  written: string,
  typeName: (type: string) => string = (type) => type
) => {
  const rest = written.slice(1);
  const colon = rest.indexOf(':');
  if (colon < 0) {
    const wanted = rest.toLowerCase();
    return catalogue.contexts
      .filter(({ name }) => name.toLowerCase().startsWith(wanted))
      .map((context) => ({
        label: `$${context.name}:`,
        kind: 6,
        insertText: `$${context.name}:`,
        filterText: `$${context.name}:`,
        ...(context.needs_arg !== false ? { detail: "needs a value after ':'" } : {}),
        documentation: context.description ?? `Template context: ${context.name}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  const context = rest.slice(0, colon);
  const prefix = rest.slice(colon + 1);
  return (catalogueValues(catalogue, context, prefix) ?? []).map((value) => {
    const raw = `$${context}:${value.name}`;
    return {
      label: value.display_name ?? raw,
      kind: 6,
      insertText: raw,
      filterText: raw,
      ...(value.type ? { detail: typeName(value.type) } : {}),
      documentation: value.description,
    };
  });
};

/** The catalogue a stand-in server gives a DPQL document: the story's own, else a record expression's. */
export const storyDpqlCatalogue = (options: {
  catalogue?: TTemplateCatalogueFixture | ITemplateCatalogue;
  stateData?: TStoryStateData;
  fields?: TStoryRecordFields;
}): ITemplateCatalogue => {
  const base =
    typeof options.catalogue === 'string' ? templateCatalogueFixture(options.catalogue)
    : options.catalogue ? structuredClone(options.catalogue)
    : // a document bound to a Qog that nothing runs but on demand, else one with no context
      templateCatalogueFixture(options.stateData ? 'qog-unhosted' : 'generic');
  // Qorus: "a DPQL document is an expression on a record unless the client says otherwise"
  return withRecord(withStateData(base, options.stateData), options.fields);
};

const DECLARATION_SCOPES: Record<string, 'globalvar' | 'localvar' | 'autovar'> = {
  transient: 'globalvar',
  var: 'localvar',
  autovar: 'autovar',
};
const SCOPE_WORDS: Record<string, string> = {
  globalvar: 'the global variable %s, so it reads as nothing; declare it in the Qog\'s global variables',
  localvar: 'the local variable %s here, so it reads as nothing; declare it in the Qog\'s local variables',
  autovar: 'the automatic variable %s here, so it reads as nothing; declare it in the Qog\'s automatic variables',
};

/**
 * The warnings Qorus's language server gives a DPQL document in a Qog for each variable a template uses that the Qog
 * does not declare where the document is (`getDpqlUndeclaredVariableDiagnostics()`): code `qog_variable_undeclared`,
 * with where to declare it (`declare.scope`). One per variable.
 */
export const undeclaredVariableDiagnostics = (catalogue: ITemplateCatalogue, text: string) => {
  const reported = new Set<string>();
  const out: Array<Record<string, unknown>> = [];
  const pattern = /\$(transient|globalvar|var|localvar|autovar):(\{([^}]*)\}|([\w.]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const type = ALIASES[match[1]] ?? match[1];
    const arg = match[3] ?? match[4] ?? '';
    const name = arg.split(/[.[]/)[0].trim();
    if (!name || name === '*') continue;
    const declared = catalogue.contexts
      .find((context) => context.name === type)
      ?.keys?.some((key) => key.name === name);
    if (declared || reported.has(`${type}:${name}`)) continue;
    reported.add(`${type}:${name}`);
    const scope = DECLARATION_SCOPES[type];
    const before = text.slice(0, match.index);
    const line = before.split('\n').length - 1;
    const character = match.index - (before.lastIndexOf('\n') + 1);
    out.push({
      range: {
        start: { line, character },
        end: { line, character: character + match[0].length },
      },
      message: `The Qog does not declare ${SCOPE_WORDS[scope].replace('%s', name)}.`,
      severity: 2,
      code: 'qog_variable_undeclared',
      source: 'dpql',
      data: {
        failure_kind: 'qog_variable_undeclared',
        variable_type: type,
        variable_name: name,
        template: match[0],
        declare: { scope },
      },
    });
  }
  return out;
};
