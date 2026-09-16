// Copyright 2026 Qore Technologies, s.r.o.
// Inside a form ROW, the way out of template mode is published too.
//
// A field in a compact row draws no menu of its own — it publishes its items
// into the row's ⋮ (`rowMenuContext`) and renders nothing. "Use Custom Value"
// was added to the menu the field draws for itself and not to the list it
// publishes, so on the surface where most options are actually edited,
// template mode stayed a one-way door.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RowMenuContext } from '../src/components/form/engine/rowMenuContext';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

const TEMPLATES = { items: [{ label: 'A name', badge: 'string', value: '$local:name' }] };

/** The row side of the channel: whatever the editor inside it published. */
const published: Record<string, IReqoreDropdownItem[]> = {};

const registry = {
  registerRowMenuItems: (id: string, _key: string, items: IReqoreDropdownItem[]) => {
    published[id] = items;
  },
  unregisterRowMenuItems: (id: string) => {
    delete published[id];
  },
};

const labels = () =>
  Object.values(published)
    .flat()
    .map((item) => String((item as { label?: unknown }).label ?? ''));

const fieldInARow = (props: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext as never}>
        <RowMenuContext.Provider value={registry}>
          <TemplateField
            name='subject'
            type={'any' as never}
            allowTemplates
            allowCustomValues
            templates={TEMPLATES as never}
            onChange={vi.fn()}
            {...(props as never)}
          />
        </RowMenuContext.Provider>
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

beforeEach(() => {
  Object.keys(published).forEach((id) => delete published[id]);
});

describe("what a field publishes into its row's menu", () => {
  it('offers the way out while the field is on a template', async () => {
    fieldInARow({ value: '$local:name' });

    await waitFor(() => expect(labels()).toContain('Use Custom Value'));
    // The way IN is not offered at the same time — the field is already there.
    expect(labels()).not.toContain('Use Template');
  });

  it('offers the way in while the field holds a typed value', async () => {
    fieldInARow({ value: 'already typed' });

    await waitFor(() => expect(labels()).toContain('Use Template'));
    expect(labels()).not.toContain('Use Custom Value');
  });

  it('draws no menu of its own either way', async () => {
    const { container } = fieldInARow({ value: '$local:name' });

    await waitFor(() => expect(labels()).toContain('Use Custom Value'));
    // One menu per control: the row already draws a ⋮.
    expect(container.querySelector('.template-more')).toBeNull();
  });
});
