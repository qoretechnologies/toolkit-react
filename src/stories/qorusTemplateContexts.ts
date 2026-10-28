// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The template contexts and values a Qorus server offers, for the stories' stand-in language servers to answer as
 * the real one does (qorus#646, David: each story shows what a real field of its interface shows).
 *
 * Mirrors Qorus `Classes/QorusClientServer.qc`:
 * - `listTemplateContexts()` - every context, then filtered by the template context: `record` only for a record
 *   expression; `env`, `python-expr`, `rest` and `sysprop` not for a sandboxed user; by interface type, the
 *   workflow-only contexts (`static`, `dynamic`, `sensitive`, `sensitive-alias`, `temp`, `step`, `keys`) only in a
 *   workflow, `jinfo` only in a job, `state` only in a job or a service, and in a Qog (`fsm`) no `pstate` or `info`;
 * - `listTemplateValues()` - the values it knows: the timestamps, a loop's, and a Qog's state data (`data`, only
 *   with state data bound); any other context lists none - its keys are known only when it runs.
 *
 * and `Classes/QorusLspWebSocketHandler.qc` `buildDpqlTemplateContext()`: a DPQL document is always completed as a
 * Qog's (`interface_type: "fsm"`, a record expression), with the state data of the Qog it is bound to.
 *
 * PENDING (qorus#646 round 4: the contract a Qorus agent is building; this mirror follows it until it lands, then
 * follows the code): each context offered only where it is valid - `$transient:`/`$globalvar:` where transient
 * variables are defined, `$var:`/`$localvar:` where block-local ones are, `$autovar:` where auto variables are,
 * `$foreach:`/`$for:` inside such a loop - and marked a container or a leaf, with its known keys (nested), whether it
 * can be used whole (`$ctx:*`: UserApi `_priv_get_template_arg` reads `*` as an argument, and `getHashDotValue()`
 * gives the whole hash for it), its type, and whether its keys are free (written by the user).
 */

export type TQorusInterfaceType = 'wf' | 'svc' | 'job' | 'fsm';

export interface IQorusTemplateContext {
  /** `wf`, `svc`, `job` or `fsm` (a Qog). */
  interface_type?: TQorusInterfaceType;
  record_expression?: boolean;
  sandboxed?: boolean;
  /** PENDING: the transient variables (`$transient:`), block-local (`$var:`) and auto variables defined here. */
  transient_vars?: string[];
  local_vars?: string[];
  auto_vars?: string[];
  /** PENDING: the loops the field is inside of, by kind (`$foreach:`, `$for:`). */
  loops?: { foreach?: boolean; for?: boolean };
  /** PENDING: the keys of the local context (`UserApi::getUserContextInfo()`) and a workflow's declared static data. */
  local_keys?: IQorusTemplateKey[];
  static_keys?: IQorusTemplateKey[];
  /** The bound Qog's state data, by state: each with its display name and items. */
  state_data?: Record<
    string,
    {
      display_name?: string;
      items?: Array<{ name: string; display_name?: string; type?: string; short_desc?: string }>;
    }
  >;
}

/** PENDING: a known key of a context, or of a key that is a container itself (nested). */
export interface IQorusTemplateKey {
  name: string;
  display_name?: string;
  type?: string;
  description?: string;
  container?: boolean;
  use_whole?: boolean;
  free_keys?: boolean;
  keys?: IQorusTemplateKey[];
}

export interface IQorusTemplateContextInfo {
  name: string;
  description: string;
  needs_arg: boolean;
  /** PENDING: a container (it holds keys) or a leaf (a value written after it, `$timestamp:now`). */
  container: boolean;
  /** PENDING: whether it can be used whole, `$<name>:*`. */
  use_whole: boolean;
  /** PENDING: whether its keys are written freely, not all known (`$dynamic:`). */
  free_keys: boolean;
  type?: string;
}

/** The contexts read as a hash with `*` for the whole of it (UserApi `expandOneVariable()`: `getHashDotValue()`, or
 *  an explicit `"*"` case). */
const WHOLE_CONTEXTS = new Set([
  'autovar',
  'config',
  'data',
  'dynamic',
  'env',
  'for',
  'foreach',
  'fsminput',
  'globalvar',
  'local',
  'localvar',
  'record',
  'static',
  'transient',
  'var',
  'xconfig',
]);
/** The contexts written after their `:` as an expression or a single value, not keys: leaves. */
const LEAF_CONTEXTS = new Set([
  'parse-value',
  'python-expr',
  'qore-expr',
  'rest',
  'sysprop',
  'timestamp',
  'value-map',
]);
/** The contexts whose keys are written freely: not all known where the field is edited. */
const FREE_KEY_CONTEXTS = new Set([
  'dynamic',
  'static',
  'temp',
  'sensitive',
  'sensitive-alias',
  'keys',
  'pstate',
  'state',
  'step',
  'env',
  'rest',
  'sysprop',
  'value-map',
  'fsminput',
  'info',
  'jinfo',
]);

const CONTEXTS: Array<[string, string]> = [
  ['autovar', 'Automatically-managed variable data — type: `$autovar:field_name`'],
  ['config', 'Interface configuration item values — type: `$config:item_name`'],
  ['data', 'Qog state data — type: `$data:{state_id.field}`'],
  ['dynamic', 'Workflow dynamic data — type: `$dynamic:field_name`'],
  ['env', 'System environment variables — type: `$env:VAR_NAME`'],
  ['for', 'For loop value — use: `$for:value`'],
  [
    'foreach',
    'Foreach loop variables — use: `$foreach:value`, `$foreach:index`, or `$foreach:size`',
  ],
  ['fsminput', 'Qog input data — type: `$fsminput:field_name`'],
  ['globalvar', 'Alias for `$transient:{}` — type: `$globalvar:var_name`'],
  ['info', 'Current interface information (job, service, or workflow) — type: `$info:field_name`'],
  ['jinfo', 'Job information (job context only) — type: `$jinfo:field_name`'],
  ['keys', 'Workflow order keys — type: `$keys:key_name`'],
  ['local', 'Local context data passed to the current operation — type: `$local:field_name`'],
  ['localvar', 'Alias for `$var:{}` — type: `$localvar:var_name`'],
  ['parse-value', 'Parse a string value to a Qore value — type: `$parse-value:string_value`'],
  ['pstate', 'Persistent state data (job, service, or workflow) — type: `$pstate:key`'],
  ['python-expr', 'Python expression evaluation — type: `$python-expr:expression`'],
  ['qore-expr', 'Qore expression evaluation — type: `$qore-expr:{expression}`'],
  ['record', 'Current data provider record field — type: `$record:{field_name}`'],
  ['rest', 'REST API call result — type: `$rest:uri_path.field`'],
  ['sensitive', 'Workflow sensitive data — type: `$sensitive:skey.svalue.field`'],
  ['sensitive-alias', 'Workflow sensitive data by alias — type: `$sensitive-alias:alias.field`'],
  ['state', 'Interface persistent state data (service or job) — type: `$state:key`'],
  ['static', 'Workflow static data — type: `$static:field_name`'],
  ['step', 'Workflow step data from context — type: `$step:field_name`'],
  ['sysprop', 'System property values — type: `$sysprop:domain.key`'],
  ['temp', 'Workflow temporary data — type: `$temp:field_name`'],
  [
    'timestamp',
    'Timestamp values — use: `$timestamp:now`, `$timestamp:timegm`, `$timestamp:last_midnight`, `$timestamp:next_midnight`, or a date format string',
  ],
  [
    'transient',
    'Transient (global) variable data for the current interface — type: `$transient:var_name`',
  ],
  ['value-map', 'Value map lookup — type: `$value-map:valuemap.key`'],
  ['var', 'Block-local variable data — type: `$var:var_name`'],
  ['xconfig', 'Interface-level configuration item values — type: `$xconfig:item_name`'],
];

const SANDBOXED_BLOCKED = new Set(['env', 'python-expr', 'rest', 'sysprop']);
const WORKFLOW_ONLY = new Set([
  'static',
  'dynamic',
  'sensitive',
  'sensitive-alias',
  'temp',
  'step',
  'keys',
]);

/** `QorusClientServer::listTemplateContexts()`: the contexts a field of `context` is offered, by name. */
export const qorusTemplateContexts = (
  context?: IQorusTemplateContext
): IQorusTemplateContextInfo[] => {
  let contexts = CONTEXTS.map(([name, description]) => ({
    name,
    description,
    needs_arg: true,
    container: !LEAF_CONTEXTS.has(name),
    use_whole: WHOLE_CONTEXTS.has(name),
    // a workflow's static data has its keys where its type declares them
    free_keys: FREE_KEY_CONTEXTS.has(name) && !(name === 'static' && context?.static_keys?.length),
  }));
  if (!context) {
    return contexts.filter(({ name }) => name !== 'record');
  }
  if (!context.record_expression) {
    contexts = contexts.filter(({ name }) => name !== 'record');
  }
  if (context.sandboxed) {
    contexts = contexts.filter(({ name }) => !SANDBOXED_BLOCKED.has(name));
  }
  const type = context.interface_type;
  if (type) {
    if (type !== 'wf') contexts = contexts.filter(({ name }) => !WORKFLOW_ONLY.has(name));
    if (type !== 'job') contexts = contexts.filter(({ name }) => name !== 'jinfo');
    if (type !== 'job' && type !== 'svc')
      contexts = contexts.filter(({ name }) => name !== 'state');
    if (type === 'fsm')
      contexts = contexts.filter(({ name }) => name !== 'pstate' && name !== 'info');
  }
  // PENDING: a context of variables only where some are defined, a loop's only inside one
  const defined: Record<string, unknown[] | boolean | undefined> = {
    transient: context.transient_vars,
    globalvar: context.transient_vars,
    var: context.local_vars,
    localvar: context.local_vars,
    autovar: context.auto_vars,
    foreach: context.loops?.foreach,
    for: context.loops?.for,
  };
  return contexts.filter(({ name }) => {
    if (!(name in defined)) return true;
    const has = defined[name];
    return Array.isArray(has) ? has.length > 0 : !!has;
  });
};

/** `QorusClientServer::listTemplateValues()`: the values Qorus knows in a context; none for any other. */
export const qorusTemplateValues = (
  ctx: string,
  prefix: string,
  context?: IQorusTemplateContext
):
  | Array<{ name: string; display_name?: string; type?: string; description: string }>
  | undefined => {
  switch (ctx) {
    case 'timestamp':
      return [
        { name: 'now', description: 'Current date/time with microseconds' },
        { name: 'timegm', description: 'Current time as seconds since epoch (GMT)' },
        { name: 'last_midnight', description: 'Last midnight (start of today)' },
        { name: 'next_midnight', description: 'Next midnight (start of tomorrow)' },
      ];
    case 'foreach':
      return [
        { name: 'value', description: 'Current iteration value' },
        { name: 'index', description: 'Current iteration index (0-based)' },
        { name: 'size', description: 'Total number of iterations' },
      ];
    case 'for':
      return [{ name: 'value', description: 'Current for loop value' }];
    // PENDING: the keys Qorus knows where the field is edited
    case 'local':
      return context?.local_keys?.map((key) => ({
        ...key,
        description: key.description ?? key.name,
      }));
    case 'static':
      return context?.static_keys?.map((key) => ({
        ...key,
        description: key.description ?? key.name,
      }));
    case 'transient':
    case 'globalvar':
      return context?.transient_vars?.map((name) => ({
        name,
        description: `Transient variable ${name}`,
      }));
    case 'var':
    case 'localvar':
      return context?.local_vars?.map((name) => ({
        name,
        description: `Block-local variable ${name}`,
      }));
    case 'autovar':
      return context?.auto_vars?.map((name) => ({ name, description: `Auto variable ${name}` }));
    case 'data': {
      if (!context?.state_data) return undefined;
      const dot = prefix.indexOf('.');
      return Object.entries(context.state_data).flatMap(([key, state]) => {
        if (dot >= 0) {
          if (key !== prefix.slice(0, dot)) return [];
          const field = prefix.slice(dot + 1).toLowerCase();
          return (state.items ?? [])
            .filter((item) => !field || item.name.toLowerCase().startsWith(field))
            .map((item) => ({
              name: `${key}.${item.name}`,
              display_name: item.display_name,
              type: item.type,
              description:
                item.short_desc ?? `State data field: ${item.name} (${item.type ?? 'auto'})`,
            }));
        }
        return !prefix || key.toLowerCase().startsWith(prefix.toLowerCase()) ?
            [
              {
                name: key,
                display_name: state.display_name,
                description: state.display_name ?? `State: ${key}`,
              },
            ]
          : [];
      });
    }
    default:
      return undefined;
  }
};

/**
 * The completions a DPQL document's template being written gets, as Qore's `DpqlCompletionProvider` makes them from
 * the two lists (`getTemplateContextCompletions`, `getTemplateValueCompletions`): `$` and a context's name, the
 * contexts it starts; after the `:`, the context's values, each written whole.
 */
export const qorusTemplateCompletions = (written: string, context?: IQorusTemplateContext) => {
  const rest = written.slice(1);
  const colon = rest.indexOf(':');
  const contexts = qorusTemplateContexts(context);
  if (colon < 0) {
    return contexts
      .filter(({ name }) => name.startsWith(rest))
      .map(({ name, description, container, use_whole, free_keys }) => ({
        label: `$${name}:`,
        kind: 6,
        insertText: `$${name}:`,
        filterText: `$${name}:`,
        detail: "needs a value after ':'",
        documentation: description,
        // PENDING: what it is, for the editor to go on into it and take it whole
        data: { container, use_whole, free_keys },
      }));
  }
  const ctx = rest.slice(0, colon);
  const prefix = rest.slice(colon + 1);
  const info = contexts.find(({ name }) => name === ctx);
  if (!info) return [];
  const values = (qorusTemplateValues(ctx, prefix, context) ?? [])
    .filter((value) => ctx === 'data' || value.name.startsWith(prefix))
    .map((value) => ({
      label: value.display_name ?? `$${ctx}:${value.name}`,
      kind: 6,
      insertText: `$${ctx}:${value.name}`,
      filterText: `$${ctx}:${value.name}`,
      ...(value.type ? { detail: value.type } : {}),
      documentation: value.description,
      // a Qog's state is a container of its own: its data, and the whole of it
      ...(ctx === 'data' && !value.name.includes('.') ?
        { data: { container: true, use_whole: true } }
      : {}),
    }));
  // PENDING: the whole of a context that can be used whole, `$<name>:*`
  const whole =
    info.use_whole && (!prefix || '*'.startsWith(prefix)) ?
      [
        {
          label: `$${ctx}:*`,
          kind: 6,
          insertText: `$${ctx}:*`,
          filterText: `$${ctx}:*`,
          detail: 'all of it',
          documentation: `The whole of ${info.description.split(' — ')[0].toLowerCase()}`,
          data: { whole: true },
        },
      ]
    : [];
  return [...whole, ...values];
};

/** `buildDpqlTemplateContext()`: a DPQL document's template context, always a Qog's. */
export const dpqlTemplateContext = (
  stateData?: IQorusTemplateContext['state_data']
): IQorusTemplateContext => ({
  interface_type: 'fsm',
  record_expression: true,
  ...(stateData ? { state_data: stateData } : {}),
});
