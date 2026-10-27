// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The one model of what a field can refer to (qorus#646): a Qog field's templates as Qorus serves them
 * (`getContextData`, `getStateData`) and a DPQL field's record fields, as a tree; what typing a reference reaches;
 * what a search box finds; how a chip names a long path.
 */
import { describe, expect, it } from 'vitest';
import {
  CONTEXT_DATA_PAYLOAD,
  QOG_STATE_DATA_PAYLOAD,
  RECORD_FIELDS,
} from '../src/components/form/fields/template/__fixtures__/qogTemplatePayloads';
import { buildTemplates } from '../src/helpers/templates';
import {
  allTemplateNodes,
  chipPathLabel,
  fieldReference,
  loadTemplateChildren,
  RECORD_FIELDS_LABEL,
  referenceSteps,
  searchTemplateReferences,
  searchTemplateTree,
  templateNodeFor,
  templateTree,
  templateNodeKindOf,
  unbracedReference,
} from '../src/helpers/templateTree';

const QOG_TEMPLATES = buildTemplates({ ...CONTEXT_DATA_PAYLOAD, ...QOG_STATE_DATA_PAYLOAD });
const tree = () => templateTree(QOG_TEMPLATES, { fields: RECORD_FIELDS });
const labels = (nodes: { label: string }[]) => nodes.map((node) => node.label);

describe('templateTree', () => {
  it('lists the groups as the catalogue has them, with the record fields as a group of their own', () => {
    expect(labels(tree())).toEqual([
      'Context Data',
      'Look up customer',
      'Receive order',
      RECORD_FIELDS_LABEL,
    ]);
  });

  it('gives a state the reference its data goes on from, and says it is state data', () => {
    const state = tree().find((node) => node.label === 'Receive order');
    expect(state?.reference).toBe('$data:receive_order');
    expect(state?.kind).toBe('state');
    expect(state?.value).toBeUndefined();
  });

  it('gives a group of unrelated templates no reference', () => {
    const context = tree().find((node) => node.label === 'Context Data');
    expect(context?.reference).toBeUndefined();
    expect(context?.kind).toBe('group');
  });

  it('keeps a record that is a value and has fields: it can be taken whole or opened', () => {
    const customer = templateNodeFor(tree(), '$data:{receive_order.customer}');
    expect(customer?.value).toBe('$data:{receive_order.customer}');
    expect(labels(customer?.children ?? [])).toEqual(['Address', 'Name']);
    expect(customer?.trail).toEqual(['Receive order']);
  });

  it('says what a template is in its own words, not its example', () => {
    const city = templateNodeFor(tree(), '$data:{receive_order.customer.address.city}');
    expect(city?.description).toBe('The city');
    expect(city?.type).toBe('string');
    expect(city?.trail).toEqual(['Receive order', 'Customer', 'Address']);
  });

  it('writes a record field as `@name`, named by its key and described by its display name', () => {
    const fields = tree().find((node) => node.label === RECORD_FIELDS_LABEL);
    expect(fields?.children?.map((node) => node.value)).toEqual(['@name', '@status', '@age']);
    expect(fields?.children?.[0]).toMatchObject({
      kind: 'field',
      label: 'name',
      description: "Name: The customer's full name, as they gave it",
    });
  });

  it('quotes a record field whose name is not a bare name', () => {
    const fields = templateTree(undefined, { fields: { 'first name': { type: 'string' } } });
    // a lone group is opened: the field is the tree's top
    expect(fields[0].value).toBe('@"first name"');
  });

  it('writes a field key as the server does: quoted with its dots escaped', () => {
    expect(fieldReference('pos')).toBe('@pos');
    expect(fieldReference('order-id')).toBe('@"order-id"');
    expect(fieldReference('Unit.Price')).toBe('@"Unit\\.Price"');
    expect(fieldReference('say "hi"')).toBe('@"say \\"hi\\""');
  });

  it('opens a lone group for the author', () => {
    const lone = templateTree(
      buildTemplates(
        QOG_STATE_DATA_PAYLOAD.receive_order ?
          { receive_order: QOG_STATE_DATA_PAYLOAD.receive_order }
        : {}
      )
    );
    expect(labels(lone)).toEqual(['Customer', 'Event type', 'Order ID', 'User name']);
    expect(lone[0].trail).toEqual([]);
  });

  it('is empty for no templates and no fields', () => {
    expect(templateTree(undefined)).toEqual([]);
  });
});

