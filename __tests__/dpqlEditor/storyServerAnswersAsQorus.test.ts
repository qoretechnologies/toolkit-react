// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The DPQL stories' stand-in server and catalogue answer as Qorus does (qorus#646, David's review: "it's not clear
 * which parts are story config issues"): a story that shows what the product never does hides the product's real
 * behaviour. Context data is what `getContextData` serves (`GenericContextInfo`, every item with its base type), a
 * Qog's state data what `getStateData` serves (each item named by its path, with its own description), and what
 * the server completes inside a template what Qorus's catalogue lists (`QorusTemplateCatalogue::listValues()`), from
 * the catalogue Qorus gives the document (its fixtures, `templateCatalogueFixtures`).
 */
import { describe, expect, it } from 'vitest';
import { dpqlMockTypeName } from '../../src/components/form/expressions/dpqlMockLsp';
import {
  catalogueCompletions,
  storyDpqlCatalogue,
  templateCatalogueFixture,
  TEMPLATE_CATALOGUE_FIXTURES,
  TStoryStateData,
} from '../../src/stories/templateCatalogueMock';
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

describe("what the stories' server completes inside a template", () => {
  const qog = storyDpqlCatalogue({ stateData: QOG_STATE_DATA_PAYLOAD as TStoryStateData });
  const complete = (written: string) => catalogueCompletions(qog, written, dpqlMockTypeName);

  it("is Qorus's catalogue: each fixture as Qorus wrote it, a response with its contexts", () => {
    for (const [name, fixture] of Object.entries(TEMPLATE_CATALOGUE_FIXTURES)) {
      expect(fixture.response.contexts.length, name).toBeGreaterThan(0);
      for (const context of fixture.response.contexts) {
        expect(['container', 'values', 'formatted', 'expression'], `${name} ${context.name}`).toContain(
          context.kind
        );
        // a context used whole says the template that reads all of it
        expect(!!context.use_whole && !context.whole_template, `${name} ${context.name}`).toBe(false);
      }
    }
  });

  it('lists after `$` the contexts the document can use, as they are written', () => {
    expect(complete('$').map((item) => item.label)).toEqual([
      '$data:',
      '$env:',
      '$fsminput:',
      '$local:',
      '$parse-value:',
      '$python-expr:',
      '$qore-expr:',
      // a DPQL document is an expression on a record: its fields written freely where none is bound
      '$record:',
      '$rest:',
      '$timestamp:',
      '$transient:',
      '$var:',
    ]);
    expect(complete('$tr').map((item) => item.label)).toEqual(['$transient:']);
  });

  it('lists after `$data:` the whole of it first, then the states, each named and written whole', () => {
    expect(complete('$data:').map((item) => [item.label, item.insertText])).toEqual([
      ['$data:*', '$data:*'],
      ['Receive order', '$data:receive_order'],
      ['Look up customer', '$data:lookup_customer'],
    ]);
    expect(complete('$data:look').map((item) => item.label)).toEqual(['Look up customer']);
  });

  it("lists a state's data after `<state>.`, its type by its catalogue name, and a record's after its `.`", () => {
    const listed = complete('$data:receive_order.');
    expect(listed.map((item) => [item.label, item.insertText, item.detail])).toEqual([
      ['Order ID', '$data:receive_order.order_id', 'Whole number'],
      ['User name', '$data:receive_order.user_name', 'Text'],
      ['Event type', '$data:receive_order.event_type', 'Text'],
      ['Customer', '$data:receive_order.customer', expect.any(String)],
    ]);
    expect(listed[2].documentation).toBe('What happened to the order');
    expect(complete('$data:receive_order.e').map((item) => item.label)).toEqual(['Event type']);
    expect(complete('$data:receive_order.customer.').map((item) => item.insertText)).toEqual([
      '$data:receive_order.customer.name',
      '$data:receive_order.customer.address',
    ]);
  });

  it('gives a loop no `$for:*`, which Qorus cannot read, and `$foreach:*`, which it can', () => {
    const loops = templateCatalogueFixture('qog-loops');
    expect(catalogueCompletions(loops, '$for:').map((item) => item.insertText)).toEqual(['$for:value']);
    expect(catalogueCompletions(loops, '$foreach:').map((item) => item.insertText)).toEqual([
      '$foreach:*',
      '$foreach:value',
      '$foreach:index',
      '$foreach:size',
    ]);
  });

  it('reads an alias as its context, never offering it: `$globalvar:` gives `$transient:`s variables', () => {
    expect(complete('$glob')).toEqual([]);
    expect(complete('$globalvar:').map((item) => item.insertText)).toEqual([
      '$globalvar:*',
      '$globalvar:total',
    ]);
  });

  it("is a record expression's with the record's fields where the document is bound to a record", () => {
    const record = storyDpqlCatalogue({ fields: { pos: { type: 'int', display_name: 'Position' } } });
    expect(catalogueCompletions(record, '$record:').map((item) => [item.label, item.insertText])).toEqual([
      ['$record:*', '$record:*'],
      ['Position', '$record:pos'],
    ]);
  });
});
