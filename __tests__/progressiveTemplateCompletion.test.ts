// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import {
  CONTEXT_DATA_PAYLOAD,
  QOG_STATE_DATA_PAYLOAD,
  WORKFLOW_CONTEXT_DATA_PAYLOAD,
} from '../src/components/form/fields/template/__fixtures__/qogTemplatePayloads';
import { templateSearchItems } from '../src/components/smartEditor/templateCompletions';
import { unlistedContextMessage } from '../src/components/smartEditor/templateCompletions';
import { buildTemplates } from '../src/helpers/templates';
import { templateTree } from '../src/helpers/templateTree';

const FIELDS = {
  name: { type: 'string' },
  customer: {
    type: { name: 'hash', fields: { name: { type: 'string' }, tier: { type: 'string' } } },
  },
};
const roots = templateTree(
  buildTemplates({ ...CONTEXT_DATA_PAYLOAD, ...QOG_STATE_DATA_PAYLOAD } as never),
  {
    fields: FIELDS,
    wholeRecords: true,
  }
);
/** What each row writes, and whether taking it goes on to what is in it (C). */
const offered = (typed: string, from = roots) =>
  templateSearchItems(from, typed).map((row) => [
    row.insertText,
    (row.data as { continues?: boolean }).continues ? 'C' : '',
  ]);

/**
 * A reference is completed level by level as it is typed (qorus#646, David: "`$` → contexts, `$data:` → states,
 * `$data:receive_order.` → that state's members ... `@` → record fields, `@customer.` → nested fields"): each level
 * filtered by what is typed of it; a context, a state or a record taken writes its reference as text and goes on;
 * only a whole reference is a chip.
 */
describe('a template reference typed level by level', () => {
  it('`$` lists the contexts, each gone on into', () => {
    expect(offered('$')).toEqual([
      ['$local:', 'C'],
      ['$timestamp:', 'C'],
      ['$test:', 'C'],
      ['$data:', 'C'],
    ]);
  });

  it("a context's name narrows them, and from two letters on, the templates named so", () => {
    expect(offered('$d')).toEqual([['$data:', 'C']]);
    expect(offered('$da').map(([written]) => written)).toEqual([
      '$data:',
      '$timestamp:next_midnight',
      '$timestamp:last_midnight',
      '$local:input',
    ]);
  });

  it("`$data:` lists the states, a state's `.` its data, a record's `.` its own", () => {
    // the whole of the context first, `$data:*` (UserApi reads `*` as the whole of it), then its states
    expect(offered('$data:')).toEqual([
      ['$data:*', ''],
      ['$data:lookup_customer.', 'C'],
      ['$data:receive_order.', 'C'],
    ]);
    expect(offered('$data:rec')).toEqual([['$data:receive_order.', 'C']]);
    expect(offered('$data:receive_order.')).toEqual([
      ['$data:receive_order.customer.', 'C'],
      ['$data:{receive_order.event_type}', ''],
      ['$data:{receive_order.order_id}', ''],
      ['$data:{receive_order.user_name}', ''],
    ]);
    expect(offered('$data:receive_order.customer.')).toEqual([
      ['$data:receive_order.customer.address.', 'C'],
      ['$data:{receive_order.customer.name}', ''],
    ]);
  });

  it("a state or record gone on into can still be taken whole: its row's Use writes its value", () => {
    const [state] = templateSearchItems(roots, '$data:rec');
    expect(state.data).toMatchObject({ takesWhole: true, wholeValue: '$data:{receive_order}' });
  });

  it("`@` lists the record's fields, a record field's `.` its own fields", () => {
    expect(offered('@')).toEqual([
      ['@name', ''],
      ['@customer.', 'C'],
    ]);
    expect(offered('@cu')).toEqual([['@customer.', 'C']]);
    expect(offered('@customer.')).toEqual([
      ['@customer.name', ''],
      ['@customer.tier', ''],
    ]);
    expect(offered('@customer.t')).toEqual([['@customer.tier', '']]);
  });

  it('a context of free keys is completed by writing its key, and the list says so', () => {
    const workflow = templateTree(buildTemplates(WORKFLOW_CONTEXT_DATA_PAYLOAD as never));
    const contexts = offered('$', workflow).map(([written]) => written);
    expect(contexts).toContain('$dynamic:');
    // listed once: as its context, not again as a template named so
    expect(offered('$dyn', workflow).map(([written]) => written)).toEqual(['$dynamic:']);
    // its keys are written: only the whole of it is listed, `$dynamic:*`
    expect(offered('$dynamic:', workflow)).toEqual([['$dynamic:*', '']]);
    expect(unlistedContextMessage('$dynamic:')).toBe(
      "Write what $dynamic: refers to after the ':', or pick from the list"
    );
  });
});

/* qorus#646 round 4 (David: every container that can be used has Use; `$data:*`, as UserApi reads `*`) */
describe('a template context, a container', () => {
  it('is used whole where the value takes a record, and not where it takes none', () => {
    const [row] = templateSearchItems(roots, '$d', undefined, true);
    expect(row.data).toMatchObject({ continues: true, takesWhole: true, wholeValue: '$data:*' });
    const [scalar] = templateSearchItems(roots, '$d', undefined, false);
    expect(scalar.data).toMatchObject({ continues: true, takesWhole: false });
  });

  it('lists the whole of it first where it is written, only where the value takes a record', () => {
    expect(offered('$data:')[0]).toEqual(['$data:*', '']);
    expect(
      templateSearchItems(roots, '$data:', undefined, false).map((row) => row.insertText)
    ).not.toContain('$data:*');
  });

  it("is a group of the picker's, beside the field's own groups", async () => {
    const { withTemplateContexts } = await import('../src/helpers/templateTree');
    const picker = withTemplateContexts(roots, true);
    const contexts = picker.find((node) => node.label === 'Template contexts');
    expect(contexts?.children?.map((node) => [node.label, node.value])).toEqual(
      expect.arrayContaining([
        ['$data:', '$data:*'],
        ['$local:', '$local:*'],
      ])
    );
    // a value that takes no record: the same templates regrouped add nothing - no group
    expect(withTemplateContexts(roots, false).map((node) => node.label)).not.toContain(
      'Template contexts'
    );
  });
});