describe('templateNodeKindOf', () => {
  it.each([
    ['$data:{a.b}', 'state'],
    ['$config:{x}', 'config'],
    ['$local:name', 'context'],
    ['$timestamp:now', 'context'],
    ['$localvar:{x}', 'variable'],
    ['$var:x', 'variable'],
    ['$record:{pos}', 'field'],
    ['@pos', 'field'],
    ['$qore-expr:{1}', 'template'],
    [undefined, 'template'],
  ])('%s is %s', (reference, kind) => {
    expect(templateNodeKindOf(reference)).toBe(kind);
  });
});

describe('searchTemplateReferences: what typing a reference reaches', () => {
  it('`$d` and `$data` offer the same: the states, not their data', () => {
    expect(labels(searchTemplateReferences(tree(), '$d'))).toEqual([
      'Look up customer',
      'Receive order',
    ]);
    expect(labels(searchTemplateReferences(tree(), '$data'))).toEqual([
      'Look up customer',
      'Receive order',
    ]);
  });

  it('`$data:` offers the states', () => {
    expect(labels(searchTemplateReferences(tree(), '$data:'))).toEqual([
      'Look up customer',
      'Receive order',
    ]);
  });

  it("`$data:receive_order.` offers that state's data only", () => {
    expect(labels(searchTemplateReferences(tree(), '$data:receive_order.'))).toEqual([
      'Customer',
      'Event type',
      'Order ID',
      'User name',
    ]);
  });

  it('reads the braced spelling as the bare one', () => {
    expect(labels(searchTemplateReferences(tree(), '$data:{receive_order.e'))).toEqual([
      'Event type',
    ]);
  });

  it('goes into a record typed past', () => {
    expect(
      labels(searchTemplateReferences(tree(), '$data:receive_order.customer.address.'))
    ).toEqual(['City', 'ZIP code']);
  });

  it('`$t` offers the context data that starts so, from a group of unrelated templates', () => {
    expect(labels(searchTemplateReferences(tree(), '$t'))).toEqual([
      'Current Timestamp',
      'Day End',
      'Day Start',
      'Epoch Seconds',
      'Test Hash',
      'Test List',
    ]);
  });

  it('`@` offers the record fields, and `@na` the one that starts so', () => {
    expect(labels(searchTemplateReferences(tree(), '@'))).toEqual(['name', 'status', 'age']);
    expect(labels(searchTemplateReferences(tree(), '@na'))).toEqual(['name']);
  });

  it('reaches a record field the catalogue lists as a template by `@`', () => {
    const fields = templateTree({
      items: [
        {
          label: 'Fields of the row',
          items: [
            { label: 'pos', value: '$record:{pos}' },
            { label: 'bezeichnung', value: '$record:{bezeichnung}' },
          ],
        },
        { label: 'Other', items: [{ label: 'x', value: '$local:x' }] },
      ],
    });
    expect(labels(searchTemplateReferences(fields, '@'))).toEqual(['pos', 'bezeichnung']);
    expect(labels(searchTemplateReferences(fields, '@po'))).toEqual(['pos']);
  });

  it('offers nothing that does not go on from what is typed', () => {
    expect(searchTemplateReferences(tree(), '$nothing')).toEqual([]);
    expect(searchTemplateReferences(tree(), '$data:receive_order.zzz')).toEqual([]);
  });
});

