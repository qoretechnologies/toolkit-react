// Copyright 2026 Qore Technologies, s.r.o.
// A string holding template references, as an editor that draws them as chips.
//
// Template mode used to edit such a string in a plain textarea, so a chosen
// template read as `$local:name` rather than as the name it was chosen by.
import { describe, expect, it } from 'vitest';
import { templateNodesToText, templateTextToNodes } from '../src/helpers/templateText';

const TEMPLATES = {
  items: [
    {
      label: 'Local',
      items: [{ label: 'Customer Name', value: '$local:name', metadata: { builtIn: true } }],
    },
  ],
} as never;

describe('templateTextToNodes', () => {
  it('makes each reference a chip named from the catalogue, with text around it', () => {
    expect(templateTextToNodes('Hello $local:name!', TEMPLATES)).toEqual([
      {
        type: 'paragraph',
        children: [
          { text: 'Hello ' },
          {
            type: 'tag',
            value: '$local:name',
            label: 'Customer Name',
            metadata: { builtIn: true },
            children: [{ text: '' }],
          },
          { text: '!' },
        ],
      },
    ]);
  });

  it('keeps a text node on both sides of a chip, which Slate needs to place a cursor', () => {
    const [paragraph] = templateTextToNodes('$local:name', TEMPLATES);

    expect(paragraph.children.map((node: any) => node.text ?? node.value)).toEqual([
      '',
      '$local:name',
      '',
    ]);
  });

  it('labels a reference the catalogue does not know as the DPQL Text view does', () => {
    const [paragraph] = templateTextToNodes('$config:timeout $data:{order.total}', TEMPLATES);

    expect(paragraph.children[1]).toMatchObject({ type: 'tag', value: '$config:timeout', label: 'config: timeout' });
    expect(paragraph.children[3]).toMatchObject({ label: 'data: order.total' });
  });

  it('chips a braced reference and leaves plain dollar text alone', () => {
    const [paragraph] = templateTextToNodes('costs $5: $data:{order.total}', TEMPLATES);

    expect(paragraph.children.map((node: any) => node.text ?? `[${node.value}]`)).toEqual([
      'costs $5: ',
      '[$data:{order.total}]',
      '',
    ]);
  });

  it('keeps a method call outside the reference it is called on', () => {
    const [paragraph] = templateTextToNodes('$local:str.endsWith("x")', TEMPLATES);

    expect(paragraph.children.map((node: any) => node.text ?? `[${node.value}]`)).toEqual([
      '',
      '[$local:str]',
      '.endsWith("x")',
    ]);
  });

  it('makes a paragraph of each line', () => {
    expect(templateTextToNodes('a\nb', TEMPLATES)).toEqual([
      { type: 'paragraph', children: [{ text: 'a' }] },
      { type: 'paragraph', children: [{ text: 'b' }] },
    ]);
  });

  it('gives an empty string one empty paragraph', () => {
    expect(templateTextToNodes('', TEMPLATES)).toEqual([{ type: 'paragraph', children: [{ text: '' }] }]);
  });
});

describe('templateNodesToText', () => {
  it('writes a chip back as the reference it holds', () => {
    const text = 'Dear $local:name, total $data:{order.total}\nthanks';

    expect(templateNodesToText(templateTextToNodes(text, TEMPLATES))).toBe(text);
  });

  it('reads a chip the editor inserted, with a label of its own, as its reference', () => {
    expect(
      templateNodesToText([
        {
          type: 'paragraph',
          children: [
            { text: 'x ' },
            { type: 'tag', value: '$local:name', label: 'Anything', children: [{ text: '' }] },
            { text: '' },
          ],
        },
      ] as never)
    ).toBe('x $local:name');
  });

  it('reads nothing as an empty string', () => {
    expect(templateNodesToText(undefined)).toBe('');
  });
});
