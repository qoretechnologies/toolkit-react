// Copyright 2026 Qore Technologies, s.r.o.
import { TReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildTemplates,
  DEFAULT_REQRAFT_TEMPLATE_GROUPS,
  getTemplateStateAlias,
  ITemplatesPayload,
  setReqraftTemplateGroups,
} from '../src/helpers/templates';

/**
 * A list of templates is grouped by the server's group codes, in the server's order: what started the Qog, the
 * earlier steps (a list per step), dates and times, this run, the data it keeps, variables, settings, and the values
 * for tests last. Inside a group the values keep the server's order: Unix time is last in "Dates and times" because
 * the server puts it there.
 */
const payload: ITemplatesPayload = {
  _context: {
    display_name: 'Context Data',
    internal: true,
    items: [
      { name: 'now', display_name: 'Now', value: '$local:now', group: 'time' },
      { name: 'today', display_name: 'Start of today', value: '$local:today', group: 'time' },
      { name: 'unix', display_name: 'At the epoch (Unix time)', value: '$local:unix', group: 'time' },
      { name: 'run', display_name: 'Run ID', value: '$local:run', group: 'flow' },
      { name: 'kept', display_name: 'Kept order', value: '$local:kept', group: 'kept_data' },
      { name: 'list', display_name: 'Test list', value: '$local:list', group: 'test' },
    ],
  },
  _vars: {
    display_name: 'Variables',
    internal: true,
    items: [{ name: 'count', display_name: 'Count', value: '$var:count', group: 'variables' }],
  },
  _config: {
    display_name: 'Config',
    internal: true,
    items: [{ name: 'limit', display_name: 'Limit', value: '$config:limit', group: 'settings' }],
  },
  start: {
    display_name: 'Order received',
    is_event_trigger: true,
    logo: 'shop.svg',
    app: 'Shop',
    items: [{ name: 'id', display_name: 'Order ID', value: '$data:{start.id}', group: 'trigger' }],
  },
  get_order: {
    display_name: 'Get order',
    items: [
      { name: 'total', display_name: 'Total', value: '$data:{get_order.total}', group: 'step' },
    ],
  },
  check_stock: {
    display_name: 'Check stock',
    items: [
      { name: 'left', display_name: 'Left', value: '$data:{check_stock.left}', group: 'step' },
    ],
  },
};

const groups = (built = buildTemplates(payload)) =>
  (built?.items ?? []) as TReqoreDropdownItem[];
const group = (label: string, built = buildTemplates(payload)) =>
  groups(built).find((item) => item.label === label)!;
const labels = (items: TReqoreDropdownItem[] | undefined) => (items ?? []).map((item) => item.label);

describe("a list of templates grouped by the server's codes", () => {
  afterEach(() => setReqraftTemplateGroups());

  it('draws the groups in the server order, the values for tests last', () => {
    expect(labels(groups())).toEqual([
      'The event that started the Qog',
      'Earlier steps',
      'Dates and times',
      'This run',
      'Data it keeps while it runs',
      'Variables',
      'Settings',
      'Values for tests',
    ]);
  });

  it("keeps the server's order inside a group: Unix time last", () => {
    expect(labels(group('Dates and times').items as TReqoreDropdownItem[])).toEqual([
      'Now',
      'Start of today',
      'At the epoch (Unix time)',
    ]);
  });

  it('holds a list per earlier step, in the order of the payload, under its name', () => {
    const steps = group('Earlier steps').items as TReqoreDropdownItem[];
    expect(labels(steps)).toEqual(['Get order', 'Check stock']);
    expect(labels(steps[0].items as TReqoreDropdownItem[])).toEqual(['Total']);
  });

  it("keeps a step's logo and app on its group, and draws an invalid step disabled in danger", () => {
    const built = buildTemplates(payload, undefined, { isStepValid: (dataId) => dataId !== 'start' });
    const trigger = group('The event that started the Qog', built);
    expect(trigger.leftIconProps?.image).toBe('shop.svg');
    expect(trigger.badge).toBe('Shop');
    expect(trigger.disabled).toBe(true);
    expect(trigger.intent).toBe('danger');
    expect(group('Dates and times', built).disabled).toBeUndefined();
  });

  it("marks every group built from the server's own context", () => {
    for (const label of ['Dates and times', 'This run', 'Data it keeps while it runs', 'Values for tests']) {
      expect((group(label).metadata as { serverContext?: boolean }).serverContext).toBe(true);
    }
    expect((group('Variables').metadata as { serverContext?: boolean }).serverContext).toBeUndefined();
  });

  it("follows the host's order and hidden groups, and draws a group with no words without a heading", () => {
    setReqraftTemplateGroups({
      order: ['variables', 'time', 'audit'],
      notListedByDefault: ['settings'],
    });
    const built = buildTemplates({
      ...payload,
      _audit: {
        display_name: 'Audit',
        internal: true,
        items: [{ name: 'who', display_name: 'Changed by', value: '$local:who', group: 'audit' }],
      },
    });
    // the host's order first; the codes it does not order next; its hidden group last; no words, no heading
    expect(labels(groups(built))).toEqual([
      'Variables',
      'Dates and times',
      'Changed by',
      'The event that started the Qog',
      'Earlier steps',
      'This run',
      'Data it keeps while it runs',
      'Values for tests',
      'Settings',
    ]);
  });

  it('builds a payload with no group codes as before: a group per block, by name', () => {
    const plain = buildTemplates({
      b: { display_name: 'Beta', items: [{ display_name: 'Two', value: '$x:2' }] },
      a: { display_name: 'Alpha', items: [{ display_name: 'One', value: '$x:1' }] },
    });
    expect(labels(groups(plain))).toEqual(['Alpha', 'Beta']);
  });

  it("gives a step's values their reference under the step's own id, its fields too", () => {
    const built = buildTemplates(
      {
        '2': {
          display_name: 'Reply',
          items: [
            {
              display_name: 'Answer',
              value: '$data:{2.answer}',
              group: 'step',
              items: [{ display_name: 'Text', value: '$data:{2.answer.text}' }],
            },
          ],
        },
      },
      undefined,
      { stateIdOf: (dataId) => (dataId === '2' ? 'dc_ai_reply' : undefined) }
    );
    const [step] = group('Earlier steps', built).items as TReqoreDropdownItem[];
    const [answer] = step.items as TReqoreDropdownItem[];
    expect((answer.metadata as { aliasValues?: string[] }).aliasValues).toEqual([
      '$data:{dc_ai_reply.answer}',
    ]);
    expect(
      ((answer.items as TReqoreDropdownItem[])[0].metadata as { aliasValues?: string[] }).aliasValues
    ).toEqual(['$data:{dc_ai_reply.answer.text}']);
    expect(getTemplateStateAlias('$data:{2}', '2', 'dc_ai_reply')).toBe('$data:{dc_ai_reply}');
    expect(getTemplateStateAlias('$local:x', '2', 'dc_ai_reply')).toBeUndefined();
  });

  it("starts from the server's registry", () => {
    expect(DEFAULT_REQRAFT_TEMPLATE_GROUPS).toEqual({
      order: ['trigger', 'step', 'time', 'flow', 'kept_data', 'variables', 'settings', 'test'],
      notListedByDefault: ['test'],
    });
  });
});
