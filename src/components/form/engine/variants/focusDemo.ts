/**
 * A richer, realistic demo schema for the Focus-Pro variant — exercises the
 * features the basic fixture lacks: NAMED groups, a one-of REQUIRED GROUP,
 * a complex nested hash (Show-more preview), allowed-values, files/lists, plus
 * a mix of set / invalid / required-unset / optional states. Modelled loosely
 * on a Qorus datasource connection config.
 */
import { IQorusFormField, IQorusFormSchema } from '@qoretechnologies/ts-toolkit';

export const getFocusDemoOptions = (): IQorusFormSchema =>
  ({
    // --- Connection -------------------------------------------------------
    url: {
      type: 'string',
      ui_type: 'string',
      display_name: 'Connection URL',
      short_desc: 'The full datasource URL (driver://user@host:port/db).',
      desc: 'Accepts any Qore datasource URL. Templates like `$config:db-url` are supported.',
      group: 'connection',
      required: true,
      supports_templates: true,
    },
    port: {
      type: 'int',
      ui_type: 'number',
      display_name: 'Port',
      short_desc: 'TCP port of the database server.',
      group: 'connection',
      default_value: { type: 'int', value: 5432 },
    },
    database: {
      type: 'string',
      ui_type: 'string',
      display_name: 'Database name',
      short_desc: 'Name of the schema/database to connect to.',
      group: 'connection',
      required: true,
    },
    // --- Authentication (one-of required group) ---------------------------
    token: {
      type: 'string',
      ui_type: 'string',
      display_name: 'API token',
      short_desc: 'Bearer token — use this OR a username/password.',
      group: 'authentication',
      required_groups: ['auth'],
      supports_templates: true,
    },
    username: {
      type: 'string',
      ui_type: 'string',
      display_name: 'Username',
      short_desc: 'Database user — paired with a password.',
      group: 'authentication',
      required_groups: ['auth'],
    },
    password: {
      type: 'string',
      ui_type: 'string',
      display_name: 'Password',
      short_desc: 'Database password.',
      group: 'authentication',
      required_groups: ['auth'],
      supports_templates: true,
    },
    // --- Advanced ---------------------------------------------------------
    options: {
      type: 'hash',
      ui_type: 'hash',
      display_name: 'Driver options',
      short_desc: 'Extra key/value options passed to the driver.',
      group: 'advanced',
    },
    poolSize: {
      type: 'int',
      ui_type: 'number',
      display_name: 'Pool size',
      short_desc: 'Max simultaneous connections.',
      group: 'advanced',
      default_value: { type: 'int', value: 10 },
    },
    timeout: {
      type: 'int',
      ui_type: 'number',
      display_name: 'Timeout (s)',
      short_desc: 'Connection timeout in seconds.',
      group: 'advanced',
    },
    logLevel: {
      type: 'string',
      ui_type: 'string',
      display_name: 'Log level',
      short_desc: 'Verbosity of the connection log.',
      group: 'advanced',
      allowed_values: [
        { value: 'error', display_name: 'Error' },
        { value: 'info', display_name: 'Info' },
        { value: 'debug', display_name: 'Debug' },
      ],
    },
    // --- Optional (non-preselected — render in the Optional group) ---------
    sslCert: {
      type: 'file',
      ui_type: 'file',
      display_name: 'SSL certificate',
      short_desc: 'Client certificate for mutual TLS.',
    },
    tags: {
      type: 'list',
      ui_type: 'list',
      display_name: 'Tags',
      short_desc: 'Free-form labels for this connection.',
    },
  }) as unknown as IQorusFormSchema;

export const focusDemoValue: Record<string, IQorusFormField> = {
  url: { type: 'string', value: 'pgsql://hq.qoretechnologies.com:5432/omq' },
  // database: intentionally unset → required to-do
  // auth group: intentionally none set → one-of unsatisfied → attention
  options: {
    type: 'hash',
    value: {
      sslmode: { type: 'string', value: 'require' },
      application_name: { type: 'string', value: 'qorus-ide' },
      connect_timeout: { type: 'int', value: 8 },
    },
  },
  logLevel: { type: 'string', value: 'info' },
  // timeout: invalid (entered 0)
  timeout: { type: 'int', value: 0 as any },
};

// Demo-only invalid reasons (in the engine these come from the validity pass).
export const focusDemoInvalid: Record<string, string> = {
  timeout: 'Must be greater than 0',
};

// Display labels for the named groups.
export const focusDemoGroupLabels: Record<string, string> = {
  connection: 'Connection',
  authentication: 'Authentication',
  advanced: 'Advanced',
  optional: 'Optional',
  general: 'General',
};
