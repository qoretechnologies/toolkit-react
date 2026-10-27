// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The DPQL stories' stand-in server and catalogue answer as Qorus does (qorus#646, David's review: "it's not clear
 * which parts are story config issues"): a story that shows what the product never does hides the product's real
 * behaviour. Context data is what `getContextData` serves (`GenericContextInfo`, every item with its base type), a
 * Qog's state data what `getStateData` serves (each item named by its path, with its own description), and what
 * the server completes inside `$data:` what `QorusClientServer::listTemplateValues()` lists.
 */
import { describe, expect, it } from 'vitest';
import { mockDataTemplateValues } from '../../src/components/dpqlEditor/__fixtures__/dpqlMockTemplateValues';
import {
  CONTEXT_DATA_PAYLOAD,
  QOG_FIELD_TEMPLATES,
  QOG_STATE_DATA_PAYLOAD,
} from '../../src/components/form/fields/template/__fixtures__/qogTemplatePayloads';

/** The names `GenericContextInfo` serves (Classes/QorusRestApiHandlerV8.qc). */
const GENERIC_CONTEXT_NAMES = [
  'auth_enabled',
  'current_timestamp',
  'day_end',
  'day_start',
  'id',
  'input',
  'name',
  'test_hash',
  'test_list',
  'timegm',
  'type',
  'version',
];

type TItem = {
  name?: string;
  display_name?: string;
  short_desc?: string;
  type?: string;
  base_type?: string;
  value?: string;
  items?: TItem[];
};

const walk = (items: TItem[] = []): TItem[] => items.flatMap((item) => [item, ...walk(item.items)]);

describe("the stories' context data", () => {
  it('is every value getUserContextInfo gives, as getContextData serves it', () => {
    const items = CONTEXT_DATA_PAYLOAD._context.items as TItem[];
    expect(items.map((item) => item.name).sort()).toEqual(GENERIC_CONTEXT_NAMES);
    for (const item of items) {
      expect(item, item.name).toMatchObject({
        display_name: expect.any(String),
        short_desc: expect.any(String),
        type: expect.any(String),
        base_type: expect.any(String),
        value: expect.stringMatching(/^\$[a-z]+:/),
      });
    }
  });
});

describe("the stories' Qog state data", () => {
  it('names each item by its path, with its description, type, base type and the template that gives it', () => {
    for (const [state, info] of Object.entries(QOG_STATE_DATA_PAYLOAD)) {
      for (const item of walk(info.items as TItem[])) {
        expect(item.value, item.name).toBe(`$data:{${state}.${item.name}}`);
        expect(item, item.name).toMatchObject({
          display_name: expect.any(String),
          short_desc: expect.any(String),
          type: expect.any(String),
          base_type: expect.any(String),
        });
      }
    }
  });

  it('has a record a value of its own with its fields as its items, as doGetFlatOutputInfo serves it', () => {
    const customer = (QOG_STATE_DATA_PAYLOAD.receive_order.items as TItem[]).find(
      (item) => item.name === 'customer'
    );
    expect(customer?.value).toBe('$data:{receive_order.customer}');
    expect(customer?.items?.map((item) => item.name)).toEqual([
      'customer.name',
      'customer.address',
    ]);
  });

  it('is what the stories hand a field, built as a host builds it', () => {
    expect(QOG_FIELD_TEMPLATES?.items?.map((group) => group.label)).toEqual([
      'Context Data',
      'Look up customer',
      'Receive order',
    ]);
  });
});

describe("what the stories' server completes inside `$data:`", () => {
  it('lists the states while no `.` is typed, each the whole reference, named and described by its name', () => {
    expect(mockDataTemplateValues(QOG_STATE_DATA_PAYLOAD, '')).toEqual([
      {
        label: 'Receive order',
        kind: 6,
        insertText: '$data:receive_order',
        filterText: '$data:receive_order',
        documentation: 'Receive order',
      },
      {
        label: 'Look up customer',
        kind: 6,
        insertText: '$data:lookup_customer',
        filterText: '$data:lookup_customer',
        documentation: 'Look up customer',
      },
    ]);
    expect(
      mockDataTemplateValues(QOG_STATE_DATA_PAYLOAD, 'look').map((item) => item.label)
    ).toEqual(['Look up customer']);
  });

  it("lists a state's top-level data after `<state>.`, its type by its catalogue name", () => {
    const listed = mockDataTemplateValues(QOG_STATE_DATA_PAYLOAD, 'receive_order.');
    expect(listed.map((item) => [item.label, item.insertText, item.detail])).toEqual([
      ['Order ID', '$data:receive_order.order_id', 'Whole number'],
      ['User name', '$data:receive_order.user_name', 'Text'],
      ['Event type', '$data:receive_order.event_type', 'Text'],
      ['Customer', '$data:receive_order.customer', expect.any(String)],
    ]);
    expect(listed[2].documentation).toBe('What happened to the order');
    expect(
      mockDataTemplateValues(QOG_STATE_DATA_PAYLOAD, 'receive_order.e').map((item) => item.label)
    ).toEqual(['Event type']);
  });
});
