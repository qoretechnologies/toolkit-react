// Copyright 2026 Qore Technologies, s.r.o.
// An auto field's type picker offers no Qore soft type, and a soft type that
// reaches the field anyway is edited as its base type.
//
// The picker chooses the editor for a value typed in by hand. A soft type
// (`softint`, `softstring`, `softlist`, …) only declares that what a variable or
// parameter is given is converted to the base type; for a literal there is
// nothing to convert, and the field has no editor of its own for one — each soft
// entry the picker offered drew "Unknown type!". A soft type still arrives from
// saved data and from declared option types: it keeps its declared type and is
// edited with its base type's editor.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/** What the type picker was last handed: the list it offers is a prop. */
const picker = vi.hoisted(() => ({ props: undefined as Record<string, any> | undefined }));

vi.mock('../src/components/form/fields/select/Select', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/components/form/fields/select/Select')>();
  return {
    ...original,
    SelectFormField: (props: Record<string, any>) => {
      picker.props = props;
      return <div data-type-picker data-value={String(props.value)} />;
    },
  };
});

import {
  AutoFormField,
  editorTypeOf,
  getImmediateValueTypes,
} from '../src/components/form/fields/auto/AutoFormField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const wrap = (node: React.ReactNode) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext}>{node}</FetchContext.Provider>
  </ReqoreUIProvider>
);

const offered = () =>
  (picker.props?.items as { name: string; display_name?: string }[]).map((item) => item.name);

const unknownType = (container: HTMLElement) =>
  (container.textContent || '').includes('Unknown type!');

describe('editorTypeOf', () => {
  it.each([
    ['softint', 'int'],
    ['softstring', 'string'],
    ['softbool', 'bool'],
    ['softfloat', 'float'],
    ['softdate', 'date'],
    ['softlist', 'list'],
    ['softlist<string>', 'list<string>'],
  ])('edits %s as %s', (declared, edited) => {
    expect(editorTypeOf(declared)).toBe(edited);
  });

  it.each(['int', 'string', 'list<string>', 'hash', 'auto', 'any', 'soft'])(
    'leaves %s as it is',
    (type) => {
      expect(editorTypeOf(type)).toBe(type);
    }
  );

  it('passes an absent type through', () => {
    expect(editorTypeOf(undefined)).toBeUndefined();
    expect(editorTypeOf(null)).toBeNull();
  });
});

describe('the type picker of an untyped field', () => {
  it('offers the base types by readable name, and no soft type', async () => {
    picker.props = undefined;
    render(
      wrap(<AutoFormField name='value' defaultType='auto' value='some text' onChange={vi.fn()} />)
    );

    await waitFor(() => expect(picker.props).toBeDefined());
    expect(offered()).toEqual([
      'bool',
      'date',
      'string',
      'binary',
      'float',
      'list',
      'hash',
      'int',
      'rgbcolor',
    ]);
    expect(offered().filter((name) => name.startsWith('soft'))).toEqual([]);
    expect(
      (picker.props?.items as { display_name: string }[]).map((item) => item.display_name)
    ).toEqual([
      'True/False',
      'Date',
      'Text',
      'Binary',
      'Decimal',
      'List',
      'Key/Value {}',
      'Integer',
      'RGB Color',
    ]);
    // The text value resolved to `string`, which the picker shows as chosen.
    expect(picker.props?.value).toBe('string');
  });

  it('offers no soft type even when a caller still passes the deprecated noSoft={false}', async () => {
    picker.props = undefined;
    render(
      wrap(
        <AutoFormField
          name='value'
          defaultType='auto'
          value='some text'
          noSoft={false}
          onChange={vi.fn()}
        />
      )
    );

    await waitFor(() => expect(picker.props).toBeDefined());
    expect(offered()).toEqual(getImmediateValueTypes().map((type) => type.name));
  });

  it('shows no item count: a count on a fixed list of types is noise', async () => {
    picker.props = undefined;
    render(
      wrap(<AutoFormField name='value' defaultType='auto' value='some text' onChange={vi.fn()} />)
    );

    await waitFor(() => expect(picker.props).toBeDefined());
    expect(picker.props?.hideItemCount).toBe(true);
  });

  it("offers a soft type from a caller's allowed types once, as its base type", async () => {
    picker.props = undefined;
    render(
      wrap(
        <AutoFormField
          name='value'
          allowedTypes={[
            { name: 'softint' },
            { name: 'int', display_name: 'Whole number' },
            { name: 'softstring', display_name: 'Some text' },
            { name: 'softlist<string>' },
          ]}
          onChange={vi.fn()}
        />
      )
    );

    await waitFor(() => expect(picker.props).toBeDefined());
    expect(picker.props?.items).toEqual([
      // The first entry for a base type wins; one with no name of its own takes
      // the base type's readable name.
      { name: 'int', display_name: 'Integer' },
      { name: 'string', display_name: 'Some text' },
      { name: 'list<string>', display_name: undefined },
    ]);
  });
});

describe('a soft-typed value', () => {
  it('declared softint is edited with the integer editor and reports softint', async () => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(<AutoFormField name='value' defaultType='softint' value={42} onChange={onChange} />)
    );

    const input = (await waitFor(() => {
      const el = container.querySelector('input');
      expect(el).toBeTruthy();
      return el;
    })) as HTMLInputElement;
    expect(unknownType(container)).toBe(false);
    expect(container.querySelector('textarea')).toBeNull();

    fireEvent.change(input, { target: { value: '43' } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [name, , type] = onChange.mock.calls.at(-1)!;
    expect(name).toBe('value');
    // The declared type is kept: the editor is only how the value is typed in.
    expect(type).toBe('softint');
  });

  it('saved with softint under an untyped field opens the integer editor, chosen as Integer', async () => {
    picker.props = undefined;
    const { container } = render(
      wrap(
        <AutoFormField
          name='value'
          defaultType='auto'
          defaultInternalType='softint'
          value={5}
          onChange={vi.fn()}
        />
      )
    );

    await waitFor(() => expect(container.querySelector('input')).toBeTruthy());
    expect(unknownType(container)).toBe(false);
    expect(picker.props?.value).toBe('int');
  });

  it.each(['softbool', 'softdate', 'softfloat', 'softstring', 'softlist<string>'])(
    'declared %s draws an editor, not "Unknown type!"',
    async (type) => {
      const { container } = render(
        wrap(<AutoFormField name='value' defaultType={type} onChange={vi.fn()} />)
      );

      await waitFor(() => expect(container.querySelector('.auto-field-group')).toBeTruthy());
      expect(unknownType(container)).toBe(false);
    }
  );
});
