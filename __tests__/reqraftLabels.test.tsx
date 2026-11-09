// Copyright 2026 Qore Technologies, s.r.o.
/* A host's words reach what Reqraft draws: merged over the English defaults, and again when its language changes. */
import { render, renderHook, screen, act } from '@testing-library/react';
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CONTEXT_DATA_PAYLOAD,
  QOG_STATE_DATA_PAYLOAD,
} from '../src/components/form/fields/template/__fixtures__/qogTemplatePayloads';
import { buildTemplates } from '../src/helpers/templates';
import {
  DEFAULT_REQRAFT_LABELS,
  reqraftLabels,
  setReqraftLabels,
  useReqraftLabels,
} from '../src/helpers/reqraftLabels';
import { templateNodeKindLabel, templateTree, referenceNamesNothingMessage } from '../src/helpers/templateTree';
import { useTemplates, seedTemplatesCache, TemplatesCache } from '../src/hooks/useTemplates';
import { hiddenFieldNoteText } from '../src/components/form/engine/HiddenFieldsNote';
import { formatOptionValue } from '../src/components/form/engine/readFirst';
import { formatCodeLines } from '../src/components/codeSize';
import { useWholeSays } from '../src/components/form/fields/template/TemplatePicker';
import { browseAllTemplatesItem } from '../src/components/smartEditor/templateCompletions';
import { dpqlEmptyCompletionMessage } from '../src/components/dpqlEditor/dpqlCompletions';
import { toDropdownItems } from '../src/components/smartEditor/useLspAutocomplete';
import { describeDependencies } from '../src/components/form/engine/OptionFieldMessages';

const payload = { ...CONTEXT_DATA_PAYLOAD, ...QOG_STATE_DATA_PAYLOAD } as never;

/** Every description in a list of templates, however deep. */
const allDescriptions = (items: unknown[] = []): string =>
  (items as { description?: unknown; items?: unknown[] }[])
    .map((item) => `${item.description ?? ''} ${allDescriptions(item.items)}`)
    .join(' ');

afterEach(() => {
  setReqraftLabels();
  TemplatesCache.clear();
});

describe('the labels', () => {
  it('are the English defaults until a host gives others', () => {
    expect(reqraftLabels()).toEqual(DEFAULT_REQRAFT_LABELS);
    setReqraftLabels({ formEngine: { save: 'Speichern' } });
    expect(reqraftLabels().formEngine.save).toBe('Speichern');
    // the rest stay English, here and in the other parts
    expect(reqraftLabels().formEngine.discard).toBe('Discard');
    expect(reqraftLabels().editor).toEqual(DEFAULT_REQRAFT_LABELS.editor);
  });

  it('merge a map entry by entry', () => {
    setReqraftLabels({ templateTree: { kinds: { field: 'Feld' } } });
    expect(templateNodeKindLabel('field')).toBe('Feld');
    expect(templateNodeKindLabel('variable')).toBe('Variable');
    expect(templateNodeKindLabel('group')).toBeUndefined();
  });

  it('skip a word given as undefined', () => {
    setReqraftLabels({ formEngine: { save: undefined } });
    expect(reqraftLabels().formEngine.save).toBe('Save');
  });

  it('replace what the last call gave, and say so to a component', () => {
    const { result } = renderHook(() => useReqraftLabels().formEngine.save);
    expect(result.current).toBe('Save');
    act(() => setReqraftLabels({ formEngine: { save: 'Speichern' } }));
    expect(result.current).toBe('Speichern');
    act(() => setReqraftLabels({ formEngine: { discard: 'Verwerfen' } }));
    expect(result.current).toBe('Save');
  });

  it('let a component go without leaving a listener', () => {
    const { result, unmount } = renderHook(() => useReqraftLabels());
    const seen = result.current;
    unmount();
    act(() => setReqraftLabels({ formEngine: { save: 'Speichern' } }));
    expect(result.current).toBe(seen);
  });
});

describe('a list of templates', () => {
  const description = (templates?: ReturnType<typeof buildTemplates>) =>
    allDescriptions(templates?.items);

  it('reads in the host’s words; those it is given itself come first', () => {
    setReqraftLabels({ templateList: { exampleValue: (value) => `Beispiel: ${value}` } });
    expect(description(buildTemplates(payload))).toContain('Beispiel:');
    expect(description(buildTemplates(payload, { exampleValue: (value) => `Ex ${value}` }))).toContain('Ex ');
  });

  it('kept between forms is read again when the language changes, without asking the server', () => {
    seedTemplatesCache('generic', payload);
    const { result } = renderHook(() => useTemplates(true, undefined, 'generic'));
    expect(description(result.current.value)).toContain('Example value:');
    act(() => setReqraftLabels({ templateList: { exampleValue: (value) => `Beispiel: ${value}` } }));
    expect(description(result.current.value)).toContain('Beispiel:');
  });
});

