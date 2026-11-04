// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { QOG_FIELD_TEMPLATES } from '../src/components/form/fields/template/__fixtures__/qogTemplatePayloads';
import { defaultQorusTypes } from '../src/helpers/qorusTypeCatalogue';
import { filterTemplatesByType } from '../src/helpers/templates';
import { templateTree } from '../src/helpers/templateTree';

type TRow = { label?: string; disabled?: boolean; items?: TRow[] };
const stateRow = (templates: { items?: unknown[] }, label: string) =>
  (templates.items as TRow[]).find((row) => row.label === label);

/**
 * A Qog state's data is a hash: a field that takes a record is offered it whole, though nothing it holds fits the
 * field (qorus#646, David's review: Look up customer - an ID and a tier - had no Use in a hash field). Its members
 * are shown, none of them to be picked; a text field is offered none of it.
 */
describe('a Qog state none of whose data fits the field', () => {
  it('is kept for a hash field, its members shown and not picked, and taken whole', () => {
    const filtered = filterTemplatesByType(QOG_FIELD_TEMPLATES, 'hash', false, defaultQorusTypes);
    const state = stateRow(filtered, 'Look up customer');
    expect(state, 'Look up customer').toBeTruthy();
    expect(state!.items?.map((member) => [member.label, member.disabled])).toEqual([
      ['Customer ID', true],
      ['Tier', true],
    ]);
    const node = templateTree(filtered, { wholeRecords: true }).find(
      (root) => root.label === 'Look up customer'
    );
    expect(node?.takesWhole).toBe(true);
    expect(node?.value).toBe('$data:{lookup_customer}');
  });

  it('offers nothing of it to a date field, which takes no record', () => {
    const filtered = filterTemplatesByType(QOG_FIELD_TEMPLATES, 'date', false, defaultQorusTypes);
    expect(stateRow(filtered, 'Look up customer')?.items ?? []).toEqual([]);
  });
});
