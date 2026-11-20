// Copyright 2026 Qore Technologies, s.r.o.
/*
 * A field's own words for its way into its templates (as the IDE's test value field's: "Pick a captured
 * value"). The page's words (`setReqraftLabels`) are one for every field, so a field that picks something else says
 * it on its schema (`template_label`, `template_tooltip`): on its Template tab, and on its "Use template" where it has
 * no tabs. The page's words where it says nothing.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { RowMenuContext } from '../src/components/form/engine/rowMenuContext';
import {
  ITemplateFieldProps,
  TemplateField,
} from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

const TEMPLATES = {
  items: [
    {
      label: 'Captured by the run',
      items: [{ label: 'order_id', value: '$local:order_id', badge: 'date' }],
    },
  ],
};

const PICK = 'Pick a captured value';

const published: Record<string, IReqoreDropdownItem[]> = {};
const registry = {
  registerRowMenuItems: (id: string, _key: string, items: IReqoreDropdownItem[]) => {
    published[id] = items;
  },
  unregisterRowMenuItems: (id: string) => {
    delete published[id];
  },
};
const menuItems = () => Object.values(published).flat() as { label?: string; tooltip?: string }[];

const drawn = (element: JSX.Element) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <RowMenuContext.Provider value={registry}>{element}</RowMenuContext.Provider>
      </FetchContext.Provider>
    </ReqoreUIProvider>
  ).container;

const field = (props: Partial<ITemplateFieldProps>) => (
  <TemplateField
    name='value'
    type={'date' as never}
    value='2026-10-22T00:00:00Z'
    allowTemplates
    allowCustomValues
    componentFromType
    templates={TEMPLATES as never}
    filterTemplatesByType={false}
    onChange={vi.fn()}
    {...props}
  />
);

const templateTab = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.value-tab[data-tab="template"]');

beforeEach(() => {
  for (const key of Object.keys(published)) delete published[key];
});

describe("a field's way into its templates", () => {
  it('is its Template tab, named in its own words', async () => {
    const container = drawn(field({ valueTabs: true, templateLabel: PICK }));
    await waitFor(() => expect(templateTab(container)?.textContent).toContain(PICK));
    expect(templateTab(container)?.textContent).not.toContain('Template');
  });

  it("is its Use template, in its own words and with its own hover, where it has no tabs", async () => {
    drawn(field({ templateLabel: PICK, templateTooltip: 'Use a value the run captured' }));
    await waitFor(() =>
      expect(menuItems().find((item) => item.label === PICK)?.tooltip).toBe(
        'Use a value the run captured'
      )
    );
    expect(menuItems().some((item) => item.label === 'Use template')).toBe(false);
  });

  it("keeps the page's words where the field says nothing", async () => {
    const container = drawn(field({ valueTabs: true }));
    await waitFor(() => expect(templateTab(container)?.textContent).toContain('Template'));
  });

  it("comes from the field's schema in a form", async () => {
    const container = drawn(
      <FormEngine
        name='step'
        value={{}}
        allowTemplates
        stringTemplates={TEMPLATES as never}
        options={{
          when: {
            type: 'date',
            display_name: 'When',
            required: true,
            preselected: true,
            supports_templates: true,
            template_label: PICK,
          },
        }}
      />
    );
    await waitFor(() => expect(templateTab(container)?.textContent).toContain(PICK), {
      timeout: 5000,
    });
  });
});
