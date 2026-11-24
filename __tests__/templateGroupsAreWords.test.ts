// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import {
  COMPLETION_ITEM_STYLE,
  styleTemplateItems,
} from '../src/components/smartEditor/completionStyle';

/*
 * The list a field's templates are browsed in drew every row in the code font, so a group's name and what it says
 * ("Context data", "Data from the current execution context") read as code. A template is drawn as what it writes,
 * in the code font; a group is words.
 */
type TRow = { label?: string; value?: string; style?: React.CSSProperties; items?: TRow[] };

const GROUP: TRow = {
  label: 'Context data',
  items: [{ label: 'Customer name', value: '$local:{customer_name}' }],
} as TRow;

describe("the templates list's groups", () => {
  it('draw a group in the body font', () => {
    const [group] = styleTemplateItems([GROUP] as never) as TRow[];
    expect(group.style?.fontFamily).toBeUndefined();
  });

  it('keep the code font for a template, inside a group too', () => {
    const [group] = styleTemplateItems([GROUP] as never) as TRow[];
    expect(group.items?.[0].style?.fontFamily).toBe(COMPLETION_ITEM_STYLE.fontFamily);
  });

  it("keep a group's own style", () => {
    const [group] = styleTemplateItems([{ ...GROUP, style: { opacity: 0.8 } }] as never) as TRow[];
    expect(group.style).toEqual({ opacity: 0.8 });
  });
});