describe('searchTemplateTree: what a search box finds', () => {
  it('finds a deep template by its name from the top', () => {
    const found = searchTemplateTree(tree(), 'city');
    expect(labels(found)).toEqual(['City']);
    expect(found[0].trail).toEqual(['Receive order', 'Customer', 'Address']);
  });

  it('finds a group by its name, not each of its members beside it', () => {
    expect(labels(searchTemplateTree(tree(), 'receive'))).toEqual(['Receive order']);
  });

  it("finds a member by its group's name and its own", () => {
    expect(labels(searchTemplateTree(tree(), 'receive event'))).toEqual(['Event type']);
  });

  it('searches only under the group it is given', () => {
    const lookup = tree().find((node) => node.label === 'Look up customer');
    expect(labels(searchTemplateTree(tree(), 'customer', lookup))).toEqual(['Customer ID']);
  });

  it('reads a reference typed in the box as typing does', () => {
    expect(labels(searchTemplateTree(tree(), '$data:'))).toEqual([
      'Look up customer',
      'Receive order',
    ]);
  });

  it('lists the level as it is for an empty box', () => {
    expect(labels(searchTemplateTree(tree(), '  '))).toEqual(labels(tree()));
  });
});

describe('templateNodeFor', () => {
  it('finds a template by either spelling', () => {
    expect(templateNodeFor(tree(), '$data:receive_order.order_id')?.label).toBe('Order ID');
    expect(templateNodeFor(tree(), '$data:{receive_order.order_id}')?.label).toBe('Order ID');
  });

  it('finds a template by an alias its row answers to', () => {
    const aliased = templateTree({
      items: [{ label: 'X', value: '$localvar:{x}', metadata: { aliasValues: ['$var:{x}'] } }],
    });
    expect(templateNodeFor(aliased, '$var:x')?.label).toBe('X');
  });

  it('finds nothing for a reference no catalogue lists', () => {
    expect(templateNodeFor(tree(), '$data:{gone.away}')).toBeUndefined();
  });
});

describe('chipPathLabel', () => {
  it('says up to three steps whole', () => {
    expect(chipPathLabel(['Receive order'], 'Event type')).toBe('Receive order › Event type');
    expect(chipPathLabel(['Receive order', 'Customer'], 'Name')).toBe(
      'Receive order › Customer › Name'
    );
  });

  it('says the outermost group and the last two steps of a longer path', () => {
    expect(chipPathLabel(['Receive order', 'Customer', 'Address'], 'City')).toBe(
      'Receive order › … › Address › City'
    );
  });

  it('says a template of no group by its name', () => {
    expect(chipPathLabel([], 'Day End')).toBe('Day End');
  });
});

describe('referenceSteps', () => {
  it('reads the steps of a reference no catalogue lists', () => {
    expect(referenceSteps('$data:{gone.away.now}')).toEqual(['gone', 'away', 'now']);
    expect(referenceSteps('@pos')).toEqual(['pos']);
  });
});

describe('lazy members', () => {
  it('asks the host for the members of a group that has them only when asked, once', async () => {
    let asked = 0;
    const lazy = templateTree({
      items: [
        { label: 'A', items: [{ label: 'x', value: '$local:x' }] },
        {
          label: 'Later',
          loadItems: async () => {
            asked++;
            return [{ label: 'Loaded', value: '$data:{later.loaded}' }];
          },
        },
      ],
    });
    const later = lazy.find((node) => node.label === 'Later')!;
    expect(later.kind).toBe('group');
    expect(asked).toBe(0);
    expect(labels(await loadTemplateChildren(later))).toEqual(['Loaded']);
    expect(labels(await loadTemplateChildren(later))).toEqual(['Loaded']);
    expect(asked).toBe(1);
    expect(later.children?.[0].trail).toEqual(['Later']);
  });

  it('marks a template of any keys as one a key is written for', () => {
    const wild = templateTree({
      items: [
        { label: 'D', value: '$dynamic:*' },
        { label: 'L', value: '$local:x' },
      ],
    });
    expect(wild.map((node) => node.writesKey)).toEqual([true, false]);
  });
});

describe('unbracedReference', () => {
  it('reads a braced reference as the bare one', () => {
    expect(unbracedReference('$data:{a.b}')).toBe('$data:a.b');
  });
});

describe('allTemplateNodes', () => {
  it('walks every loaded node', () => {
    expect(allTemplateNodes(tree()).some((node) => node.label === 'ZIP code')).toBe(true);
  });
});
