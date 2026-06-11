import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import {
  buildTemplates,
  filterTemplatesByType,
  findTemplate,
  getTemplateKey,
  getTemplateValue,
  isValueTemplate,
  ITemplatesPayload,
} from '../src/helpers/templates';

describe('helpers/templates', () => {
  describe('template string utilities', () => {
    it('detects template strings by the $key: shape', () => {
      expect(isValueTemplate('$config:item')).toBe(true);
      expect(isValueTemplate('$local:id')).toBe(true);
      expect(isValueTemplate('plain value')).toBe(false);
      expect(isValueTemplate('$nocolon')).toBe(false);
      expect(isValueTemplate('')).toBe(false);
    });

    it('splits key and value around the first colon', () => {
      expect(getTemplateKey('$config:item')).toBe('config');
      expect(getTemplateValue('$config:item')).toBe('item');
      // Values containing colons stay intact.
      expect(getTemplateValue('$config:a:b')).toBe('a:b');
    });
  });

  describe('findTemplate', () => {
    const templates: IReqoreFormTemplates = {
      items: [
        {
          label: 'Group',
          items: [
            { label: 'Leaf', value: '$ctx:leaf' },
            { label: 'Deep', items: [{ label: 'Deeper', value: '$ctx:deep' }] },
          ],
        },
      ],
    };

    it('finds items at any nesting depth by value', () => {
      expect(findTemplate(templates, '$ctx:leaf')?.label).toBe('Leaf');
      expect(findTemplate(templates, '$ctx:deep')?.label).toBe('Deeper');
    });

    it('returns undefined for unknown or empty values', () => {
      expect(findTemplate(templates, '$ctx:nope')).toBeUndefined();
      expect(findTemplate(templates, '')).toBeUndefined();
    });
  });

  describe('filterTemplatesByType', () => {
    const templates: IReqoreFormTemplates = {
      items: [
        { divider: true, label: 'Divider' },
        {
          label: 'Context',
          items: [
            { label: 'Int item', value: '$ctx:int', badge: 'int' },
            { label: 'Date item', value: '$ctx:date', badge: 'date' },
            {
              label: 'Date group with int child',
              badge: 'date',
              items: [{ label: 'Nested int', value: '$ctx:nested', badge: 'int' }],
            },
          ],
        },
      ],
    };

    it('returns the input untouched for hash/list fields with an arg schema', () => {
      expect(filterTemplatesByType(templates, 'hash', true)).toBe(templates);
      expect(filterTemplatesByType(templates, 'list', true)).toBe(templates);
    });

    it('keeps compatible leaves and drops incompatible ones for a typed field', () => {
      const filtered = filterTemplatesByType(templates, 'int');
      const group = filtered.items?.[1];
      const labels = group?.items?.map((i) => i.label);
      expect(labels).toContain('Int item');
      expect(labels).not.toContain('Date item');
    });

    it('keeps an incompatible group when a nested item survives, without its leftAction', () => {
      const filtered = filterTemplatesByType(templates, 'int');
      const group = filtered.items?.[1];
      const dateGroup = group?.items?.find((i) => i.label === 'Date group with int child');
      expect(dateGroup).toBeDefined();
      expect(dateGroup?.leftAction).toBeUndefined();
      expect(dateGroup?.items?.map((i) => i.label)).toEqual(['Nested int']);
    });

    it('preserves top-level dividers', () => {
      const filtered = filterTemplatesByType(templates, 'int');
      expect(filtered.items?.[0].divider).toBe(true);
    });
  });

  describe('buildTemplates', () => {
    const payload: ITemplatesPayload = {
      ctx: {
        display_name: 'Context Data',
        app: 'qorus',
        short_desc: 'Context values',
        logo: 'logo.png',
        data_role: 'input',
        items: [
          {
            display_name: 'Interface ID',
            value: '$local:id',
            type: 'string',
            example_value: 42,
          },
          {
            display_name: 'Hash item',
            value: '$local:hash',
            type: 'hash',
            items: [
              {
                display_name: 'Child',
                value: '$local:hash.child',
                type: 'string',
                data_role: 'output',
              },
            ],
          },
        ],
      },
    };

    it('returns undefined for a missing or empty payload', () => {
      expect(buildTemplates(undefined)).toBeUndefined();
      expect(buildTemplates({})).toBeUndefined();
    });

    it('maps the payload groups to dropdown groups', () => {
      const result = buildTemplates(payload);
      const group = result?.items?.[0];
      expect(group?.label).toBe('Context Data');
      expect(group?.badge).toBe('qorus');
      expect(group?.description).toBe('Context values');
      expect(group?.leftIconProps?.image).toBe('logo.png');
      expect(group?.metadata?.dataRole).toBe('input');
    });

    it('maps leaves with type badge and example-value description', () => {
      const leaf = buildTemplates(payload)?.items?.[0].items?.[0];
      expect(leaf?.label).toBe('Interface ID');
      expect(leaf?.value).toBe('$local:id');
      expect(leaf?.badge).toBe('string');
      expect(leaf?.description).toBe('Example value: 42');
      expect(leaf?.leftAction).toBeUndefined();
      // Group-level data_role is inherited by items without their own.
      expect(leaf?.metadata?.dataRole).toBe('input');
    });

    it('recurses into nested items and injects the select-this-item leftAction', () => {
      const hashItem = buildTemplates(payload)?.items?.[0].items?.[1];
      expect(hashItem?.items).toHaveLength(1);
      expect(hashItem?.stackWithActions).toBe(false);
      expect(hashItem?.leftAction?.icon).toBe('AddCircleLine');
      // An item's own data_role wins over the inherited group role.
      expect(hashItem?.items?.[0].metadata?.dataRole).toBe('output');
    });
  });
});
