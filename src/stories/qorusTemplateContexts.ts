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
 */

export type TQorusInterfaceType = 'wf' | 'svc' | 'job' | 'fsm';

export interface IQorusTemplateContext {
  /** `wf`, `svc`, `job` or `fsm` (a Qog). */
  interface_type?: TQorusInterfaceType;
  record_expression?: boolean;
  sandboxed?: boolean;
  /** The bound Qog's state data, by state: each with its display name and items. */
  state_data?: Record<
    string,
    {
      display_name?: string;
      items?: Array<{ name: string; display_name?: string; type?: string; short_desc?: string }>;
    }
  >;
}

export interface IQorusTemplateContextInfo {
  name: string;
  description: string;
  needs_arg: boolean;
}

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
  let contexts = CONTEXTS.map(([name, description]) => ({ name, description, needs_arg: true }));
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
  return contexts;
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
  if (colon < 0) {
    return qorusTemplateContexts(context)
      .filter(({ name }) => name.startsWith(rest))
      .map(({ name, description }) => ({
        label: `$${name}:`,
        kind: 6,
        insertText: `$${name}:`,
        filterText: `$${name}:`,
        detail: "needs a value after ':'",
        documentation: description,
      }));
  }
  const ctx = rest.slice(0, colon);
  const prefix = rest.slice(colon + 1);
  return (qorusTemplateValues(ctx, prefix, context) ?? [])
    .filter((value) => ctx === 'data' || value.name.startsWith(prefix))
    .map((value) => ({
      label: value.display_name ?? `$${ctx}:${value.name}`,
      kind: 6,
      insertText: `$${ctx}:${value.name}`,
      filterText: `$${ctx}:${value.name}`,
      ...(value.type ? { detail: value.type } : {}),
      documentation: value.description,
    }));
};

/** `buildDpqlTemplateContext()`: a DPQL document's template context, always a Qog's. */
export const dpqlTemplateContext = (
  stateData?: IQorusTemplateContext['state_data']
): IQorusTemplateContext => ({
  interface_type: 'fsm',
  record_expression: true,
  ...(stateData ? { state_data: stateData } : {}),
});
