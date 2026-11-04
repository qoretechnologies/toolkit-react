// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplatePicker } from '../src/components/form/fields/template/TemplatePicker';
import { dpqlCompletionsWith } from '../src/components/dpqlEditor/dpqlCompletions';
import { templateSearchItems } from '../src/components/smartEditor/templateCompletions';
import {
  catalogueContextNode,
  ITemplateCatalogueContext,
  withTemplateCatalogue,
} from '../src/helpers/templateCatalogue';
import { ITemplateNode, referenceNamesNothing, templateTree } from '../src/helpers/templateTree';

/**
 * A row of the template picker does what it shows (David's review of DPQL's Template contexts: "if there are no
 * choices in the submenu, then it should not be presented as a submenu, and there should be no 'Use' control; it
 * should be presented as '$fsminput:*', and clicking gets the value"). A context with nothing to drill into is
 * taken whole, where Qorus reads it whole (`use_whole` and `whole_template` in its catalogue).
 */

const context = (
  name: string,
  more: Partial<ITemplateCatalogueContext> = {}
): ITemplateCatalogueContext =>
  ({ name, display_name: name, kind: 'container', needs_arg: true, ...more }) as never;

const WHOLE = { use_whole: true, whole_template: '$fsminput:*', free_form_keys: true };
const FSMINPUT = context('fsminput', WHOLE);
const LOCAL = context('local', {
  use_whole: true,
  whole_template: '$local:*',
  keys: [{ name: 'id', path: 'id', template: '$local:id' }],
} as never);
const REST = context('rest', { kind: 'formatted', arg_format: '<URI path>' } as never);
// a context of a fixed set of keys, none of them here: Qorus does not read it whole
const FOR = context('for', { kind: 'values' } as never);

const CATALOGUE = { contexts: [FSMINPUT, LOCAL, REST, FOR] } as never;
const rootsOfCatalogue = (wholeRecords?: boolean) =>
  withTemplateCatalogue([], CATALOGUE, wholeRecords);

const renderPicker = (roots: ITemplateNode[], levelId?: string) => {
  const onPick = vi.fn();
  const { container } = render(
    <ReqoreUIProvider>
      <TemplatePicker id='picker' roots={roots} levelId={levelId} onPick={onPick} />
    </ReqoreUIProvider>
  );
  const row = (label: string) =>
    container.querySelector<HTMLElement>(`.template-picker-row[data-label="${label}"]`);
  return { container, onPick, row };
};

// a row's own icon, and past it the arrow of a submenu
const hasArrow = (row: HTMLElement) =>
  row.querySelectorAll(':scope > .reqore-icon, :scope > * > .reqore-icon').length > 1;

describe('a template context with nothing to drill into', () => {
  it('that Qorus reads whole is its whole value: no submenu, no key, no Use', () => {
    const node = catalogueContextNode(FSMINPUT);
    expect(node).toMatchObject({
      label: '$fsminput:*',
      value: '$fsminput:*',
      reference: '$fsminput:',
    });
    expect(node.continues).toBeFalsy();
    expect(node.writesKey).toBeFalsy();
    expect(node.takesWhole).toBeFalsy();
    expect(node.disabled).toBeFalsy();
  });

  it('that cannot be taken whole for this value is written with its key, never whole', () => {
    const node = catalogueContextNode(FSMINPUT, false);
    expect(node).toMatchObject({ label: '$fsminput:', writesKey: true });
    expect(node.value).toBeUndefined();
  });

  it('that reads an argument is written with its argument: `$rest:*` is not a template', () => {
    const node = catalogueContextNode(REST);
    expect(node).toMatchObject({ label: '$rest:', continues: true });
    expect(node.value).toBeUndefined();
    expect(node.disabled).toBeFalsy();
  });

  it('of a fixed set of keys, none of them here, cannot be taken and says so by being disabled', () => {
    const node = catalogueContextNode(FOR);
    expect(node.disabled).toBe(true);
    expect(node.value).toBeUndefined();
    expect(node.continues).toBeFalsy();
  });

  it('with keys keeps its submenu and its Use', () => {
    const node = catalogueContextNode(LOCAL);
    expect(node).toMatchObject({ label: '$local:', value: '$local:*', takesWhole: true });
    expect(node.children).toHaveLength(1);
  });
});

