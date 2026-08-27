import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import {
  buildTemplates,
  filterTemplatesByType,
  findTemplate,
  getTemplateKey,
  getTemplateValue,
  isBracedTemplateToken,
  isCompleteTemplateToken,
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

    it('strictly recognizes whole-value tokens, braced context refs included', () => {
      // the FSM state-output form that used to rehydrate as raw text
      expect(isCompleteTemplateToken('$data:{W2n_BuSHbaNrbvV1MkfPF.filename}')).toBe(true);
      // braced paths may carry colons, dots, spaces and dashes
      expect(isCompleteTemplateToken('$data:{deep:test:list}')).toBe(true);
      expect(isCompleteTemplateToken('$data:{id.Created by.name}')).toBe(true);
      expect(isCompleteTemplateToken('$data:{abc.Multi-select}')).toBe(true);
      // dashed template keys and plain word paths
      expect(isCompleteTemplateToken('$qore-expr:{1 + 2}')).toBe(true);
      expect(isCompleteTemplateToken('$local:input')).toBe(true);
      // NOT whole tokens: surrounding text, spaced dollar-strings, digit keys
      expect(isCompleteTemplateToken('x $data:{a.b}')).toBe(false);
      expect(isCompleteTemplateToken('$data:{a.b}.csv')).toBe(false);
      expect(isCompleteTemplateToken('$foo: hello')).toBe(false);
      expect(isCompleteTemplateToken('$5:00 fee')).toBe(false);
      expect(isCompleteTemplateToken(undefined)).toBe(false);
    });

    it('tells braced context refs apart from plain typeable tokens', () => {
      // braced refs are machine-written — surfaces may chip them
      expect(isBracedTemplateToken('$data:{W2n_BuSHbaNrbvV1MkfPF.filename}')).toBe(true);
      expect(isBracedTemplateToken('$qore-expr:{1 + 2}')).toBe(true);
      expect(isBracedTemplateToken('$data:step:{a.b}')).toBe(true);
      // plain word paths stay typeable — they keep the template-offering input
      expect(isBracedTemplateToken('$local:input')).toBe(false);
      expect(isBracedTemplateToken('$config:a:b')).toBe(false);
      // not complete tokens at all
      expect(isBracedTemplateToken('x $data:{a.b}')).toBe(false);
      expect(isBracedTemplateToken('$data:{a.b}.csv')).toBe(false);
      expect(isBracedTemplateToken(undefined)).toBe(false);
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

    describe('long example values', () => {
      const longValue = `${'x'.repeat(200)}THE_END`;
      const longPayload: ITemplatesPayload = {
        ctx: {
          display_name: 'Context Data',
          items: [
            {
              display_name: 'Attachment Body',
              value: '$local:data',
              type: 'data',
              example_value: longValue,
            },
            {
              display_name: 'Attachment Name',
              value: '$local:name',
              type: 'string',
              example_value: 'invoice.pdf',
            },
            {
              display_name: 'Author',
              value: '$local:author',
              type: 'hash',
              // A parent whose own serialized example is long: must carry BOTH
              // the select leftAction and the full-value rightAction.
              example_value: { signature: 'y'.repeat(200) },
              items: [
                { display_name: 'Name', value: '$local:author.name', type: 'string' },
              ],
            },
          ],
        },
      };

      it('caps past the DOM ceiling and injects the full-value rightAction', () => {
        const leaf = buildTemplates(longPayload)?.items?.[0].items?.[0];
        expect(leaf?.description).toBe(`Example value: ${`"${'x'.repeat(200)}`.slice(0, 150)}…`);
        expect(leaf?.description).not.toContain('THE_END');
        expect(leaf?.rightAction?.icon).toBe('QuestionLine');
        // The visual truncation is the single-line ellipsis, cut at the
        // rendered width — container-intrinsic, no breakpoints.
        expect(leaf?.descriptionEffect).toEqual({ noWrap: true });
      });

      it('leaves short examples whole, wrapping, and affordance-free', () => {
        const leaf = buildTemplates(longPayload)?.items?.[0].items?.[1];
        expect(leaf?.description).toBe('Example value: "invoice.pdf"');
        expect(leaf?.rightAction).toBeUndefined();
        // No ellipsis without the "?" to reveal what it hides.
        expect(leaf?.descriptionEffect).toBeUndefined();
      });

      it('gives a long-example parent both the select and full-value actions', () => {
        const parent = buildTemplates(longPayload)?.items?.[0].items?.[2];
        expect(parent?.leftAction?.icon).toBe('AddCircleLine');
        expect(parent?.rightAction?.icon).toBe('QuestionLine');
        expect(parent?.descriptionEffect).toEqual({ noWrap: true });
      });
    });
  });
});
