// Copyright 2026 Qore Technologies, s.r.o.
// A field that takes only an expression shows its way in, inside a form row too.
//
// No value typed in, no template: an expression is the only input such a field
// takes, and "Create New Expression" is its editor. In a form ROW the field's
// controls give way to the row's ⋮, and this one went with them, so the row
// read "Required · add a value" over nothing to add it with.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RowMenuContext } from '../src/components/form/engine/rowMenuContext';
import { TemplateField } from '../src/components/form/fields/template/TemplateField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const published: Record<string, IReqoreDropdownItem[]> = {};
const registry = {
  registerRowMenuItems: (id: string, _key: string, items: IReqoreDropdownItem[]) => {
    published[id] = items;
  },
  unregisterRowMenuItems: (id: string) => {
    delete published[id];
  },
};

describe('a field that takes only an expression, in a form row', () => {
  it('draws its way in, and the row menu does not offer it again', async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <RowMenuContext.Provider value={registry}>
            <TemplateField
              name='enabled'
              type={'bool' as never}
              allowFunctions
              allowCustomValues={false}
              allowTemplates={false}
              expressions={[] as never}
              onChange={vi.fn()}
            />
          </RowMenuContext.Provider>
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(container.querySelectorAll('.function-selector')).toHaveLength(1));
    expect(screen.queryAllByText('Create New Expression').length).toBeGreaterThan(0);
    const labels = Object.values(published)
      .flat()
      .map((item) => String((item as { label?: unknown }).label ?? ''));
    expect(labels).not.toContain('Use Expression');
  });
});