describe('the template tree', () => {
  const fields = { order: { type: 'string' } } as never;

  it('names its groups in the host’s words, also after a language change', () => {
    const named = () => templateTree(buildTemplates(payload), { fields }).map((node) => node.label);
    expect(named()).toContain('Record fields');
    setReqraftLabels({ templateTree: { recordFields: 'Datensatzfelder' } });
    expect(named()).toContain('Datensatzfelder');
    setReqraftLabels();
    expect(named()).toContain('Record fields');
  });

  it('says what a reference that names nothing is', () => {
    setReqraftLabels({ templateTree: { referenceNamesNothing: (written) => `Nichts: ${written}` } });
    expect(referenceNamesNothingMessage('$x:')).toBe('Nichts: $x:');
  });

  it('says what the picker’s Use takes', () => {
    setReqraftLabels({ templateBrowser: { useWhole: (label) => `Ganz: ${label}` } });
    expect(useWholeSays('Order')).toBe('Ganz: Order');
  });
});

describe('the editor', () => {
  it('names a completion’s kind in the host’s words', () => {
    const items = () => toDropdownItems([{ label: 'a', kind: 3 } as never]);
    expect(items()[0].kindLabel).toBe('Function');
    setReqraftLabels({ editor: { completionKinds: { 3: 'Funktion' } } });
    expect(items()[0].kindLabel).toBe('Funktion');
  });

  it('offers the way to all templates in the host’s words', () => {
    setReqraftLabels({ editor: { browseAllTemplates: 'Alle Vorlagen' } });
    expect(browseAllTemplatesItem().label).toBe('Alle Vorlagen');
  });

  it('says why nothing is listed in the host’s words', () => {
    setReqraftLabels({ editor: { noTemplates: 'Keine Vorlagen' } });
    expect(dpqlEmptyCompletionMessage('$', 1)).toBe('Keine Vorlagen');
  });
});

describe('a form', () => {
  it('says what a value reads as in the host’s words', () => {
    const format = () => formatOptionValue({ type: 'bool', value: true } as never, { type: 'bool' } as never);
    expect(format()).toBe('Yes');
    setReqraftLabels({ formEngine: { yes: 'Ja' } });
    expect(format()).toBe('Ja');
  });

  it('says why a field is hidden, the English as it was', () => {
    const note = { label: 'A', conditions: 'b is set', invalidReason: 'too long.' } as never;
    expect(hiddenFieldNoteText(note)).toBe(
      '"A" is hidden until it applies (b is set). Its value is kept, but it is not valid: too long.'
    );
    setReqraftLabels({ formEngine: { hiddenUntilItApplies: (label) => `${label} ist versteckt` } });
    expect(hiddenFieldNoteText(note)).toBe('A ist versteckt');
  });

  it('counts in the host’s words', () => {
    expect(formatCodeLines(1)).toBe('1 line');
    expect(formatCodeLines(2)).toBe('2 lines');
    setReqraftLabels({ formEngine: { lineCount: (count) => `${count} Zeilen` } });
    expect(formatCodeLines(2)).toBe('2 Zeilen');
  });

  it('joins alternative dependencies in the host’s words', () => {
    const schema = { a: { display_name: 'A' }, b: { display_name: 'B' } } as never;
    expect(describeDependencies([['a', 'b']], schema)).toBe('("A" or "B")');
    setReqraftLabels({ formEngine: { orJoin: (alternatives) => alternatives.join(' oder ') } });
    expect(describeDependencies([['a', 'b']], schema)).toBe('"A" oder "B"');
  });

  it('draws its toolbar words again when the language changes', () => {
    const Words = () => <span>{useReqraftLabels().formEngine.filterFields}</span>;
    render(
      <ReqoreUIProvider>
        <Words />
      </ReqoreUIProvider>
    );
    expect(screen.getByText('Filter fields...')).toBeTruthy();
    act(() => setReqraftLabels({ formEngine: { filterFields: 'Felder filtern' } }));
    expect(screen.getByText('Felder filtern')).toBeTruthy();
  });
});

