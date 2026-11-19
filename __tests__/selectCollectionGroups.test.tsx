import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormEngine, IOptionsSchema } from '../src/components/form/engine/FormEngine';
import { getSelectCollectionGroups } from '../src/components/form/fields/select/SelectCollection';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * A select's choices in groups (as in the IDE's assertion-kind picker): the field says how its groups are
 * drawn (`allowed_values_groups`), the engine hands that to the picker, and the picker to Reqore's collection: the
 * groups' order, their headings, and which start folded. A folded group opens while a search runs, so a match in it
 * is shown.
 */

describe('getSelectCollectionGroups', () => {
  it("says a group's place as the collection's order and a folded group as a folding one", () => {
    expect(
      getSelectCollectionGroups(
        {
          'Most used': { sort: -1, label: 'Most used', icon: 'StarLine' },
          Values: {},
          Coverage: { sort: 10, collapsed: true },
        },
        false
      )
    ).toEqual({
      'Most used': { order: -1, label: 'Most used', icon: 'StarLine' },
      Values: {},
      Coverage: { order: 10, collapsible: true, isCollapsed: true },
    });
  });

  it('opens a folded group while a search runs', () => {
    expect(getSelectCollectionGroups({ Coverage: { collapsed: true } }, true)).toEqual({
      Coverage: { collapsible: true, isCollapsed: false },
    });
  });

  it('leaves a select without group settings without them', () => {
    expect(getSelectCollectionGroups(undefined, true)).toBeUndefined();
  });
});

const KIND = {
  type: 'string',
  display_name: 'Kind',
  required: true,
  preselected: true,
  allowed_values: [
    { display_name: 'Equals', value: { type: 'string', value: 'equals' }, groups: ['Most used'] },
    { display_name: 'Contains', value: { type: 'string', value: 'contains' }, groups: ['Values'] },
    { display_name: 'Matches', value: { type: 'string', value: 'matches' }, groups: ['Values'] },
    {
      display_name: 'Process coverage',
      short_desc: 'The process ran code',
      value: { type: 'string', value: 'process_coverage' },
      groups: ['Whole-run coverage'],
    },
  ],
  allowed_values_groups: {
    'Most used': { sort: -1 },
    'Whole-run coverage': { sort: 10, collapsed: true },
  },
} as unknown as IOptionsSchema[string];

const groupHeadings = () =>
  [...document.querySelectorAll<HTMLElement>('.reqraft-select-dialog .reqore-collection-group')].map(
    (group) => group.querySelector('.reqore-panel-title')?.textContent?.trim()
  );

const rowNamed = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('.reqraft-select-dialog .reqore-collection-item')].find(
    (row) => row.querySelector('.reqore-panel-title')?.textContent?.includes(name)
  );

describe('a field whose values are listed in groups', () => {
  it('draws its folded group folded, and a search shows a match inside it', async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine name='step' value={{}} options={{ kind: KIND }} forceDropdown={false} />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    const trigger = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('[aria-haspopup="dialog"]');
      expect(found, 'the picker opens the full list').toBeTruthy();
      return found as HTMLElement;
    });

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(groupHeadings()).toEqual(
        expect.arrayContaining(['Most used', 'Values', 'Whole-run coverage'])
      );
      expect(rowNamed('Equals')).toBeTruthy();
    });
    // folded: its heading is there and its value is not
    expect(rowNamed('Process coverage')).toBeUndefined();

    const search = document.querySelector<HTMLInputElement>('.reqraft-select-dialog input')!;
    fireEvent.change(search, { target: { value: 'process' } });

    await waitFor(() => expect(rowNamed('Process coverage')).toBeTruthy(), { timeout: 3000 });

    fireEvent.change(search, { target: { value: '' } });

    // the search cleared, the group folds again
    await waitFor(() => expect(rowNamed('Process coverage')).toBeUndefined(), { timeout: 3000 });
  });
});
