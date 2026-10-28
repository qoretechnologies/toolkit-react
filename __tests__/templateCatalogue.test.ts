// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A field's template catalogue, as Qorus gives it, is the "Template contexts" group of its templates (qorus#646,
 * David's review, round 4): every container is used whole (`$ctx:*`) where Qorus reads it whole, a context lists
 * its keys, nested, a context left out by the catalogue is never offered, and typing offers what the picker does.
 */
import { describe, expect, it } from 'vitest';
import { templateSearchItems } from '../src/components/smartEditor/templateCompletions';
import { withTemplateCatalogue } from '../src/helpers/templateCatalogue';
import {
  referenceNamesNothing,
  TEMPLATE_CONTEXTS_LABEL,
  templateTree,
} from '../src/helpers/templateTree';
import { templateCatalogueFixture } from '../src/stories/templateCatalogueMock';

const rootsOf = (fixture: Parameters<typeof templateCatalogueFixture>[0], wholeRecords = true) =>
  withTemplateCatalogue([], templateCatalogueFixture(fixture), wholeRecords);
const contextsOf = (fixture: Parameters<typeof templateCatalogueFixture>[0], wholeRecords = true) =>
  rootsOf(fixture, wholeRecords).find((node) => node.label === TEMPLATE_CONTEXTS_LABEL)!.children!;
const contextNamed = (fixture: Parameters<typeof templateCatalogueFixture>[0], name: string) =>
  contextsOf(fixture).find((node) => node.reference === name);
const labels = (rows: Array<{ label: string }>) => rows.map((row) => row.label);

describe('a field with a template catalogue', () => {
  it('offers exactly the contexts of its catalogue, in its order', () => {
    expect(contextsOf('qog-unhosted').map((node) => node.reference)).toEqual([
      '$local:',
      '$fsminput:',
      '$transient:',
      '$var:',
      '$env:',
      '$timestamp:',
      '$rest:',
      '$qore-expr:',
      '$python-expr:',
      '$parse-value:',
    ]);
    // a sandboxed user's: none that the sandbox blocks
    expect(contextsOf('generic-sandboxed').map((node) => node.reference)).toEqual([
      '$timestamp:',
      '$qore-expr:',
      '$parse-value:',
    ]);
  });

  it('uses a container whole as `$ctx:*` where Qorus reads it whole, and never where it cannot', () => {
    expect(contextNamed('qog-loops', '$data:')).toMatchObject({ value: '$data:*', takesWhole: true });
    expect(contextNamed('qog-loops', '$foreach:')).toMatchObject({ value: '$foreach:*', takesWhole: true });
    // `$for:` has only its value, `$keys:*` reads nothing, `$timestamp:` is a set of values
    expect(contextNamed('qog-loops', '$for:')?.takesWhole).toBeFalsy();
    expect(contextNamed('workflow-typed-static', '$keys:')?.takesWhole).toBeFalsy();
    expect(contextNamed('qog-loops', '$timestamp:')?.takesWhole).toBeFalsy();
    // a value that takes no record is offered no context whole
    const scalar = rootsOf('qog-loops', false)[0].children!.find((node) => node.reference === '$data:');
    expect(scalar?.takesWhole).toBeFalsy();
  });

  it('lists a context\'s keys, nested, each a key that holds keys used whole too', () => {
    const data = contextNamed('qog-loops', '$data:')!;
    const start = data.children![0];
    expect(start).toMatchObject({ label: 'Start', value: '$data:s1', takesWhole: true });
    expect(start.children!.map((node) => node.value)).toEqual(['$data:s1.id', '$data:s1.customer']);
    expect(start.children![1].children!.map((node) => node.value)).toEqual(['$data:s1.customer.name']);
  });

  it("names Qore's `auto` as any type, never as an unknown one", () => {
    expect(contextNamed('qog-loops', '$fsminput:')?.type).toBe('any');
    expect(contextNamed('qog-loops', '$local:')!.children!.find((key) => key.label === 'input')?.type).toBe('any');
  });

  it('goes on into a context of free keys, or of an argument of its own format, that lists no key', () => {
    expect(contextNamed('workflow-untyped-static', '$dynamic:')).toMatchObject({
      continues: true,
      writesKey: true,
      value: '$dynamic:*',
      takesWhole: true,
    });
    expect(contextNamed('qog-loops', '$rest:')).toMatchObject({ continues: true });
    expect(contextNamed('qog-loops', '$rest:')?.value).toBeUndefined();
  });

  it('types as it is picked: `$` its contexts, `$ctx:` the whole of it first and then its keys', () => {
    const roots = rootsOf('qog-loops');
    expect(labels(templateSearchItems(roots, '$tr', undefined, true))).toEqual(['$transient:']);
    expect(labels(templateSearchItems(roots, '$transient:', undefined, true))).toEqual([
      '$transient:*',
      'total',
    ]);
    expect(labels(templateSearchItems(roots, '$data:s1.', undefined, true))).toEqual(['ID', 'Customer']);
    // a context of free keys lists none: its key is written (the list says so), and it is used whole
    const untyped = rootsOf('workflow-untyped-static');
    expect(labels(templateSearchItems(untyped, '$dynamic:', undefined, true))).toEqual(['$dynamic:*']);
    const row = templateSearchItems(untyped, '$dyn', undefined, true)[0];
    expect(row.data).toMatchObject({ continues: true, takesWhole: true, wholeValue: '$dynamic:*' });
    // what the catalogue leaves out is never offered
    expect(labels(templateSearchItems(rootsOf('qog-unhosted'), '$fo', undefined, true))).toEqual([]);
  });

  it('says a reference names nothing only in a context whose every key it lists', () => {
    const roots = rootsOf('qog-loops');
    expect(referenceNamesNothing(roots, '$transient:totl')).toBe(true);
    expect(referenceNamesNothing(roots, '$transient:total')).toBe(false);
    // keys written freely: any key may be there when it runs
    expect(referenceNamesNothing(roots, '$local:anything')).toBe(false);
  });

  it("keeps the field's own templates beside its contexts, and one row for a reference both list", () => {
    const own = templateTree({
      items: [{ label: 'Context Data', items: [{ label: 'Interface name', value: '$local:name' }] }],
    } as never, { keepLoneGroup: true });
    const roots = withTemplateCatalogue(own, templateCatalogueFixture('qog-loops'), true);
    expect(roots.map((node) => node.label)).toEqual(['Context Data', TEMPLATE_CONTEXTS_LABEL]);
    const rows = templateSearchItems(roots, '$local:', undefined, true);
    expect(rows.filter((row) => row.insertText === '$local:name')).toHaveLength(1);
  });
});
