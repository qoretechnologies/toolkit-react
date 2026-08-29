/**
 * The Qorus-domain half of `validateField`.
 *
 * These types came from qorus-ide, which carried its own copy of the validator
 * until the two were consolidated here. Every case below existed in exactly one
 * of the two files, so none of it was covered by this suite before — and the
 * only reason it needed consolidating is that a green suite over one copy said
 * nothing about the other.
 */
import { describe, expect, it } from 'vitest';
import { fixOperatorValue } from '../src/helpers/common';
import { isOptionInterfaceUiType, isOptionUiType } from '../src/helpers/optionUiTypes';
import { maybeBuildOptionProvider } from '../src/helpers/providerValue';
import {
  setExpressionCatalogueReader,
  validateField,
  validateFieldWithResult,
} from '../src/helpers/validations';

// ─── semantic string formats ──────────────────────────────────────────────────

describe('semantic string formats', () => {
  it('accepts and rejects email addresses', () => {
    expect(validateField('email', 'ops@example.com')).toBe(true);
    expect(validateField('email', 'ops@')).toBe(false);
    expect(validateField('email', 'not-an-email')).toBe(false);
  });

  it('accepts and rejects uuids', () => {
    expect(validateField('uuid', '3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(validateField('uuid', '3f2504e0-4f89-41d3-9a0c')).toBe(false);
  });

  it('accepts and rejects hostnames', () => {
    expect(validateField('hostname', 'supah.qoretechnologies.com')).toBe(true);
    expect(validateField('hostname', 'host name')).toBe(false);
  });

  it('accepts and rejects ipv4 addresses', () => {
    expect(validateField('ipv4', '192.168.0.1')).toBe(true);
    expect(validateField('ipv4', '256.0.0.1')).toBe(false);
    expect(validateField('ipv4', '192.168.0')).toBe(false);
  });

  it('accepts and rejects ipv6 addresses', () => {
    expect(validateField('ipv6', '2001:db8::1')).toBe(true);
    expect(validateField('ipv6', 'not:an:address:zz')).toBe(false);
  });

  it('accepts and rejects phone numbers', () => {
    expect(validateField('phone', '+421 123 456')).toBe(true);
    expect(validateField('phone', 'ring me')).toBe(false);
  });

  it('requires a non-empty string before testing the format', () => {
    expect(validateField('email', '')).toBe(false);
    expect(validateField('email', undefined)).toBe(false);
    expect(validateField('email', 42)).toBe(false);
  });

  it('also enforces a server-supplied validation_regex', () => {
    // A well-formed address that the server additionally restricts by domain.
    expect(
      validateField('email', 'ops@example.com', { validation_regex: '@qoretechnologies\\.com$' })
    ).toBe(false);
    expect(
      validateField('email', 'ops@qoretechnologies.com', {
        validation_regex: '@qoretechnologies\\.com$',
      })
    ).toBe(true);
  });

  it('validates uri exactly as url does — protocol and address', () => {
    expect(validateField('uri', 'https://example.com')).toBe(true);
    expect(validateField('uri', 'example.com')).toBe(false);
    expect(validateField('uri', 'https://')).toBe(false);
  });
});

// ─── interface types ──────────────────────────────────────────────────────────

describe('interface ui types', () => {
  it('treats an interface reference as a non-empty name', () => {
    for (const type of ['fsm', 'qog', 'alertrule', 'ml-model', 'value-map', 'auth-profile']) {
      expect(validateField(type, 'my-object')).toBe(true);
      expect(validateField(type, '')).toBe(false);
      expect(validateField(type, undefined)).toBe(false);
      expect(validateField(type, 42)).toBe(false);
    }
  });

  it('carries the field through, so an identifier rule still applies', () => {
    expect(validateField('fsm', 'not an identifier', { has_to_be_valid_identifier: true })).toBe(
      false
    );
    expect(validateField('fsm', 'valid_identifier', { has_to_be_valid_identifier: true })).toBe(
      true
    );
  });

  it('does NOT route connection through the name-only branch', () => {
    // `connection` is an interface type but carries enablement and
    // authentication state of its own, so it keeps its own case.
    expect(validateField('connection', 'gmail-1', { disabled: true })).toBe(false);
    expect(validateField('connection', 'gmail-1', { metadata: { needs_auth: true } })).toBe(false);
    expect(validateField('connection', 'gmail-1')).toBe(true);
  });
});

// ─── string aliases ───────────────────────────────────────────────────────────

describe('string aliases', () => {
  it('validates every string-backed alias as a non-empty string', () => {
    for (const type of [
      'softstring',
      'select-string',
      'file-string',
      'file-as-string',
      'method-name',
      'code-editor',
      'data',
    ]) {
      expect(validateField(type, 'value')).toBe(true);
      expect(validateField(type, '')).toBe(false);
    }
  });

  it('validates select-array as an array alias', () => {
    expect(validateField('select-array', ['a'])).toBe(true);
    expect(validateField('select-array', [])).toBe(false);
  });
});

// ─── array-of-pairs / class-array / class-connectors ──────────────────────────

describe('array-of-pairs', () => {
  const field = { fields: ['name', 'value'] };

  it('accepts pairs with both fields filled and unique keys', () => {
    expect(
      validateField(
        'array-of-pairs',
        [
          { name: 'a', value: '1' },
          { name: 'b', value: '2' },
        ],
        field
      )
    ).toBe(true);
  });

  it('rejects a pair with an empty field', () => {
    const result = validateFieldWithResult(
      'array-of-pairs',
      [{ name: 'a', value: '' }],
      field
    );
    expect(result.isValid).toBe(false);
    expect(result.reasons).toContain('All pairs must include both fields');
  });

  it('rejects duplicate keys', () => {
    const result = validateFieldWithResult(
      'array-of-pairs',
      [
        { name: 'a', value: '1' },
        { name: 'a', value: '2' },
      ],
      field
    );
    expect(result.isValid).toBe(false);
    expect(result.reasons).toContain('Pairs must use unique keys');
  });

  it('rejects a non-list', () => {
    expect(validateField('array-of-pairs', 'a=1', field)).toBe(false);
  });
});

describe('class-array', () => {
  it('accepts uniquely named classes', () => {
    expect(validateField('class-array', [{ name: 'A' }, { name: 'B' }])).toBe(true);
  });

  it('distinguishes classes by prefix as well as name', () => {
    expect(
      validateField('class-array', [
        { prefix: 'x', name: 'A' },
        { prefix: 'y', name: 'A' },
      ])
    ).toBe(true);
    expect(validateField('class-array', [{ name: 'A' }, { name: 'A' }])).toBe(false);
  });

  it('rejects an empty list and a nameless class', () => {
    expect(validateField('class-array', [])).toBe(false);
    expect(validateField('class-array', [{ name: '' }])).toBe(false);
  });
});

describe('class-connectors', () => {
  it('accepts connectors with a name and a method', () => {
    expect(validateField('class-connectors', [{ name: 'in', method: 'run' }])).toBe(true);
  });

  it('rejects a connector missing its method, and duplicates', () => {
    expect(validateField('class-connectors', [{ name: 'in' }])).toBe(false);
    expect(
      validateField('class-connectors', [
        { name: 'in', method: 'run' },
        { name: 'in', method: 'other' },
      ])
    ).toBe(false);
  });

  it('rejects an empty list', () => {
    expect(validateField('class-connectors', [])).toBe(false);
  });
});

// ─── collection-documents ─────────────────────────────────────────────────────

describe('collection-documents', () => {
  it('accepts a server-managed row and a freshly uploaded row', () => {
    expect(
      validateField('collection-documents', [
        { name: 'spec.pdf', ai_documentid: 12 },
        { name: 'notes.md', content: 'aGk=' },
      ])
    ).toBe(true);
  });

  it('accepts an absent or empty list — the required check gates that', () => {
    expect(validateField('collection-documents', undefined)).toBe(true);
    expect(validateField('collection-documents', [])).toBe(true);
  });

  it('rejects a row with neither content nor a server id', () => {
    const result = validateFieldWithResult('collection-documents', [{ name: 'orphan.pdf' }]);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('orphan.pdf');
  });

  it('rejects a nameless row and a non-list', () => {
    expect(validateField('collection-documents', [{ ai_documentid: 1 }])).toBe(false);
    expect(validateField('collection-documents', 'nope')).toBe(false);
  });
});

// ─── list-of-hashes ───────────────────────────────────────────────────────────

describe('list-of-hashes', () => {
  it('accepts a list of non-empty hashes', () => {
    expect(validateField('list-of-hashes', [{ a: 1 }, { b: 2 }])).toBe(true);
  });

  it('rejects an empty hash in the list', () => {
    const result = validateFieldWithResult('list-of-hashes', [{ a: 1 }, {}]);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Hash at index 1 must not be empty');
  });

  it('rejects a value that is not a list', () => {
    expect(validateField('list-of-hashes', { a: 1 })).toBe(false);
  });
});

// ─── mapper-code ──────────────────────────────────────────────────────────────

describe('mapper-code', () => {
  it('accepts a code::method pair', () => {
    expect(validateField('mapper-code', 'MyCode::myMethod')).toBe(true);
  });

  it('rejects a missing method half', () => {
    const result = validateFieldWithResult('mapper-code', 'MyCode');
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Mapper method is invalid');
  });

  it('rejects an empty value', () => {
    expect(validateField('mapper-code', '')).toBe(false);
  });
});

// ─── data provider cluster ────────────────────────────────────────────────────

describe('data provider types', () => {
  it('accepts a provider with a type and a name', () => {
    expect(validateField('data-provider', { type: 'datasource', name: 'omq' })).toBe(true);
  });

  it('expands the flat path string a server stores', () => {
    expect(validateField('type-selector', 'datasource/omq/table')).toBe(true);
  });

  it('rejects an empty provider value', () => {
    expect(validateField('data-provider', undefined)).toBe(false);
    expect(validateField('data-provider', { type: 'datasource' })).toBe(false);
  });

  it('requires an api-call provider to support requests', () => {
    expect(
      validateField('api-call', { type: 'factory', name: 'rest', supports_request: true })
    ).toBe(true);
    expect(validateField('api-call', { type: 'factory', name: 'rest' })).toBe(false);
  });

  it('requires a send-message provider to carry a message', () => {
    expect(
      validateField('send-message', {
        type: 'factory',
        name: 'kafka',
        supports_messages: 'ASYNC',
        message_id: 'msg',
        message: { type: 'string', value: 'hello' },
      })
    ).toBe(true);
    expect(
      validateField('send-message', {
        type: 'factory',
        name: 'kafka',
        supports_messages: 'ASYNC',
        message_id: 'msg',
      })
    ).toBe(false);
  });

  it('rejects a message whose content does not validate as its own type', () => {
    const result = validateFieldWithResult('send-message', {
      type: 'factory',
      name: 'kafka',
      supports_messages: 'ASYNC',
      message_id: 'msg',
      message: { type: 'string', value: '' },
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Message content is invalid');
  });

  it('requires a variable provider to support at least one action', () => {
    expect(
      validateField('data-provider', { type: 'datasource', name: 'omq' }, { isVariable: true })
    ).toBe(false);
    expect(
      validateField(
        'data-provider',
        { type: 'datasource', name: 'omq', supports_read: true },
        { isVariable: true }
      )
    ).toBe(true);
  });

  it('rejects a factory whose options have not been saved', () => {
    expect(
      validateField('data-provider', { type: 'factory', name: 'db', optionsChanged: true })
    ).toBe(false);
  });

  it('rejects a provider whose search options have not been saved', () => {
    expect(
      validateField('data-provider', {
        type: 'datasource',
        name: 'omq',
        record_requires_search_options: true,
        searchOptionsChanged: true,
      })
    ).toBe(false);
  });
});

describe('maybeBuildOptionProvider', () => {
  it('passes an already-expanded provider through', () => {
    const provider = { type: 'datasource', name: 'omq' };
    expect(maybeBuildOptionProvider(provider)).toBe(provider);
  });

  it('splits a plain type/name/path string', () => {
    expect(maybeBuildOptionProvider('datasource/omq/table/x')).toEqual({
      type: 'datasource',
      name: 'omq',
      path: 'table/x',
    });
  });

  it('parses a factory string with its options', () => {
    // The parser normalizes the string with a trailing slash first, so the
    // path it reports back keeps one.
    expect(maybeBuildOptionProvider('factory/db{driver=pgsql,user=omq}/table')).toEqual({
      type: 'factory',
      name: 'db',
      path: 'table/',
      options: { driver: 'pgsql', user: 'omq' },
    });
  });

  it('marks a factory whose options changed', () => {
    expect(maybeBuildOptionProvider('factory/db{}/t?options_changed')?.optionsChanged).toBe(true);
  });

  it('answers null for anything that is neither', () => {
    expect(maybeBuildOptionProvider(undefined)).toBe(null);
    expect(maybeBuildOptionProvider('')).toBe(null);
    expect(maybeBuildOptionProvider(42)).toBe(null);
  });
});

// ─── context-selector ─────────────────────────────────────────────────────────

describe('context-selector', () => {
  it('accepts the prefix:name string form', () => {
    expect(validateField('context-selector', 'workflow:my-wf')).toBe(true);
  });

  it('rejects a string missing either half', () => {
    expect(validateField('context-selector', 'workflow:')).toBe(false);
    expect(validateField('context-selector', 'workflow')).toBe(false);
  });

  it('accepts the object form with iface_kind and name', () => {
    expect(validateField('context-selector', { iface_kind: 'workflow', name: 'my-wf' })).toBe(true);
    expect(validateField('context-selector', { iface_kind: 'workflow' })).toBe(false);
  });
});

// ─── service events and webhooks ──────────────────────────────────────────────

describe('service events', () => {
  const event = {
    type: 'factory',
    name: 'kafka',
    handlers: [{ type: 'fsm', value: 'my-fsm' }],
  };

  it('accepts an event with a provider and at least one handler', () => {
    expect(validateField('service-event', event)).toBe(true);
    expect(validateField('service-events', [event])).toBe(true);
  });

  it('rejects an event with no handlers, or a handler of an unknown kind', () => {
    expect(validateField('service-event', { ...event, handlers: [] })).toBe(false);
    expect(
      validateField('service-event', { ...event, handlers: [{ type: 'other', value: 'x' }] })
    ).toBe(false);
  });

  it('rejects an empty service-events list and reports which entry failed', () => {
    expect(validateField('service-events', [])).toBe(false);
    const result = validateFieldWithResult('service-events', [
      event,
      { ...event, handlers: [] },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Service event 1 is invalid');
  });
});

describe('service webhooks', () => {
  const webhook = { name: 'hook', 'rest-method': 'POST', auth: 'default' };

  it('accepts a webhook with a name, method and auth', () => {
    expect(validateField('service-webhook', webhook)).toBe(true);
    expect(validateField('service-webhooks', [webhook])).toBe(true);
  });

  it('rejects a webhook missing its auth', () => {
    expect(validateField('service-webhook', { ...webhook, auth: '' })).toBe(false);
  });

  it('validates the handler when one is present', () => {
    expect(
      validateField('service-webhook', { ...webhook, handler: { type: 'method', value: 'run' } })
    ).toBe(true);
    expect(
      validateField('service-webhook', { ...webhook, handler: { type: 'other', value: 'run' } })
    ).toBe(false);
    expect(
      validateField('service-webhook', { ...webhook, handler: { type: 'method', value: '' } })
    ).toBe(false);
  });

  it('rejects an empty webhooks list', () => {
    expect(validateField('service-webhooks', [])).toBe(false);
  });
});

// ─── processor / processor-mappings / tool-catalog / fsm-list ─────────────────

describe('processor', () => {
  const provider = { type: 'factory', name: 'rest' };

  it('accepts a processor with both types', () => {
    expect(
      validateField('processor', {
        'processor-input-type': provider,
        'processor-output-type': provider,
      })
    ).toBe(true);
  });

  it('rejects a processor missing either type', () => {
    expect(validateField('processor', { 'processor-input-type': provider })).toBe(false);
    expect(validateField('processor', undefined)).toBe(false);
  });
});

describe('processor-mappings', () => {
  it('accepts a mapping with an output path and an input path', () => {
    expect(
      validateField('processor-mappings', [{ outputPath: 'out', inputPath: 'in' }])
    ).toBe(true);
  });

  it('accepts a mapping configured by options instead of an input path', () => {
    expect(
      validateField('processor-mappings', [{ outputPath: 'out', options: { const: 1 } }])
    ).toBe(true);
  });

  it('rejects a mapping with neither an input path nor options', () => {
    const result = validateFieldWithResult('processor-mappings', [{ outputPath: 'out' }]);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('must have an input path or options configured');
  });

  it('rejects a non-list unless the field may be null', () => {
    expect(validateField('processor-mappings', 'nope')).toBe(false);
    expect(validateField('processor-mappings', 'nope', undefined, true)).toBe(true);
  });
});

describe('tool-catalog', () => {
  it('accepts a list of selector strings', () => {
    expect(validateField('tool-catalog', ['*', 'system:*', 'gmail-1/send'])).toBe(true);
    expect(validateField('tool-catalog', [])).toBe(true);
  });

  it('rejects a non-string or empty selector', () => {
    expect(validateField('tool-catalog', ['ok', ''])).toBe(false);
    expect(validateField('tool-catalog', ['ok', 3])).toBe(false);
  });

  it('rejects a non-list unless the field may be null', () => {
    expect(validateField('tool-catalog', 'system:*')).toBe(false);
    expect(validateField('tool-catalog', 'system:*', undefined, true)).toBe(true);
  });
});

describe('fsm-list', () => {
  it('accepts entries that carry a name', () => {
    expect(validateField('fsm-list', [{ name: 'a' }, { name: 'b' }])).toBe(true);
    expect(validateField('fsm-list', [])).toBe(true);
  });

  it('rejects an entry with no name, and a non-list', () => {
    expect(validateField('fsm-list', [{ name: '' }])).toBe(false);
    expect(validateField('fsm-list', 'a')).toBe(false);
  });

  it('does not throw on a null entry', () => {
    expect(() => validateField('fsm-list', [null])).not.toThrow();
    expect(validateField('fsm-list', [null])).toBe(false);
  });
});

// ─── api manager ──────────────────────────────────────────────────────────────

describe('api-manager', () => {
  const endpoint = { value: 'GET /orders' };

  it('accepts a manager with a factory and endpoints', () => {
    expect(validateField('api-manager', { factory: 'rest', endpoints: [endpoint] })).toBe(true);
  });

  it('rejects a manager with no factory or no endpoints', () => {
    expect(validateField('api-manager', { endpoints: [endpoint] })).toBe(false);
    expect(validateField('api-manager', { factory: 'rest', endpoints: [] })).toBe(false);
    expect(validateField('api-manager', undefined)).toBe(false);
  });

  it('reports which endpoint failed', () => {
    const result = validateFieldWithResult('api-endpoints', [endpoint, { value: '' }]);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Endpoint 1 value is invalid');
  });
});

describe('api-endpoint-authorization', () => {
  it('accepts an absent override on an endpoint', () => {
    expect(validateField('api-endpoints', [{ value: 'GET /orders' }])).toBe(true);
  });

  it('accepts a well-formed override', () => {
    expect(
      validateField('api-endpoint-authorization', {
        mode: 'merge',
        allow_anonymous: false,
        roles: ['admin'],
      })
    ).toBe(true);
  });

  it('rejects an unknown mode, a non-boolean flag and a bad role list', () => {
    expect(validateField('api-endpoint-authorization', { mode: 'replace-all' })).toBe(false);
    expect(validateField('api-endpoint-authorization', { allow_anonymous: 'yes' })).toBe(false);
    expect(validateField('api-endpoint-authorization', { roles: 'admin' })).toBe(false);
    expect(validateField('api-endpoint-authorization', { roles: [''] })).toBe(false);
  });

  it('rejects a non-object, and an absent value unless it may be null', () => {
    expect(validateField('api-endpoint-authorization', ['admin'])).toBe(false);
    expect(validateField('api-endpoint-authorization', undefined)).toBe(false);
    expect(validateField('api-endpoint-authorization', undefined, undefined, true)).toBe(true);
  });
});

// ─── var-action ───────────────────────────────────────────────────────────────

describe('var-action', () => {
  const base = { var_type: 'localvar', var_name: 'v' };

  it('accepts a transaction action with its transaction_action set', () => {
    expect(
      validateField('var-action', {
        ...base,
        action_type: 'transaction',
        transaction_action: 'commit',
      })
    ).toBe(true);
  });

  it('rejects a transaction action with no transaction_action', () => {
    expect(validateField('var-action', { ...base, action_type: 'transaction' })).toBe(false);
  });

  it('rejects an unknown variable type and a nameless variable', () => {
    expect(
      validateField('var-action', { var_type: 'nope', var_name: 'v', action_type: 'transaction' })
    ).toBe(false);
    expect(
      validateField('var-action', {
        var_type: 'localvar',
        var_name: '',
        action_type: 'transaction',
      })
    ).toBe(false);
  });

  it('rejects an action with no action type', () => {
    expect(validateField('var-action', base)).toBe(false);
  });

  it('requires the variable declaration for a non-transaction action', () => {
    expect(validateField('var-action', { ...base, action_type: 'search' })).toBe(false);
  });

  it('validates a non-transaction action against the merged variable declaration', () => {
    const field = { variableData: { value: { type: 'datasource', name: 'omq' } } };
    expect(validateField('var-action', { ...base, action_type: 'search' }, field)).toBe(true);

    const incomplete = { variableData: { value: { type: 'datasource' } } };
    expect(validateField('var-action', { ...base, action_type: 'search' }, incomplete)).toBe(false);
  });

  it('does not throw on a missing value', () => {
    expect(() => validateField('var-action', undefined)).not.toThrow();
    expect(validateField('var-action', undefined)).toBe(false);
  });
});

// ─── system-options-with-operators ────────────────────────────────────────────

describe('system-options-with-operators', () => {
  it('accepts an option carrying a value and an operator', () => {
    expect(
      validateField('system-options-with-operators', {
        name: { type: 'string', value: 'omq', op: 'eq' },
      })
    ).toBe(true);
  });

  it('accepts a chain of operators', () => {
    expect(
      validateField('system-options-with-operators', {
        name: { type: 'string', value: 'omq', op: ['not', 'eq'] },
      })
    ).toBe(true);
  });

  it('rejects an option with no operator, or an empty one in the chain', () => {
    const missing = validateFieldWithResult('system-options-with-operators', {
      name: { type: 'string', value: 'omq' },
    });
    expect(missing.isValid).toBe(false);
    expect(missing.reason).toBe('Operators for option name are invalid');

    expect(
      validateField('system-options-with-operators', {
        name: { type: 'string', value: 'omq', op: ['eq', ''] },
      })
    ).toBe(false);
  });

  it('rejects an option whose value does not validate', () => {
    expect(
      validateField('system-options-with-operators', {
        name: { type: 'string', value: '', op: 'eq' },
      })
    ).toBe(false);
  });

  it('requires options unless the field may be null', () => {
    expect(validateField('system-options-with-operators', {})).toBe(false);
    expect(validateField('system-options-with-operators', {}, undefined, true)).toBe(true);
  });

  it('validates each set when several are supplied', () => {
    const result = validateFieldWithResult('system-options-with-operators', [
      { name: { type: 'string', value: 'omq', op: 'eq' } },
      { name: { type: 'string', value: 'omq' } },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Option set 1 is invalid');
  });
});

describe('fixOperatorValue', () => {
  it('answers the list an operator logically is', () => {
    expect(fixOperatorValue('eq')).toEqual(['eq']);
    expect(fixOperatorValue(['not', 'eq'])).toEqual(['not', 'eq']);
    expect(fixOperatorValue(undefined)).toEqual([undefined]);
  });
});

// ─── options aliases ──────────────────────────────────────────────────────────

describe('options aliases', () => {
  const optionSchema = { name: { type: 'string', required: true } } as any;

  it('validates pipeline-options, mapper-options and system-options as options', () => {
    for (const type of ['options', 'pipeline-options', 'mapper-options', 'system-options']) {
      expect(
        validateField(type, { name: { type: 'string', value: 'x' } }, { optionSchema })
      ).toBe(true);
      expect(
        validateField(type, { name: { type: 'string', value: '' } }, { optionSchema })
      ).toBe(false);
    }
  });
});

// ─── expression catalogue injection ───────────────────────────────────────────

describe('expression catalogue reader', () => {
  const catalogue = [
    {
      name: 'IS_SET',
      display_name: 'Is set',
      args: [{ name: 'v', display_name: 'Value', required: true }],
      min_args: 1,
    },
  ];

  it('reads the catalogue a consumer registered when the field carries none', () => {
    // Distinct operation names throughout: `validateFieldWithResult` is
    // memoized on its arguments, and the reader is deliberately NOT one of
    // them, so re-using a value would answer from the cache instead of the
    // reader.
    const unknown = { value: { exp: 'REGISTERED_ONLY', args: [] } };

    // With no reader the catalogue is empty, so an expression that names an
    // operation is left alone rather than judged against nothing.
    expect(validateField('expression', unknown)).toBe(true);

    setExpressionCatalogueReader(() => catalogue);
    try {
      expect(validateField('expression', { value: { exp: 'ALSO_UNKNOWN', args: [] } })).toBe(false);
      expect(
        validateField('expression', {
          value: { exp: 'IS_SET', args: [{ type: 'string', value: 'x' }] },
        })
      ).toBe(true);
    } finally {
      setExpressionCatalogueReader(undefined);
    }
  });

  it('prefers a catalogue the field carries over the registered reader', () => {
    setExpressionCatalogueReader(() => catalogue);
    try {
      expect(
        validateField('expression', { value: { exp: 'FIELD_ONLY', args: [] } }, {
          expressions: [{ name: 'FIELD_ONLY', args: [], min_args: 0 }],
        })
      ).toBe(true);
    } finally {
      setExpressionCatalogueReader(undefined);
    }
  });

  it('rejects a missing operation even before the catalogue has loaded', () => {
    // An expression with no operation chosen is incomplete on its own terms —
    // nothing the catalogue could supply would make it valid — so this answer
    // must not depend on whether a fetch has landed.
    expect(validateField('expression', { value: { args: [] } }, { expressions: [] })).toBe(false);
    expect(validateField('expression', undefined, { expressions: [] })).toBe(false);
  });
});

// ─── isFunction ───────────────────────────────────────────────────────────────

describe('isFunction', () => {
  const expressions = [
    {
      name: 'CONCAT',
      display_name: 'Concat',
      args: [
        { name: 'a', display_name: 'First', required: true },
        { name: 'b', display_name: 'Second', required: true },
      ],
      min_args: 2,
    },
  ];

  it('validates an expression option as an expression, not as its declared type', () => {
    expect(
      validateField(
        'string',
        { exp: 'CONCAT', args: [{ type: 'string', value: 'a' }, { type: 'string', value: 'b' }] },
        { isFunction: true, expressions }
      )
    ).toBe(true);
  });

  it('checks the expression ARGUMENTS, not just that an operation was chosen', () => {
    // A shallow "does it have an `exp`?" test passes this: the operation is
    // chosen, and only its second required argument is empty.
    const result = validateFieldWithResult(
      'string',
      { exp: 'CONCAT', args: [{ type: 'string', value: 'a' }, { type: 'string', value: '' }] },
      { isFunction: true, expressions }
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('argument 2');
  });

  it('reports a missing operation', () => {
    const result = validateFieldWithResult('string', { args: [] }, { isFunction: true });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Expression operation is required');
  });

  it('accepts the option envelope a caller may still hold', () => {
    const result = validateFieldWithResult(
      'string',
      { value: { exp: 'CONCAT', args: [] } },
      { isFunction: true }
    );
    // No catalogue registered, so the operation is all that can be checked.
    expect(result.isValid).toBe(true);
  });
});

// ─── the ui-type vocabulary ───────────────────────────────────────────────────

describe('option ui type vocabulary', () => {
  it('recognises interface types', () => {
    expect(isOptionInterfaceUiType('fsm')).toBe(true);
    expect(isOptionInterfaceUiType('connection')).toBe(true);
    expect(isOptionInterfaceUiType('string')).toBe(false);
    expect(isOptionInterfaceUiType(undefined)).toBe(false);
  });

  it('recognises option types across every group', () => {
    expect(isOptionUiType('string')).toBe(true);
    expect(isOptionUiType('collection-documents')).toBe(true);
    expect(isOptionUiType('multi-select')).toBe(true);
    expect(isOptionUiType('tool-catalog')).toBe(true);
    // a legacy FIELD type is not an OPTION type
    expect(isOptionUiType('array-of-pairs')).toBe(false);
  });
});
