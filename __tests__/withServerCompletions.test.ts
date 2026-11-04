// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { templateTree, withServerCompletions } from '../src/helpers/templateTree';

const roots = templateTree(
  { items: [{ label: 'Order data', items: [{ label: 'order id', value: '$local:{order_id}' }] }] },
  { fields: { name: { type: 'string' } } }
);
const SERVER = [
  { label: '@name', kind: 5, insertText: '@name' },
  { label: '@status', kind: 5, insertText: '@status', detail: 'Text' },
  { label: '$timestamp:', kind: 6, insertText: '$timestamp:', documentation: 'Timestamp values' },
  { label: 'size', kind: 3, insertText: 'size(', detail: 'gives a whole number' },
  { label: 'true', kind: 12, insertText: 'true' },
];

/**
 * The template picker offers what typing offers (qorus#646, David: "users should be supported with all available
 * completions in the template picker"): the field's own templates, and what the language server completes where a
 * value can be written.
 */
describe('the picker with the language server completions', () => {
  it("joins the server's record fields to the field's own, once each", () => {
    const merged = withServerCompletions(roots, SERVER);
    const fields = merged.find((node) => node.label === 'Record fields');
    expect(fields?.children?.map((node) => node.value)).toEqual(['@name', '@status']);
  });

  it('adds the template contexts, gone on from, the functions and the values as groups of their own', () => {
    const merged = withServerCompletions(roots, SERVER);
    const group = (label: string) => merged.find((node) => node.label === label)?.children ?? [];
    // the field's own context ($local:, with what is in it, taken whole) and the server's ($timestamp:, gone on from)
    expect(group('Template contexts').map((node) => [node.reference, node.continues, node.value])).toEqual([
      ['$local:', undefined, '$local:*'],
      ['$timestamp:', true, undefined],
    ]);
    expect(group('Functions').map((node) => [node.label, node.value, node.kind])).toEqual([
      ['size', 'size(', 'function'],
    ]);
    expect(group('Values and keywords').map((node) => node.value)).toEqual(['true']);
  });

  it('adds a Record fields group where the field has none, and nothing without an answer', () => {
    const own = templateTree({ items: [{ label: 'x', value: '$local:x' }] });
    expect(withServerCompletions(own, SERVER).map((node) => node.label)).toContain('Record fields');
    expect(withServerCompletions(own, undefined)).toBe(own);
  });
});

/* qorus#646, David's review: a lone group of the field's is opened only where it is truly alone; beside other
   groups (the record's fields, the server's) it is kept whole, under its name. */
describe('a lone group of templates', () => {
  const lone = { items: [{ label: 'Order data', items: [{ label: 'order id', value: '$local:{order_id}' }] }] };

  it('is opened where it is the only group', async () => {
    const { openLoneGroup } = await import('../src/helpers/templateTree');
    expect(templateTree(lone).map((node) => node.label)).toEqual(['order id']);
    expect(openLoneGroup(templateTree(lone, { keepLoneGroup: true })).map((node) => node.label)).toEqual([
      'order id',
    ]);
  });

  it('is kept whole beside the groups a host adds', async () => {
    const { openLoneGroup } = await import('../src/helpers/templateTree');
    const kept = templateTree(lone, { keepLoneGroup: true });
    expect(openLoneGroup(withServerCompletions(kept, SERVER)).map((node) => node.label)).toEqual([
      'Order data',
      'Record fields',
      'Template contexts',
      'Functions',
      'Values and keywords',
    ]);
  });
});

/*
 * qorus#646, the IDE's Sheet Contract Review: a host's catalogue lists the row's fields as templates
 * (`$record:{pos}` under "Fields of the row") and the expression's language server and its record (`@pos`, under
 * Record fields) list them again, so the picker's first look was two groups holding the same fields rather than the
 * fields. A record field the catalogue already lists is that one field: listed once, where the host lists it.
 */
describe("the row's fields, listed by the host and by the record", () => {
  const HOST = {
    items: [
      {
        label: 'Fields of the row',
        items: [
          { label: 'pos', value: '$record:{pos}' },
          { label: 'bezeichnung', value: '$record:{bezeichnung}' },
        ],
      },
    ],
  };
  const ROW_FIELDS = {
    pos: { type: 'int', short_desc: 'The position' },
    bezeichnung: { type: 'string' },
  };
  const labels = (nodes: { label: string }[]) => nodes.map((node) => node.label);

  it("are the host's, once each, and no Record fields group repeats them", () => {
    const kept = templateTree(HOST, { fields: ROW_FIELDS, keepLoneGroup: true });
    expect(labels(kept)).toEqual(['Fields of the row']);
    expect(labels(kept[0].children ?? [])).toEqual(['pos', 'bezeichnung']);
  });

  it('are what the first look shows, the language server answering with them too', async () => {
    const { openLoneGroup } = await import('../src/helpers/templateTree');
    const kept = templateTree(HOST, { fields: ROW_FIELDS, keepLoneGroup: true });
    const server = [
      { label: '@pos', kind: 5, insertText: '@pos', detail: 'Whole number' },
      { label: '@bezeichnung', kind: 5, insertText: '@bezeichnung' },
    ];
    const roots = openLoneGroup(withServerCompletions(kept, server));
    expect(labels(roots)).toEqual(['pos', 'bezeichnung']);
    // written as the host writes them
    expect(roots.map((node) => node.value)).toEqual(['$record:{pos}', '$record:{bezeichnung}']);
  });

  it('keep what the record says of a field where the host says nothing', () => {
    const [group] = templateTree(HOST, { fields: ROW_FIELDS, keepLoneGroup: true });
    const pos = group.children!.find((node) => node.label === 'pos')!;
    expect(pos).toMatchObject({ value: '$record:{pos}', type: 'int', description: 'The position' });
  });

  it('list a field the host does not list under Record fields, alone', () => {
    const kept = templateTree(HOST, {
      fields: { ...ROW_FIELDS, menge: { type: 'float' } },
      keepLoneGroup: true,
    });
    expect(labels(kept)).toEqual(['Fields of the row', 'Record fields']);
    expect(labels(kept[1].children ?? [])).toEqual(['menge']);
    const merged = withServerCompletions(kept, [
      { label: '@pos', kind: 5, insertText: '@pos' },
      { label: '@status', kind: 5, insertText: '@status' },
    ]);
    expect(
      merged.find((node) => node.label === 'Record fields')?.children?.map((node) => node.value)
    ).toEqual(['@menge', '@status']);
  });

  it('are not a path into a field: `$record:{customer.name}` is not the field customer', () => {
    const kept = templateTree(
      { items: [{ label: 'Row', items: [{ label: 'name', value: '$record:{customer.name}' }] }] },
      { fields: { customer: { type: 'hash' } }, keepLoneGroup: true }
    );
    expect(labels(kept)).toEqual(['Row', 'Record fields']);
    expect(labels(kept[1].children ?? [])).toEqual(['customer']);
  });
});
