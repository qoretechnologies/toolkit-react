// Copyright 2026 Qore Technologies, s.r.o.
/* Each control says a host's words, and says others when its language changes, with nothing else redrawing it. */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render } from '@testing-library/react';
import { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExpressionBuilderAddArgumentSlot } from '../src/components/form/expressions/builder/argumentSlot';
import { ExpressionMoveToPositionStrip } from '../src/components/form/expressions/builder/moveToPositionStrip';
import { ArrayAuto } from '../src/components/form/fields/array/ArrayAuto';
import { ReqraftFileFormField } from '../src/components/form/fields/file/File';
import { ReqraftObjectFormField } from '../src/components/form/fields/object/Object';
import { SelectFormField } from '../src/components/form/fields/select/Select';
import BooleanFormField from '../src/components/form/fields/boolean/Boolean';
import { CompletionMenu } from '../src/components/smartEditor/CompletionMenu';
import { TICKET_STATUS_META } from '../src/components/supportTicket/meta';
import { FetchContext } from '../src/contexts/FetchContext';
import { ReqraftStorageContext } from '../src/contexts/StorageContext';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';
import { validateFieldWithResult } from '../src/helpers/validations';
import { emptyFetchContext } from './support/fetchContext';

afterEach(() => {
  setReqraftLabels();
});

const draw = (node: ReactNode) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <ReqraftStorageContext.Provider
          value={{ getStorage: () => undefined, updateStorage: () => undefined } as never}
        >
          {node}
        </ReqraftStorageContext.Provider>
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const says = (text: string) => expect(document.body.textContent).toContain(text);
const saysNot = (text: string) => expect(document.body.textContent).not.toContain(text);
const change = (labels: Parameters<typeof setReqraftLabels>[0]) => act(() => setReqraftLabels(labels));

describe('expression builder controls', () => {
  it('the slot that adds an argument', () => {
    draw(<ExpressionBuilderAddArgumentSlot argumentName='value' onClick={vi.fn()} />);
    says('Add value');
    change({ expression: { addArgument: (name) => `${name} hinzufügen` } });
    says('value hinzufügen');
    saysNot('Add value');
  });

  it('the strip that moves an argument', () => {
    draw(<ExpressionMoveToPositionStrip index={0} count={3} onMoveTo={vi.fn()} />);
    says('Move to position');
    says('1st');
    change({ expression: { moveToPosition: 'Verschieben', ordinal: (position) => `${position}.` } });
    says('Verschieben');
    says('1.');
    saysNot('Move to position');
  });
});

describe('field types', () => {
  it('ArrayAuto', () => {
    draw(<ArrayAuto name='list' type='string' value={['a']} onChange={vi.fn()} />);
    says('Add new item for "list"');
    change({ formFields: { addNewItemFor: (name) => `Neu für ${name}` } });
    says('Neu für list');
    saysNot('Add new item');
  });

  it('Object', () => {
    draw(<ReqraftObjectFormField type='object' value={{ a: 1 }} onChange={vi.fn()} />);
    says('Editor');
    says('Text');
    change({ formFields: { editor: 'Bearbeiter' } });
    says('Bearbeiter');
    saysNot('Editor');
  });

  it('File', () => {
    draw(<ReqraftFileFormField onChange={vi.fn()} />);
    says('Click or drop files here to upload');
    change({ formFields: { dropFilesHere: 'Dateien hierher ziehen' } });
    says('Dateien hierher ziehen');
    saysNot('Click or drop files');
  });

  it('Select', () => {
    draw(<SelectFormField items={[{ value: 'a' }]} onChange={vi.fn()} />);
    says('Please select');
    change({ formFields: { pleaseSelect: 'Bitte wählen' } });
    says('Bitte wählen');
    saysNot('Please select');
  });

  it('Boolean', () => {
    draw(<BooleanFormField checked onChange={vi.fn()} />);
    says('Yes');
    change({ components: { yes: 'Ja', no: 'Nein' } });
    says('Ja');
  });
});

describe('CompletionMenu', () => {
  const autocomplete = {
    isOpen: true,
    isFetching: true,
    items: [],
    groups: [],
    popoverKey: 1,
    position: { top: 0, left: 0 },
    handleExternalClose: vi.fn(),
  };

  it('says it is loading, and listens by itself when the language changes', () => {
    draw(<CompletionMenu autocomplete={autocomplete as never} id='list' onSelect={vi.fn()} />);
    says('Loading completions…');
    change({ editor: { loadingCompletions: 'Lädt Vorschläge…' } });
    says('Lädt Vorschläge…');
    saysNot('Loading completions…');
  });
});

describe('what has no component to redraw', () => {
  it('a ticket’s status reads the words at the time it is read', () => {
    expect(TICKET_STATUS_META.open.label).toBe('Open');
    setReqraftLabels({ tickets: { open: 'Offen' } });
    expect(TICKET_STATUS_META.open.label).toBe('Offen');
    // what a spread keeps of it is the word at that time, as a render reads it
    expect({ ...TICKET_STATUS_META.open }.label).toBe('Offen');
    setReqraftLabels();
    expect(TICKET_STATUS_META.open.label).toBe('Open');
  });

  it('a validation says why in the host’s words, and in English otherwise', () => {
    const reason = () => validateFieldWithResult('byte-size', 1 as never).reason;
    expect(reason()).toBe('Byte size must be a string');
    setReqraftLabels({ validation: { byteSizeMustBeAString: 'Muss Text sein' } });
    expect(reason()).toBe('Muss Text sein');
  });
});
