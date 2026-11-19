import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  objectDataFromRows,
  objectRowsFromData,
  ReqraftObjectFormField,
} from '../src/components/form/fields/object/Object';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * An object field's values are rows (queue item 32, decision 027): a name and a typed value each, or a value each
 * for a list, and a record or a list in a value is rows of its own. The field's value in and out stays what it was
 * (YAML, JSON or the data itself), so every host keeps its contract.
 */

describe('rows from data, and back', () => {
  it('makes a row of each key: its name and its typed value', () => {
    expect(objectRowsFromData({ region: 'eu', retries: 3, limits: { daily: 100 } }, 'object')).toEqual([
      { name: { type: 'string', value: 'region' }, value: { type: 'string', value: 'eu' } },
      { name: { type: 'string', value: 'retries' }, value: { type: 'int', value: 3 } },
      {
        name: { type: 'string', value: 'limits' },
        value: { type: 'hash', value: { daily: { type: 'int', value: 100 } } },
      },
    ]);
  });

  it("makes a row of each of a list's items, with no name", () => {
    expect(objectRowsFromData(['alpha', true], 'array')).toEqual([
      { value: { type: 'string', value: 'alpha' } },
      { value: { type: 'bool', value: true } },
    ]);
  });

  it('gives the same data back, at every depth', () => {
    const data = { region: 'eu', retries: 3, limits: { daily: 100, burst: [1, 2] }, empty: null };
    expect(objectDataFromRows(objectRowsFromData(data, 'object'), 'object')).toEqual(data);
    expect(objectDataFromRows(objectRowsFromData(['a', { b: 1 }], 'array'), 'array')).toEqual([
      'a',
      { b: 1 },
    ]);
  });

  it('leaves out a row that has no name yet, or a list row with no value yet', () => {
    expect(
      objectDataFromRows(
        [
          { name: { type: 'string', value: '  ' }, value: { type: 'int', value: 1 } },
          { value: { type: 'int', value: 2 } },
          { name: { type: 'string', value: 'kept' } },
        ],
        'object'
      )
    ).toEqual({ kept: null });
    expect(objectDataFromRows([{}, { value: { type: 'int', value: 2 } }], 'array')).toEqual([2]);
  });

  it('reads a row in its `{ type: hash }` envelope as well', () => {
    expect(
      objectDataFromRows(
        [{ type: 'hash', value: { name: { type: 'string', value: 'a' }, value: { type: 'int', value: 1 } } }],
        'object'
      )
    ).toEqual({ a: 1 });
  });
});

const Host = ({ onChange }: { onChange: (value: unknown) => void }) => {
  const [value, setValue] = useState<string | undefined>('region: eu\n');

  return (
    <ReqraftObjectFormField
      type='object'
      dataType='yaml'
      resultDataType='yaml'
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next as string);
      }}
    />
  );
};

describe('the object field', () => {
  it('keeps a row added and not named yet, and gives back only what is a value', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <Host onChange={onChange} />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(container.querySelectorAll('.array-auto-item')).toHaveLength(1));
    fireEvent.click(screen.getAllByText('Add new item for "Values"')[0]);

    // past the rows' own pause: the new row stays, and the value it is not yet is not sent
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(container.querySelectorAll('.array-auto-item')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });
});
