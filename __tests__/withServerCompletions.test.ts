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
