// Copyright 2026 Qore Technologies, s.r.o.
/* The words of expressions, field types and the schema editor: English as they were until a host gives its own, and
   what is on the page changes when its language does. */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatOptionValue } from '../src/components/form/engine/readFirst';
import { StructuredDataView } from '../src/components/form/engine/_structuredData/StructuredDataView';
import { transformedCountText } from '../src/components/form/expressions/builder/confirmMismatchedTypesModal';
import { noOperationYetText } from '../src/components/form/expressions/builder';
import CronFormField from '../src/components/form/fields/cron/Cron';
import { renderBoldWords } from '../src/components/form/fields/schema-definition/boldWords';
import { InlineValidationBanner } from '../src/components/form/fields/schema-definition/InlineValidationBanner';
import Loader from '../src/components/form/fields/schema-definition/Loader';
import { formatTimeoutValue, ordinal } from '../src/helpers/common';
import { builtInTypeSentenceForm, qorusTypeSentenceForm } from '../src/helpers/qorusTypeCatalogue';
import { DEFAULT_REQRAFT_LABELS, setReqraftLabels } from '../src/helpers/reqraftLabels';

afterEach(() => {
  setReqraftLabels();
});

const draw = (node: ReactNode) => render(<ReqoreUIProvider>{node}</ReqoreUIProvider>);

describe('the English words', () => {
  it('count and order as they did', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
    ]);
    expect(transformedCountText(1)).toBe('1 argument will be transformed.');
    expect(transformedCountText(2)).toBe('2 arguments will be transformed.');
    expect(formatTimeoutValue(45000)).toBe('45 seconds');
    expect(formatTimeoutValue(90500)).toBe('90500 ms');
    expect(noOperationYetText(true, 'a whole number')).toBe(
      'Choose what this part does: it must give a whole number.'
    );
    expect(noOperationYetText(false, undefined)).toBe('Choose what this expression does.');
  });

  it('read as they did where they are sentences', () => {
    const { schemaDefinition: schema, formFields: fields, expression } = DEFAULT_REQRAFT_LABELS;
    expect(schema.removeTableConfirm('t', 0)).toBe('Remove the table "t"?');
    expect(schema.removeTableConfirm('t', 1)).toBe('Remove the table "t" and its 1 column?');
    expect(schema.removeTableConfirm('t', 2)).toBe('Remove the table "t" and its 2 columns?');
    expect(schema.stepCount(1)).toBe('1 step');
    expect(fields.addNewItemFor('x')).toBe('Add new item for "x"');
    expect(expression.typeNeededHere('a whole number')).toBe('A whole number is needed here');
    expect(expression.typeMismatch('text', 'a whole number')).toBe(
      'The expression gives text, and this field takes a whole number.'
    );
  });

  it('draw a hint’s bold words as bold, and nothing else', () => {
    const { container } = draw(<div>{renderBoldWords(DEFAULT_REQRAFT_LABELS.schemaDefinition.tablesHint)}</div>);
    expect(container.querySelector('b')?.textContent).toBe('Click a column row to edit it in a side panel');
    expect(container.textContent).toContain(
      'Each row is a database table. Expand one to reach its columns, primary key, indexes, and constraints — each on its own sub-tab. Click a column row to edit it in a side panel where you set its full definition.'
    );
    expect(container.textContent).not.toContain('**');
  });
});

describe('a host’s words', () => {
  it('reach what is said outside a component', () => {
    setReqraftLabels({
      expression: {
        ordinal: (position) => `${position}.`,
        transformedCount: (count) => `${count} umgewandelt`,
        choosePart: () => 'Wählen',
      },
      formEngine: { timeoutUnits: { seconds: 'Sekunden' } },
      colorValue: { empty: 'Keine Farbe' },
    });
    expect(ordinal(2)).toBe('2.');
    expect(transformedCountText(3)).toBe('3 umgewandelt');
    expect(noOperationYetText(true, undefined)).toBe('Wählen');
    expect(formatTimeoutValue(45000)).toBe('45 Sekunden');
    expect(formatTimeoutValue(90500)).toBe('90500 ms');
    expect(formatOptionValue({ type: 'rgbcolor', value: '' } as never, { type: 'rgbcolor' } as never)).toBe('');
  });

  it('name a type in a sentence, but a server’s form stays', () => {
    expect(builtInTypeSentenceForm('int')).toBe('a whole number');
    setReqraftLabels({ typeCatalogue: { sentenceForms: { int: 'eine ganze Zahl' }, unknownType: 'unbekannt' } });
    expect(builtInTypeSentenceForm('int')).toBe('eine ganze Zahl');
    expect(builtInTypeSentenceForm('nonsense')).toBe('unbekannt');
    const server = [{ name: 'int', display_name: 'Integer', sentence_form: 'an integer' }] as never;
    expect(qorusTypeSentenceForm(server, 'int')).toBe('an integer');
  });
});

describe('what is on the page', () => {
  it('changes with the language: a cron field’s parts', () => {
    draw(<CronFormField onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Minute')).toBeTruthy();
    act(() =>
      setReqraftLabels({ formFields: { cronFields: ['Minute', 'Stunde', 'Tag', 'Monat', 'Wochentag'] } })
    );
    expect(screen.getByPlaceholderText('Stunde')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Hour')).toBeNull();
  });

  it('changes with the language: the schema editor’s loader and banner', () => {
    const banner = (
      <InlineValidationBanner
        definition={{ schema: { name: 'a', version: '1' } } as never}
        wrapperName='b'
        readOnly
        onSyncName={vi.fn()}
        onAddMigration={vi.fn()}
      />
    );
    draw(
      <>
        <Loader />
        {banner}
      </>
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.getByText('Schema name does not match the interface name')).toBeTruthy();
    act(() =>
      setReqraftLabels({ schemaDefinition: { loading: 'Lädt…', nameMismatch: 'Name stimmt nicht' } })
    );
    expect(screen.getByText('Lädt…')).toBeTruthy();
    expect(screen.getByText('Name stimmt nicht')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('changes with the language: what a view of no data says, and it listens by itself', () => {
    draw(<StructuredDataView value={{}} />);
    expect(screen.getByText('No structured data.')).toBeTruthy();
    act(() => setReqraftLabels({ formEngine: { noStructuredData: 'Keine Daten.' } }));
    expect(screen.getByText('Keine Daten.')).toBeTruthy();
  });

  it('keeps what a caller says itself over the host’s words', () => {
    setReqraftLabels({ formEngine: { noStructuredData: 'Keine Daten.' } });
    draw(<StructuredDataView value={{}} emptyText='Nothing, says the caller' />);
    expect(screen.getByText('Nothing, says the caller')).toBeTruthy();
  });
});
