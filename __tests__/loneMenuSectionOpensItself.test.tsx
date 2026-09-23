// Copyright 2026 Qore Technologies, s.r.o.
// A ⋮ whose only group is a section opens that section itself.
//
// Two of the menu's groups are collapsed sections, so a menu holding nothing
// but one of them asked for a click to reach the only thing on offer: on an
// untyped field, "Set Custom Value" hiding the data types behind it, with no
// other choice to weigh it against. Where the menu holds more than one group
// the sections stay shut — there the click IS the choice.
//
// The same rule the template list follows for a lone category
// (`templateListOpensLoneCategory`), and the row menu already publishes these
// rows flat.
//
// The rule itself — which group count counts as lone — is asserted in the
// browser by the `Auto - Via Form Engine Menu Opens Its Only Group` story: the
// menu lives in a Reqore popover, which jsdom never opens.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const section = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('@qoretechnologies/reqore', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ReqoreMenuSection: (props: Record<string, any>) => {
    section.props = props;
    return <div>{props.children}</div>;
  },
}));

import { CustomMenuItems } from '../src/components/form/fields/template/TemplateField';

const TYPE_ROWS = [
  { label: 'Text', onClick: vi.fn() },
  { label: 'Number', onClick: vi.fn() },
];

beforeEach(() => {
  section.props = undefined;
});

describe('the "Set Custom Value" section', () => {
  it('is open when it is the menu’s only group', () => {
    render(
      <CustomMenuItems
        items={TYPE_ROWS as never}
        startExpanded
        setIsTemplate={vi.fn()}
        setTemplateValue={vi.fn()}
      />
    );

    expect(section.props?.isCollapsed).toBe(false);
    // Still named, so the rows say what they are.
    expect(section.props?.label).toBe('Set Custom Value');
  });

  it('is shut when the menu offers something else too', () => {
    render(
      <CustomMenuItems
        items={TYPE_ROWS as never}
        setIsTemplate={vi.fn()}
        setTemplateValue={vi.fn()}
      />
    );

    expect(section.props?.isCollapsed).toBe(true);
  });
});
