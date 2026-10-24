// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Where a template comes from, as its host says (`templateBadge`), in every list a template is picked from: it was
 * said only beside the template held on a Template tab, which a text option has no more - its text takes the
 * templates (qorus#646, David on FormEngine · Template Badge From The Host).
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTemplateTags } from '../src/components/form/fields/rich-text/useTemplateTags';
import {
  templateCompletionItems,
  withTemplateSources,
} from '../src/components/smartEditor/templateCompletions';

const ROW_FIELDS = {
  items: [
    {
      label: 'Fields of the row',
      items: [
        { label: 'pos', value: '$record:{pos}', badge: 'int', description: 'The position' },
        { label: 'bezeichnung', value: '$record:{bezeichnung}', badge: 'string' },
      ],
    },
    { label: 'Order id', value: '$local:order_id', badge: 'int' },
  ],
};

const rowField = (template: { value?: unknown }) =>
  String(template.value).startsWith('$record:') ? 'Row field' : undefined;

describe('a catalogue marked with where its templates come from', () => {
  it('marks each template the host names, and no group', () => {
    const marked = withTemplateSources(ROW_FIELDS, rowField) as unknown as {
      items: { source?: string; items?: { source?: string }[] }[];
    };
    expect(marked.items[0].source).toBeUndefined();
    expect(marked.items[0].items?.map((item) => item.source)).toEqual(['Row field', 'Row field']);
    expect(marked.items[1].source).toBeUndefined();
  });

  it('gives a template no `items` of its own: a list draws a row with an empty one as disabled', () => {
    const marked = withTemplateSources(ROW_FIELDS, rowField) as unknown as {
      items: Record<string, unknown>[];
    };
    const leaves = [
      ...((marked.items[0].items as Record<string, unknown>[]) ?? []),
      marked.items[1],
    ];
    for (const leaf of leaves) expect('items' in leaf).toBe(false);
  });

  it('is the catalogue itself where the host names nothing', () => {
    expect(withTemplateSources(ROW_FIELDS, undefined)).toBe(ROW_FIELDS);
    expect(withTemplateSources(undefined, rowField)).toBeUndefined();
  });

  it('says it first in the row of the list a $ opens', () => {
    const items = templateCompletionItems(withTemplateSources(ROW_FIELDS, rowField) as never);
    expect(items.map((item) => [item.label, item.detail])).toEqual([
      // its type by its name (templateTypeBadge)
      ['pos', 'Row field · Fields of the row · Whole number'],
      ['bezeichnung', 'Row field · Fields of the row · Text'],
      ['Order id', 'Whole number'],
    ]);
  });

  it('leads the description of the row in the list a click opens', () => {
    const { result } = renderHook(() =>
      useTemplateTags(withTemplateSources(ROW_FIELDS, rowField) as never)
    );
    const listed = (result.current?.templates?.items ?? []) as {
      label?: string;
      description?: unknown;
      items?: { label?: string; description?: unknown }[];
    }[];
    const leaves = listed.flatMap((item) => item.items ?? [item]);
    const describe = (label: string) =>
      String(leaves.find((item) => item.label === label)?.description ?? '');
    expect(describe('pos')).toContain('Row field');
    expect(describe('pos')).toContain('The position');
    expect(describe('bezeichnung')).toBe('Row field');
    expect(describe('Order id')).toBe('');
  });
});
