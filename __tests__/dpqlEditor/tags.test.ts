// Copyright 2026 Qore Technologies, s.r.o.
// A template reference in DPQL reads as the name it was chosen by.
//
// A collapsed expression row used to chip its references itself, named from the
// form's template catalogue. When every read-only expression moved onto the one
// DPQL rendering, that rendering named a reference by its path only, so the
// Discord assistant's Save Reply row went from `trim(Choices[0].message.content)`
// back to the `$data:{dc_ai_reply.choices[0].message.content}` path.
import { describe, expect, it } from 'vitest';
import { makeDpqlTagRenderer } from '../../src/components/dpqlEditor/dpqlTags';
import type { ISlateElement } from '../../src/components/smartEditor/types';

const TEMPLATES = {
  items: [
    {
      label: 'Generate AI Reply',
      items: [
        {
          label: 'Choices',
          value: '$data:{3.choices}',
          description: 'The choices the model returned',
          metadata: { aliasValues: ['$data:{dc_ai_reply.choices}'] },
        },
      ],
    },
  ],
} as never;

const tag = (value: string): ISlateElement => ({
  type: 'tag',
  value,
  label: value,
  children: [{ text: '' }],
});

describe('makeDpqlTagRenderer template references', () => {
  it('names a reference the catalogue knows, by an alias and a path below it', () => {
    const props = makeDpqlTagRenderer({}, { templates: TEMPLATES })(
      tag('$data:{dc_ai_reply.choices[0].message.content}')
    );

    expect(props.label).toBe('Choices[0].message.content');
    expect(props.tooltip).toMatchObject({
      title: 'Choices[0].message.content',
      content: 'The choices the model returned',
    });
    expect(props.icon).toBe('ExchangeDollarLine');
  });

  it('leaves a reference the catalogue does not know to its own label', () => {
    const props = makeDpqlTagRenderer({}, { templates: TEMPLATES })(tag('$local:name'));

    expect(props).not.toHaveProperty('label');
    expect(props).not.toHaveProperty('tooltip');
  });

  it('names nothing without a catalogue', () => {
    const props = makeDpqlTagRenderer({}, { templateTagsUseIntent: true })(
      tag('$data:{dc_ai_reply.choices[0].message.content}')
    );

    expect(props).toEqual({ icon: 'ExchangeDollarLine', intent: 'info' });
  });
});
