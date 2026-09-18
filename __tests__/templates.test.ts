import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import {
  buildTemplates,
  filterTemplatesByType,
  findTemplate,
  findTemplateByPath,
  getTemplateKey,
  describeTemplateReference,
  getTemplateReferencePath,
  resolveTemplateLabel,
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

    // A template-authored FSM state is keyed '3' in the states hash while its
    // own id is `dc_ai_reply`; the catalogue spells item values with the key
    // and the saved reference uses the id. The producer supplies the alternate
    // spelling so the label still resolves — see `matchesTemplateValue`.
    const aliased: IReqoreFormTemplates = {
      items: [
        {
          label: 'Generate AI Reply',
          items: [
            {
              label: 'Choices',
              value: '$data:{3.choices}',
              metadata: { aliasValues: ['$data:{dc_ai_reply.choices}'] },
            },
            {
              label: 'Usage',
              items: [
                {
                  label: 'Total Tokens',
                  value: '$data:{3.usage.total_tokens}',
                  metadata: { aliasValues: ['$data:{dc_ai_reply.usage.total_tokens}'] },
                },
              ],
            },
          ],
        },
      ],
    };

    it('resolves an item through an alias spelling, at any depth', () => {
      expect(findTemplate(aliased, '$data:{dc_ai_reply.choices}')?.label).toBe('Choices');
      expect(findTemplate(aliased, '$data:{dc_ai_reply.usage.total_tokens}')?.label).toBe(
        'Total Tokens'
      );
    });

    // A catalogue stops at a list: `choices` is offered, `choices[0]...` is
    // not, so an operator's hand-extended path has no item of its own.
    it('names a hand-extended path after its nearest catalogue ancestor', () => {
      const extended = findTemplateByPath(aliased, '$data:{3.choices[0].message.content}');
      expect(extended?.item.label).toBe('Choices');
      expect(extended?.remainder).toBe('[0].message.content');

      // …and through the alias spelling, which is how a template Qog saves it.
      const viaAlias = findTemplateByPath(aliased, '$data:{dc_ai_reply.choices[0].message.content}');
      expect(viaAlias?.item.label).toBe('Choices');
      expect(viaAlias?.remainder).toBe('[0].message.content');
    });

    it('only matches at a path boundary, within the same token key', () => {
      // `choicesOther` must not be named after `choices`.
      expect(findTemplateByPath(aliased, '$data:{3.choicesOther}')).toBeUndefined();
      // A different token key never lends its name to a $data value.
      expect(findTemplateByPath(aliased, '$config:{3.choices.deep}')).toBeUndefined();
      // An exact value is not an extension — findTemplate answers that.
      expect(findTemplateByPath(aliased, '$data:{3.choices}')).toBeUndefined();
      // Non-braced and unknown values resolve to nothing.
      expect(findTemplateByPath(aliased, '$local:id')).toBeUndefined();
      expect(findTemplateByPath(aliased, '$data:{9.nope.deep}')).toBeUndefined();
    });

    it('keeps the item value authoritative and still rejects unknown refs', () => {
      // The catalogue's own spelling wins and is what a pick stores.
      expect(findTemplate(aliased, '$data:{3.choices}')?.value).toBe('$data:{3.choices}');
      expect(findTemplate(aliased, '$data:{dc_ai_reply.choices}')?.value).toBe('$data:{3.choices}');
      // An alias never widens the match to another state.
      expect(findTemplate(aliased, '$data:{dc_send_reply.choices}')).toBeUndefined();
    });
  });

  describe('resolveTemplateLabel / describeTemplateReference', () => {
    const templates: IReqoreFormTemplates = {
      items: [
        {
          label: 'Generate AI Reply',
          items: [
            {
              label: 'Choices',
              value: '$data:{3.choices}',
              metadata: { aliasValues: ['$data:{dc_ai_reply.choices}'] },
            },
          ],
        },
      ],
    };

    it('names a reference the same way for every surface', () => {
      // exact, alias, and hand-extended all resolve through one entry point
      expect(resolveTemplateLabel(templates, '$data:{3.choices}').label).toBe('Choices');
      expect(resolveTemplateLabel(templates, '$data:{dc_ai_reply.choices}').label).toBe('Choices');
      expect(
        resolveTemplateLabel(templates, '$data:{dc_ai_reply.choices[0].message.content}').label
      ).toBe('Choices[0].message.content');
    });

    it('joins a field step with a separator and keeps an index attached', () => {
      // A field step reads as a step…
      expect(resolveTemplateLabel(templates, '$data:{3.choices.first}').label).toBe(
        'Choices \u203a first'
      );
      // …while an array index binds to the name it indexes, rather than
      // floating off it as a separate step.
      expect(resolveTemplateLabel(templates, '$data:{3.choices[0].message.content}').label).toBe(
        'Choices[0].message.content'
      );
    });

    it('falls back to the raw value when the catalogue explains nothing', () => {
      expect(resolveTemplateLabel(templates, '$data:{9.unknown}').label).toBe('$data:{9.unknown}');
      expect(resolveTemplateLabel(undefined, '$data:{3.choices}').label).toBe('$data:{3.choices}');
    });

    it('describes a reference readably when the catalogue explains nothing', () => {
      // The Automation Hub template preview fetches no catalogue at all, and
      // the raw token is all that is left — show the path, not the wrapper.
      expect(
        describeTemplateReference(undefined, '$data:{dc_ai_reply.choices[0].message.content}').label
      ).toBe('dc_ai_reply.choices[0].message.content');
      expect(getTemplateReferencePath('$data:{dc_ai_reply.choices}')).toBe('dc_ai_reply.choices');
      // A word token is already short; there is no wrapper to strip.
      expect(getTemplateReferencePath('$local:id')).toBe('$local:id');
      // With a catalogue the name still wins.
      expect(describeTemplateReference(templates, '$data:{3.choices}').label).toBe('Choices');
    });

  });

  /* A host may spell its references WITHOUT a key and WITHOUT braces — a Qorus
     test names what a step captured as `$.create`, and an author walks deeper
     into it by hand as `$.create.status`. Both grammars reach the same
     resolution, and neither lends its names to the other. */
  describe('the key-less `$.path` grammar', () => {
    const templates: IReqoreFormTemplates = {
      items: [
        {
          label: 'Values this case captures',
          items: [
            { label: 'everything from create_order', value: '$.create' },
            { label: 'everything from create_order_other', value: '$.createOther' },
            { label: 'the case mode', value: '$._case.mode' },
          ],
        },
      ],
    };

    it('names a hand-extended key-less path after its nearest ancestor', () => {
      // The catalogue stops where the step's declared output stops; `.status`
      // is the author's own walk and has no entry of its own.
      const extended = findTemplateByPath(templates, '$.create.status');
      expect(extended?.item.label).toBe('everything from create_order');
      expect(extended?.remainder).toBe('.status');

      expect(resolveTemplateLabel(templates, '$.create.status').label).toBe(
        'everything from create_order \u203a status'
      );
      // An index binds to the name it indexes, exactly as in the braced form.
      expect(resolveTemplateLabel(templates, '$.create[0].id').label).toBe(
        'everything from create_order[0].id'
      );
      // A leading underscore is a legal first character of a root segment.
      expect(resolveTemplateLabel(templates, '$._case.mode.raw').label).toBe(
        'the case mode \u203a raw'
      );
    });

    it('still requires a path boundary, so a sibling is not named after it', () => {
      // `$.createOther` is its OWN entry; it must never be read as `$.create`
      // extended by `Other`.
      expect(findTemplateByPath(templates, '$.createOther')).toBeUndefined();
      expect(resolveTemplateLabel(templates, '$.createOther').label).toBe(
        'everything from create_order_other'
      );
      // A deeper walk from the sibling is named after the SIBLING.
      expect(findTemplateByPath(templates, '$.createOther.status')?.item.label).toBe(
        'everything from create_order_other'
      );
      // An exact value is not an extension — findTemplate answers that.
      expect(findTemplateByPath(templates, '$.create')).toBeUndefined();
      expect(resolveTemplateLabel(templates, '$.create').label).toBe(
        'everything from create_order'
      );
    });

    it('never lets a keyed and a key-less token name each other', () => {
      const keyed: IReqoreFormTemplates = {
        items: [{ label: 'Choices', value: '$data:{create.choices}' }],
      };
      // "no key" is a key of its own: a $data: item explains no `$.` value…
      expect(findTemplateByPath(keyed, '$.create.choices.first')).toBeUndefined();
      expect(resolveTemplateLabel(keyed, '$.create.choices.first').label).toBe(
        '$.create.choices.first'
      );
      // …and a key-less item explains no $data: value.
      expect(findTemplateByPath(templates, '$data:{create.status}')).toBeUndefined();
      expect(resolveTemplateLabel(templates, '$data:{create.status}').label).toBe(
        '$data:{create.status}'
      );
    });

    it('leaves an unknown root, and the braced grammar, exactly as they were', () => {
      // Nothing in the catalogue explains this root, so the reference itself
      // is the honest answer.
      expect(resolveTemplateLabel(templates, '$.unknown.status').label).toBe('$.unknown.status');
      // A key-less reference has no wrapper to strip, so the readable floor
      // stays the reference as written rather than a headless `.create.status`.
      expect(getTemplateReferencePath('$.create.status')).toBe('$.create.status');
      expect(describeTemplateReference(templates, '$.unknown.status').label).toBe(
        '$.unknown.status'
      );
      // A bare `$word` is not this grammar and names nothing.
      expect(findTemplateByPath(templates, '$create')).toBeUndefined();
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

    // Selected BY NAME, not by position: the picker orders its entries
    // alphabetically, so an index here would assert the ordering rather than
    // the mapping this test is about.
    const leafNamed = (label: string) =>
      buildTemplates(payload)?.items?.[0].items?.find((item) => item.label === label);

    it('maps leaves with type badge and example-value description', () => {
      const leaf = leafNamed('Interface ID');
      expect(leaf?.label).toBe('Interface ID');
      expect(leaf?.value).toBe('$local:id');
      expect(leaf?.badge).toBe('string');
      expect(leaf?.description).toBe('Example value: 42');
      expect(leaf?.leftAction).toBeUndefined();
      // Group-level data_role is inherited by items without their own.
      expect(leaf?.metadata?.dataRole).toBe('input');
    });

    it('recurses into nested items and injects the select-this-item leftAction', () => {
      const hashItem = leafNamed('Hash item');
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
