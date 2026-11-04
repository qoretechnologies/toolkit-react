// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What Qorus serves a Qog field for its templates, in the shapes it serves them (qorus#646: a story's stand-in
 * must answer as the server does, or the story shows something the product never does):
 *
 * - `PUT system?action=getContextData` (`SystemRestClassV8::doGetContextData`): one group, Context Data, of the
 *   values `UserApi::getUserContextInfo()` gives (`GenericContextInfo`), each with its `name`, `display_name`,
 *   `short_desc`, `type`, `base_type` (`addTemplateBaseTypes`), an `example_value` and the template that gives it;
 * - `GET fsms?action=getStateData` (`FsmsRestClassV8::doComputeStateData`): a group for each state before the
 *   current one, keyed by the state's key, whose items are its output's fields (`doGetFlatOutputInfo`): a record
 *   is an item with a value of its own (`$data:{state.customer}`) and its fields as its items, each named by its
 *   path (`customer.address.city`) and labelled by its own display name.
 */
import { buildTemplates, type ITemplatesPayload } from '../../../../../helpers/templates';
import qorusAppLogo from '../../../../../stories/Data/qorusAppLogo.svg';

/* The app logo a story shows: the server names it by URL (`<instance>/api/public/apps/<app>/logo`), and a story
   loads nothing from a server, so it is the local copy (see `templateFixtures`). */
const QORUS_LOGO = qorusAppLogo;

/** `getContextData` for a generic interface context, as Qorus serves it. */
export const CONTEXT_DATA_PAYLOAD: ITemplatesPayload = {
  _context: {
    display_name: 'Context Data',
    short_desc: 'Data from the current execution context',
    app: 'Qorus',
    logo: QORUS_LOGO,
    internal: true,
    builtin: true,
    items: [
      {
        name: 'auth_enabled',
        display_name: 'Auth Enabled?',
        short_desc: 'Is authentication enabled for this Qorus instance?',
        type: 'bool',
        base_type: 'bool',
        example_value: true,
        value: '$local:auth_enabled',
      },
      {
        name: 'current_timestamp',
        display_name: 'Current Timestamp',
        short_desc: 'The current timestamp as a date/time value',
        type: 'date',
        base_type: 'date',
        example_value: '2026-10-27T09:00:00.000+01:00',
        value: '$timestamp:now',
      },
      {
        name: 'day_end',
        display_name: 'Day End',
        short_desc: 'The end of the day; the timestamp at midnight of the following day',
        type: 'date',
        base_type: 'date',
        example_value: '2026-10-28T00:00:00.000+01:00',
        value: '$timestamp:next_midnight',
      },
      {
        name: 'day_start',
        display_name: 'Day Start',
        short_desc: 'The start of the day; the timestamp at midnight of the current day',
        type: 'date',
        base_type: 'date',
        example_value: '2026-10-27T00:00:00.000+01:00',
        value: '$timestamp:last_midnight',
      },
      {
        name: 'timegm',
        display_name: 'Epoch Seconds',
        short_desc: 'The number of seconds after the UNIX epoch',
        type: 'int',
        base_type: 'int',
        example_value: 1793088000,
        value: '$timestamp:timegm',
      },
      {
        name: 'input',
        display_name: 'Input Data',
        short_desc: 'Input data for this state',
        type: 'any',
        base_type: 'any',
        example_value: { order_id: 1 },
        value: '$local:input',
      },
      {
        name: 'id',
        display_name: 'Interface ID',
        short_desc: 'The internal ID of the interface',
        type: 'int',
        base_type: 'int',
        example_value: 1,
        value: '$local:id',
      },
      {
        name: 'name',
        display_name: 'Interface Name',
        short_desc: 'The name of the interface',
        type: 'string',
        base_type: 'string',
        example_value: 'my-interface',
        value: '$local:name',
      },
      {
        name: 'version',
        display_name: 'Interface Version',
        short_desc: 'The version of the interface',
        type: 'string',
        base_type: 'string',
        example_value: '1.0',
        value: '$local:version',
      },
      {
        name: 'test_hash',
        display_name: 'Test Hash',
        short_desc: 'A test hash value',
        type: 'hash',
        base_type: 'hash',
        example_value: { a: 1, b: 'two', c: 3.0 },
        value: '$test:hash',
      },
      {
        name: 'test_list',
        display_name: 'Test List',
        short_desc: 'A test list value',
        type: 'list',
        base_type: 'list',
        example_value: [1, 'two', 3.0],
        value: '$test:list',
      },
      {
        name: 'type',
        display_name: 'Top-Level Interface Type',
        short_desc: 'The type of top-level interface currently being executed',
        type: 'string',
        base_type: 'string',
        example_value: 'job',
        value: '$local:type',
      },
    ],
  },
};

