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
    expect(group('Template contexts').map((node) => [node.value, node.continues])).toEqual([
      ['$timestamp:', true],
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
