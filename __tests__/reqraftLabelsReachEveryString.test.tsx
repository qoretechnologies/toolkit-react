// Copyright 2026 Qore Technologies, s.r.o.
/*
 * Strings Reqraft drew that no label slot reached: a host that translates its interface gives each through
 * `setReqraftLabels`, read when it is drawn, and the English stays the default. Dates and times are said in the
 * page's language (`<html lang>`), not in a fixed English one.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, screen } from '@testing-library/react';
import cronstrue from 'cronstrue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReqraftColorValue } from '../src/components/colorValue';
import { Description } from '../src/components/Description';
import { describedControlInfoLabel } from '../src/components/Description/describedControl';
import { formatOptionValue } from '../src/components/form/engine/readFirst';
import { getImmediateValueTypes } from '../src/components/form/fields/auto/AutoFormField';
import { ColorFormField } from '../src/components/form/fields/color/Color';
import { CronFormField, cronLocale } from '../src/components/form/fields/cron/Cron';
import { ReqraftTemplateExampleValueModal } from '../src/components/form/fields/template/ExampleValueModal';
import { TimeoutFormField } from '../src/components/form/fields/timeout/Timeout';
import { formatInstant, formatRelativeTime } from '../src/components/supportTicket/accessMeta';
import { defaultInterfaceKindLabel } from '../src/components/supportTicket/meta';
import { formatTimeoutValue } from '../src/helpers/common';
import {
  builtInQorusTypes,
  builtInTypeLabel,
  builtInTypeSentenceForm,
  defaultQorusTypes,
  qorusTypeDisplayName,
  qorusTypeSentenceForm,
} from '../src/helpers/qorusTypeCatalogue';
import { setReqraftLabels } from '../src/helpers/reqraftLabels';

const drawn = (element: JSX.Element) => render(<ReqoreUIProvider>{element}</ReqoreUIProvider>);

afterEach(() => {
  setReqraftLabels();
  document.documentElement.lang = '';
});

describe('the color field and a color read as a value', () => {
  it("says the field's words in the host's language, and one field's own over them", () => {
    setReqraftLabels({ fields: { color: { hex: 'Hex-Code', help: 'Was bedeutet das?' } } });
    const { unmount } = drawn(<ColorFormField value={{ r: 100, g: 149, b: 237 }} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Hex-Code')).toBeTruthy();
    expect(document.body.textContent).toContain('Was bedeutet das?');
    unmount();
    drawn(<ColorFormField value={{ r: 1, g: 2, b: 3 }} onChange={vi.fn()} labels={{ hex: 'Hex' }} />);
    expect(screen.getByLabelText('Hex')).toBeTruthy();
  });

  it("says what a value that is not a color is, and that there is none, in the host's words", () => {
    setReqraftLabels({ colorValue: { invalid: (shown) => `Keine Farbe: ${shown}`, empty: 'Keine Farbe' } });
    expect(formatOptionValue({ type: 'rgbcolor', value: 'zzz' } as never, { type: 'rgbcolor' } as never)).toMatch(
      /^Keine Farbe: /
    );
    drawn(<ReqraftColorValue value={undefined} />);
    expect(document.body.textContent).toContain('Keine Farbe');
  });
});

describe("a field of no fixed type, a cron field and a timeout, in the host's words", () => {
  it('names the kinds of value it offers', () => {
    expect(getImmediateValueTypes().find((type) => type.name === 'int')?.display_name).toBe('Whole number');
    setReqraftLabels({ fields: { valueTypes: { int: 'Ganzzahl' } } });
    const types = getImmediateValueTypes();
    expect(types.find((type) => type.name === 'int')?.display_name).toBe('Ganzzahl');
    // the rest keep the English
    expect(types.find((type) => type.name === 'string')?.display_name).toBe('Text');
  });

  it("names a cron expression's parts, and keeps writing the expression by its part", () => {
    setReqraftLabels({ fields: { cronParts: { minute: 'Minute (de)', hour: 'Stunde' } } });
    const onChange = vi.fn();
    drawn(<CronFormField value='1 2 3 4 5' onChange={onChange} />);
    expect(screen.getByPlaceholderText('Stunde')).toBeTruthy();
    act(() => {
      screen.getByLabelText('Stunde').focus();
    });
    // typing into the box called Stunde changes the hour, whatever the box is called
    const hour = screen.getByLabelText('Stunde') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(hour, '9');
      hour.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith('1 9 3 4 5');
  });

  it("describes a cron expression in the page's language where the host has loaded it, else in English", async () => {
    expect(cronLocale('de-AT')).toBeUndefined();
    await import('cronstrue/locales/de');
    expect(cronLocale('de-AT')).toBe('de');
    expect(cronLocale('xx')).toBeUndefined();
    document.documentElement.lang = 'de';
    expect(cronLocale()).toBe('de');
    expect(cronstrue.toString('0 * * * *', { locale: cronLocale() })).not.toBe(
      cronstrue.toString('0 * * * *')
    );
  });

  it('says a timeout with its plural chosen by the count', () => {
    expect(formatTimeoutValue(60000)).toBe('1 minute');
    expect(formatTimeoutValue(45000)).toBe('45 seconds');
    expect(formatTimeoutValue(90500)).toBe('90500 ms');
    setReqraftLabels({
      fields: { timeoutAmount: (count, unit) => `${count} × ${unit}`, timeoutUnits: { seconds: 'Sekunden' } },
    });
    expect(formatTimeoutValue(45000)).toBe('45 × seconds');
    drawn(<TimeoutFormField value={45000} onChange={vi.fn()} />);
    expect(document.body.textContent).toContain('Sekunden');
  });
});

describe("a description's reveal and the ⓘ beside a control", () => {
  it("say the host's words", () => {
    setReqraftLabels({ description: { more: '…mehr', about: (name) => `Über ${name}` } });
    expect(describedControlInfoLabel('Retries')).toBe('Über Retries');
    drawn(
      <Description
        shortDescription='How many times it is tried.'
        longDescription={'How many times it is tried.\n\nAfter the last, the order stops and waits.'}
      />
    );
    expect(document.body.textContent).toContain('…mehr');
  });
});

describe('the built-in type catalogue', () => {
  it("names the built-in types in the host's words, and keeps the server's copy as it is", () => {
    expect(builtInTypeLabel('int')).toBe('Whole number');
    setReqraftLabels({
      qorusTypes: {
        names: { int: 'Ganzzahl' },
        sentenceForms: { int: 'eine Ganzzahl' },
        descriptions: { int: 'Eine ganze Zahl' },
      },
    });
    expect(builtInTypeLabel('int')).toBe('Ganzzahl');
    expect(builtInTypeSentenceForm('int')).toBe('eine Ganzzahl');
    expect(builtInQorusTypes().find((type) => type.name === 'int')?.desc).toBe('Eine ganze Zahl');
    // the English copy the server's answer is compared with is never changed
    expect(defaultQorusTypes.find((type) => type.name === 'int')?.display_name).toBe('Whole number');
  });

  it("says a type no catalogue names in the host's words", () => {
    setReqraftLabels({
      qorusTypes: {
        unknownType: 'Unbekannter Typ',
        valueOfType: (name) => `ein Wert vom Typ ${name}`,
        valueOfAnUnknownType: 'ein Wert unbekannten Typs',
      },
    });
    expect(qorusTypeDisplayName([], 'mystery')).toBe('Unbekannter Typ');
    expect(qorusTypeSentenceForm([], 'mystery')).toBe('ein Wert unbekannten Typs');
    expect(qorusTypeSentenceForm([], 'qoretechnologies/order')).toBe('ein Wert vom Typ qoretechnologies/order');
    expect(qorusTypeSentenceForm([{ name: 'x', display_name: 'X', types_accepted: [] }], 'x')).toBe(
      'ein Wert vom Typ X'
    );
  });
});

describe('the example value dialog', () => {
  it("says its words in the host's language where its caller gives none", () => {
    setReqraftLabels({ templateList: { exampleValueTitle: 'Beispielwert', copy: 'Kopieren' } });
    drawn(<ReqraftTemplateExampleValueModal isOpen value='{"a": 1}' />);
    expect(document.body.textContent).toContain('Beispielwert');
    expect(document.body.textContent).toContain('Kopieren');
  });
});

describe("times in the page's language", () => {
  const NOW = Date.parse('2026-10-19T12:00:00Z');

  it("say how long ago and when in the page's language, unless the caller names one", () => {
    document.documentElement.lang = 'de';
    expect(formatRelativeTime('2026-10-19T09:00:00Z', NOW)).toBe('vor 3 Stunden');
    expect(formatInstant('2026-10-19T15:00:00Z')).toMatch(/19\.10\.2026|19\. Okt\. 2026/);
    expect(formatRelativeTime('2026-10-19T09:00:00Z', NOW, 'en')).toBe('3 hours ago');
  });

  it("say the present in the host's words, whatever the language", () => {
    setReqraftLabels({ supportTicket: { justNow: 'gerade eben' } });
    document.documentElement.lang = 'de';
    expect(formatRelativeTime('2026-10-19T12:00:08Z', NOW)).toBe('gerade eben');
  });
});

describe('a kind of interface with no name of its own', () => {
  it('is named by the host, from its id, not made plural by adding an "s"', () => {
    expect(defaultInterfaceKindLabel('message-queue')).toBe('Message queues');
    const otherInterfaceKind = vi.fn((_name: string, kind: string) => `Andere: ${kind}`);
    setReqraftLabels({ supportTicket: { otherInterfaceKind } });
    expect(defaultInterfaceKindLabel('message-queue')).toBe('Andere: message-queue');
    expect(otherInterfaceKind).toHaveBeenCalledWith('Message queue', 'message-queue');
  });
});
