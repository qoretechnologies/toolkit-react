import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * An edit made in a renderer-only editor is stored as the field's STORAGE type.
 *
 * A field reports back the type it was drawn as, and for a renderer-only editor
 * (markdown, cron, dpql, or one the host declares) that is the editor's name.
 * The engine stored it: a description edited in the markdown editor was sent as
 * `{type: "markdown", value: "..."}`, which the server decodes by type - as YAML
 * - so "Callers: operators" became a hash and the save was refused. Every
 * interface description is drawn in the markdown editor, so any description
 * with a colon, a leading dash or a bare number could not be saved.
 *
 * A type the editor names that is NOT renderer-only is a real choice, such as
 * the type picked for an untyped field, and must still be stored.
 */
const editIn = async ({
  schema,
  emit,
  rendererOnlyUiTypes,
}: {
  schema: Record<string, unknown>;
  emit: (onChange: (val: unknown, type?: string) => void) => void;
  rendererOnlyUiTypes?: string[];
}) => {
  const onChange = vi.fn();
  const name = Object.keys(schema)[0];
  const uiType = (schema[name] as { ui_type: string }).ui_type;
  const Host = (props: { onChange: (val: unknown, type?: string) => void }) => {
    useEffect(() => {
      emit(props.onChange);
    }, []);
    return <div>host editor</div>;
  };

  const { container } = render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          name='test'
          value={{} as never}
          options={schema as never}
          onChange={onChange}
          componentOverrides={{ [uiType]: Host }}
          rendererOnlyUiTypes={rendererOnlyUiTypes as never}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  await act(async () => {});
  expect(container.textContent).toContain('host editor');
  await waitFor(() =>
    expect(onChange.mock.calls.some(([, value]) => value?.[name]?.value !== undefined)).toBe(true)
  );
  const [, value] = onChange.mock.calls.filter(([, value]) => value?.[name]?.value !== undefined).at(-1);
  return value[name];
};

describe('an edit made in a renderer-only editor', () => {
  it('stores a markdown description as a string', async () => {
    const desc = await editIn({
      schema: { desc: { type: 'string', ui_type: 'markdown', display_name: 'Description', preselected: true } },
      emit: (onChange) => onChange('Callers: operators of the finance close'),
    });

    expect(desc).toEqual({ type: 'string', value: 'Callers: operators of the finance close' });
  });

  it('stores the storage type even when the editor names its own type', async () => {
    const desc = await editIn({
      schema: { desc: { type: 'string', ui_type: 'markdown', display_name: 'Description', preselected: true } },
      emit: (onChange) => onChange('- first point', 'markdown'),
    });

    expect(desc.type).toBe('string');
  });

  it('stores the storage type for an editor the host declares renderer-only', async () => {
    const window = await editIn({
      schema: { window: { type: 'string', ui_type: 'maintenance-window', display_name: 'Window', preselected: true } },
      rendererOnlyUiTypes: ['maintenance-window'],
      emit: (onChange) => onChange('sat: 02:00-04:00'),
    });

    expect(window).toEqual({ type: 'string', value: 'sat: 02:00-04:00' });
  });

  it('still stores a type the editor names that is a real choice', async () => {
    const limit = await editIn({
      schema: { limit: { type: 'auto', ui_type: 'limit-editor', display_name: 'Limit', preselected: true } },
      rendererOnlyUiTypes: ['limit-editor'],
      emit: (onChange) => onChange(5, 'int'),
    });

    expect(limit).toEqual({ type: 'int', value: 5 });
  });
});
