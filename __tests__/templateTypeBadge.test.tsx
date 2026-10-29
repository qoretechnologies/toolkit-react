// Copyright 2026 Qore Technologies, s.r.o.
// A template's type is named in every list a template is picked from, never shown as its code.
//
// A template kept its type only as its list row's badge (`buildTemplates`: `badge: type`), which Reqore draws as
// it is, so every list of templates said "int", "string", "qoretechnologies/money" beside a template; and the
// field read the badge back as the template's type, so it could not be named there. The type is now a typed
// member of the template (`metadata.type`, with its base type in `metadata.baseType`), and the lists name it by
// the type catalogue (`qorusTypeDisplayName`): a user type with no base type by its path, any other unknown type
// as "Unknown type" (qorus#646).
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTemplateTags } from '../src/components/form/fields/rich-text/useTemplateTags';
import { templateTextValue } from '../src/components/form/fields/template/writtenAsText';
import { styleTemplateItems } from '../src/components/smartEditor/completionStyle';
import { templateCompletionItems } from '../src/components/smartEditor/templateCompletions';
import {
  buildTemplates,
  filterTemplatesByType,
  templateBaseType,
  templateType,
} from '../src/helpers/templates';
import { defaultQorusTypes } from '../src/hooks/useQorusTypes';
import * as reqraft from '../src';

/** The order's templates as the server sends them: types the catalogue lists, user types and an unknown one. */
const ORDER = buildTemplates({
  order: {
    display_name: 'Order',
    items: [
      { display_name: 'Count', value: '$local:count', type: 'int' },
      { display_name: 'Note', value: '$local:note', type: 'string' },
      {
        display_name: 'Total',
        value: '$local:total',
        type: 'qoretechnologies/money',
        base_type: 'number',
      },
      { display_name: 'Status', value: '$local:status', type: 'qoretechnologies/status' },
      { display_name: 'Legacy', value: '$local:legacy', type: 'legacy-code' },
    ],
  },
});

type TRow = {
  label?: string;
  badge?: unknown;
  value?: string;
  metadata?: Record<string, unknown>;
  items?: TRow[];
};

const leaves = (rows: TRow[] | undefined): TRow[] =>
  (rows ?? []).flatMap((row) => (Array.isArray(row.items) ? leaves(row.items) : [row]));

/** The template of a list (`buildTemplates` lists them by name). */
const leaf = (rows: TRow[] | undefined, label: string): TRow | undefined =>
  leaves(rows).find((row) => row.label === label);

const NAMES = {
  Count: 'Whole number',
  Note: 'Text',
  Total: 'Exact number',
  Status: 'qoretechnologies/status',
  Legacy: 'Unknown type',
};

describe("a template's type", () => {
  it('is a typed member of the template, with its base type', () => {
    const count = leaf(ORDER?.items as TRow[], 'Count');
    const total = leaf(ORDER?.items as TRow[], 'Total');
    expect(templateType(count as never)).toBe('int');
    expect(templateType(total as never)).toBe('qoretechnologies/money');
    expect(templateBaseType(total as never)).toBe('number');
    expect(templateBaseType(count as never)).toBeUndefined();
  });

  it('is read with the lookups the package exports', () => {
    expect(reqraft.templateType).toBe(templateType);
    expect(reqraft.templateBaseType).toBe(templateBaseType);
  });

  it("is a host's template's badge where the host gives no typed member", () => {
    expect(templateType({ label: 'pos', value: '$record:{pos}', badge: 'int' } as never)).toBe('int');
  });

  it('is named in the list a click opens, and stays the type the field reads', () => {
    const rows = leaves(styleTemplateItems(ORDER?.items as never) as TRow[]);
    expect(Object.fromEntries(rows.map((row) => [row.label, row.badge]))).toEqual(NAMES);
    expect(Object.fromEntries(rows.map((row) => [row.label, templateType(row as never)]))).toEqual({
      Count: 'int',
      Note: 'string',
      Total: 'qoretechnologies/money',
      Status: 'qoretechnologies/status',
      Legacy: 'legacy-code',
    });
  });

  it("is named for a host's template that keeps it in its badge", () => {
    const [row] = styleTemplateItems([
      { label: 'pos', value: '$record:{pos}', badge: 'int' },
    ] as never) as TRow[];
    expect(row.badge).toBe('Whole number');
    expect(templateType(row as never)).toBe('int');
  });

  it('is named by the catalogue a list is given', () => {
    const count = leaf(
      styleTemplateItems(ORDER?.items as never, (type) => `${type} in other words`) as TRow[],
      'Count'
    );
    expect(count?.badge).toBe('int in other words');
  });

  it('is named in the detail of the list a $ opens', () => {
    expect(
      Object.fromEntries(templateCompletionItems(ORDER).map((item) => [item.label, item.detail]))
    ).toEqual(
      Object.fromEntries(Object.entries(NAMES).map(([label, name]) => [label, `Order · ${name}`]))
    );
  });

  it('is named in the list of the text editor', () => {
    const { result } = renderHook(() => useTemplateTags(ORDER, true));
    const rows = leaves(result.current?.templates?.items as TRow[]);
    expect(Object.fromEntries(rows.map((row) => [row.label, row.badge]))).toEqual(NAMES);
  });

  it('is what a value written as one template alone is, from a list drawn with the names', () => {
    const drawn = { items: styleTemplateItems(ORDER?.items as never) };
    expect(templateTextValue('$local:count', 'any', drawn as never)).toEqual({
      value: '$local:count',
      type: 'int',
    });
  });

  it("is no group's: a group keeps its badge, which names its app", () => {
    // a group of the catalogue (`buildTemplates`) is badged with the app it comes from, and has no value
    const groups = buildTemplates({
      _context: {
        display_name: 'Context Data',
        app: 'Qorus',
        items: [{ display_name: 'Count', value: '$local:count', type: 'int' }],
      },
    });
    const [group] = styleTemplateItems(groups?.items as never) as TRow[];
    expect(group.badge).toBe('Qorus');
    expect(templateType(group as never)).toBeUndefined();
    // also when none of its templates fit a field, and it is drawn with no members
    const [emptied] = styleTemplateItems(
      filterTemplatesByType(groups, 'bool', false, defaultQorusTypes).items as never
    ) as TRow[];
    expect(emptied.label).toBe('Context Data');
    expect(emptied.badge).toBe('Qorus');
  });

  it('decides which templates fit a field, from a list drawn with the names', () => {
    const drawn = { items: styleTemplateItems(ORDER?.items as never) };
    const offered = filterTemplatesByType(drawn as never, 'number', false, defaultQorusTypes)
      .items?.[0]?.items?.map((item) => item.label);
    expect(offered).toEqual(['Count', 'Total']);
  });
});