describe('the template picker', () => {
  it('draws such a context as a plain row, and a click takes its value', () => {
    const { container, onPick, row } = renderPicker(rootsOfCatalogue(), 'contexts');
    const fsminput = row('$fsminput:*')!;
    expect(fsminput).toBeTruthy();
    expect(row('$fsminput:')).toBeNull();
    expect(hasArrow(fsminput)).toBe(false);
    expect(fsminput.classList.contains('template-picker-group')).toBe(false);
    expect(fsminput.parentElement!.querySelector('.template-picker-use')).toBeNull();

    fireEvent.click(fsminput);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].value).toBe('$fsminput:*');
    expect(onPick.mock.calls[0][1]).toBeUndefined();
    // no box asks for a key
    expect(container.querySelector('.template-picker-key')).toBeNull();
  });

  it('opens a context with children, with no pick', () => {
    const { onPick, row } = renderPicker(rootsOfCatalogue(), 'contexts');
    const local = row('$local:')!;
    expect(hasArrow(local)).toBe(true);
    expect(local.parentElement!.querySelector('.template-picker-use')).toBeTruthy();

    fireEvent.click(local);

    expect(onPick).not.toHaveBeenCalled();
    expect(row('$local:')).toBeNull();
    expect(row('id')).toBeTruthy();
  });

  it('gives a context that reads an argument no arrow: there is no submenu', () => {
    const { onPick, row } = renderPicker(rootsOfCatalogue(), 'contexts');
    const rest = row('$rest:')!;
    expect(hasArrow(rest)).toBe(false);
    fireEvent.click(rest);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].reference).toBe('$rest:');
  });

  it('draws a row that nothing can be done with as disabled, and a click does nothing', () => {
    const { onPick, row } = renderPicker(rootsOfCatalogue(), 'contexts');
    const forContext = row('$for:')!;
    expect(
      forContext.hasAttribute('disabled') || forContext.getAttribute('aria-disabled') === 'true'
    ).toBe(true);
    fireEvent.click(forContext);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('disables a catalogue row with no value and no members', () => {
    const { onPick, row } = renderPicker(
      templateTree({ items: [{ label: 'Nothing', items: [] }] } as never)
    );
    const nothing = row('Nothing')!;
    expect(hasArrow(nothing)).toBe(false);
    expect(
      nothing.hasAttribute('disabled') || nothing.getAttribute('aria-disabled') === 'true'
    ).toBe(true);
    fireEvent.click(nothing);
    expect(onPick).not.toHaveBeenCalled();
  });

  const lazy = (value?: string): ITemplateNode[] => [
    {
      id: 'lazy',
      label: 'Lazy',
      kind: 'group',
      trail: [],
      trailIds: [],
      ...(value ? { value } : {}),
      loadChildren: async () => [],
    },
  ];

  it('takes the value of a group whose members come empty, not an empty level', async () => {
    const { onPick, row } = renderPicker(lazy('$data:{lazy}'));
    await act(async () => {
      fireEvent.click(row('Lazy')!);
    });
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick.mock.calls[0][0].value).toBe('$data:{lazy}');
  });

  it('goes back from a group whose members come empty and that has no value, and disables it', async () => {
    const { container, onPick, row } = renderPicker(lazy());
    await act(async () => {
      fireEvent.click(row('Lazy')!);
    });
    await waitFor(() => expect(container.querySelector('.template-picker-empty')).toBeNull());
    const again = row('Lazy')!;
    expect(hasArrow(again)).toBe(false);
    expect(again.hasAttribute('disabled') || again.getAttribute('aria-disabled') === 'true').toBe(
      true
    );
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('typed completion of such a context', () => {
  /* Typing goes on from it, so no accepted row is a dead end: the row writes `$fsminput:`, its key is typed next and
     the list says so, and Use takes it whole (David's reviews, qorus#646: `$dyn`, Tab, `order.id`). */
  it('is written on from, and taken whole with Use', () => {
    const [row] = templateSearchItems(rootsOfCatalogue(), '$fsm', undefined, true);
    expect(row).toMatchObject({ label: '$fsminput:', insertText: '$fsminput:' });
    expect(row.data).toMatchObject({
      continues: true,
      takesWhole: true,
      wholeValue: '$fsminput:*',
    });
  });

  it('is listed once, the whole of it first once its `:` is written', () => {
    const rows = templateSearchItems(rootsOfCatalogue(), '$fsminput:', undefined, true);
    expect(rows.map((row) => row.label)).toEqual(['$fsminput:*']);
    expect(templateSearchItems(rootsOfCatalogue(), '$fsm', undefined, true)).toHaveLength(1);
  });

  it('still reads a key written after it as a reference: its keys are free, taken whole or not', () => {
    expect(referenceNamesNothing(rootsOfCatalogue(), '$fsminput:order.id')).toBe(false);
  });

  it('never offers a context that cannot be taken', () => {
    expect(templateSearchItems(rootsOfCatalogue(), '$fo', undefined, true)).toEqual([]);
  });

  it("lists it once in DPQL, in place of the server's row for the context", () => {
    const server = [{ label: '$fsminput:', kind: 6, insertText: '$fsminput:' }];
    const rows = dpqlCompletionsWith(rootsOfCatalogue())({
      plainText: '$fsm',
      offset: 4,
      serverItems: server,
    } as never);
    expect(rows.filter((row) => /fsminput/.test(row.label)).map((row) => row.label)).toEqual([
      '$fsminput:',
    ]);
  });
});