/** `getStateData` for a Qog whose current state follows Receive order and Look up customer. */
export const QOG_STATE_DATA_PAYLOAD: ITemplatesPayload = {
  receive_order: {
    display_name: 'Receive order',
    short_desc: 'The order that started the Qog',
    app: 'Shop',
    action: 'order-received',
    is_event_trigger: true,
    builtin: false,
    logo: QORUS_LOGO,
    items: [
      {
        name: 'order_id',
        display_name: 'Order ID',
        short_desc: 'The ID of the order',
        type: 'int',
        base_type: 'int',
        example_value: 1001,
        value: '$data:{receive_order.order_id}',
      },
      {
        name: 'user_name',
        display_name: 'User name',
        short_desc: 'The name of the user who placed the order',
        type: 'string',
        base_type: 'string',
        example_value: 'jane',
        value: '$data:{receive_order.user_name}',
      },
      {
        name: 'event_type',
        display_name: 'Event type',
        short_desc: 'What happened to the order',
        type: 'string',
        base_type: 'string',
        example_value: 'created',
        value: '$data:{receive_order.event_type}',
      },
      {
        name: 'customer',
        display_name: 'Customer',
        short_desc: 'The customer who placed the order',
        type: 'hash',
        base_type: 'hash',
        value: '$data:{receive_order.customer}',
        items: [
          {
            name: 'customer.name',
            display_name: 'Name',
            short_desc: "The customer's full name",
            type: 'string',
            base_type: 'string',
            example_value: 'Jane Doe',
            value: '$data:{receive_order.customer.name}',
          },
          {
            name: 'customer.address',
            display_name: 'Address',
            short_desc: "The customer's postal address",
            type: 'hash',
            base_type: 'hash',
            value: '$data:{receive_order.customer.address}',
            items: [
              {
                name: 'customer.address.city',
                display_name: 'City',
                short_desc: 'The city',
                type: 'string',
                base_type: 'string',
                example_value: 'Prague',
                value: '$data:{receive_order.customer.address.city}',
              },
              {
                name: 'customer.address.zip',
                display_name: 'ZIP code',
                short_desc: 'The postal code',
                type: 'string',
                base_type: 'string',
                example_value: '110 00',
                value: '$data:{receive_order.customer.address.zip}',
              },
            ],
          },
        ],
      },
    ],
  },
  lookup_customer: {
    display_name: 'Look up customer',
    short_desc: 'The customer record found for the order',
    app: 'CRM',
    action: 'find-customer',
    builtin: false,
    is_event_trigger: false,
    data_role: 'record',
    logo: QORUS_LOGO,
    items: [
      {
        name: 'customer_id',
        display_name: 'Customer ID',
        short_desc: 'The ID of the customer record',
        type: 'int',
        base_type: 'int',
        example_value: 77,
        value: '$data:{lookup_customer.customer_id}',
      },
      {
        name: 'tier',
        display_name: 'Tier',
        short_desc: "The customer's loyalty tier",
        type: 'string',
        base_type: 'string',
        example_value: 'gold',
        value: '$data:{lookup_customer.tier}',
      },
    ],
  },
};

/** The record fields a DPQL field's server describes (`dpql/setContext`): what `@` offers. */
export const RECORD_FIELDS = {
  name: {
    display_name: 'Name',
    short_desc: "The customer's full name, as they gave it",
    type: { name: 'string' },
  },
  status: {
    display_name: 'Status',
    short_desc: 'The lifecycle status of the record',
    type: { name: 'string' },
  },
  age: { display_name: 'Age', short_desc: 'Age in years', type: { name: 'int' } },
};

/**
 * The templates a host gives a field in a Qog state, as a Qog state's other fields have them: its context data and
 * the data of the Qog's states before it, built as every host builds them (`buildTemplates`).
 */
export const QOG_FIELD_TEMPLATES = buildTemplates({
  ...CONTEXT_DATA_PAYLOAD,
  ...QOG_STATE_DATA_PAYLOAD,
});

/** The workflow's own items `WorkflowContextInfo` adds to the generic context data: whole hashes of any keys. */
const WORKFLOW_CONTEXT_ITEMS = [
  {
    name: 'workflow_instanceid',
    display_name: 'Workflow Instance ID',
    short_desc: 'The workflow_instanceid of the current workflow order instance',
    type: 'int',
    base_type: 'int',
    example_value: 1,
    value: '$local:workflow_instanceid',
  },
  {
    name: 'dynamic_data',
    display_name: 'Workflow Dynamic Data',
    short_desc: 'The dynamic data of the current workflow order instance',
    type: 'hash',
    base_type: 'hash',
    example_value: { order_id: 1 },
    value: '$dynamic:*',
  },
  {
    name: 'static_data',
    display_name: 'Workflow Static Data',
    short_desc: 'The static data of the current workflow order instance',
    type: 'hash',
    base_type: 'hash',
    example_value: { customer: 'jane' },
    value: '$static:*',
  },
];

/** `getContextData` for a workflow (`interface_context=workflow`), as Qorus serves it. */
export const WORKFLOW_CONTEXT_DATA_PAYLOAD: ITemplatesPayload = {
  _context: {
    ...CONTEXT_DATA_PAYLOAD._context,
    items: [...(CONTEXT_DATA_PAYLOAD._context.items ?? []), ...WORKFLOW_CONTEXT_ITEMS],
  },
};
