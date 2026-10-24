// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A DPQL editor's one completion list (qorus#646, David's decision): the server's completion at the caret, with
 * the field's templates where a value can be written, so that a pick is always a value where one can stand; and
 * the server's diagnostics in the words the editor owes the author. The server's answers below are what
 * professor's `/lsp` answered at the same carets (capture-dpql-completions.qr, checkout 35096ca2d), cut down.
 */
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { describe, expect, it } from 'vitest';
import {
  dpqlCompletionsWith,
  dpqlEmptyCompletionMessage,
  dpqlExpectsValue,
  presentDpqlDiagnostics,
  UNFINISHED_PARTS_MESSAGE,
} from '../../src/components/dpqlEditor/dpqlCompletions';
import { ILspCompletionItem, ILspDiagnostic } from '../../src/utils/lspClient.types';

const TEMPLATES = {
  items: [
    {
      label: 'Fields of the row',
      items: [
        { label: 'pos', value: '$record:{pos}', badge: 'int' },
        { label: 'bezeichnung', value: '$record:{bezeichnung}', badge: 'string' },
      ],
    },
    { label: 'Settings', items: [{ label: 'Rate', value: '$config:rate', badge: 'number' }] },
  ],
} as IReqoreFormTemplates;

/** What the server offers after an operator: the record's fields, its template contexts, functions. */
const AFTER_AN_OPERATOR: ILspCompletionItem[] = [
  { label: 'pos', kind: 5, detail: 'Whole number' },
  { label: 'bezeichnung', kind: 5, detail: 'Text' },
  { label: '$config:', kind: 6, detail: "needs a value after ':'" },
  { label: '!', kind: 14 },
];
/** What it offers after a whole value (`12 `): operators only. */
const AFTER_A_VALUE: ILspCompletionItem[] = [
  { label: '&&', kind: 14 },
  { label: '||', kind: 14 },
];

const listed = (items: ILspCompletionItem[]) => items.map((item) => item.insertText ?? item.label);
const complete = (text: string, serverItems?: ILspCompletionItem[]) => {
  const caret = text.indexOf('|');
  return dpqlCompletionsWith(TEMPLATES)({
    plainText: text.replace('|', ''),
    offset: caret,
    serverItems,
  });
};

describe('what the one completion list offers', () => {
  it("offers the field's templates where the server offers values, each field once", () => {
    expect(listed(complete('$record:{pos} + |', AFTER_AN_OPERATOR))).toEqual([
      '$record:{pos}',
      '$record:{bezeichnung}',
      '$config:rate',
      '!',
    ]);
  });

  /* qorus#646, David's review: picking `$data:` made text the server refuses (DPQL-E033, "This template isn't
     finished"), and it offers nothing more after it (professor's `/lsp`, 0 items) */
  it("does not offer a template's context alone, which is no value", () => {
    const contexts: ILspCompletionItem[] = [
      { label: '$data:', insertText: '$data:', kind: 6, detail: "needs a value after ':'" },
      {
        label: '$qore-expr:',
        insertText: '$qore-expr:',
        kind: 6,
        detail: "needs a value after ':'",
      },
    ];
    expect(listed(complete('1 + $|', contexts))).toEqual([
      '$record:{pos}',
      '$record:{bezeichnung}',
      '$config:rate',
    ]);
    expect(
      dpqlCompletionsWith(undefined)({ plainText: '1 + $', offset: 5, serverItems: contexts })
    ).toEqual([]);
    // what the server offers after a context is a whole value: kept
    const after: ILspCompletionItem[] = [
      { label: '$timestamp:now', insertText: '$timestamp:now', kind: 6 },
    ];
    expect(
      listed(
        dpqlCompletionsWith(undefined)({ plainText: '$timestamp:', offset: 11, serverItems: after })
      )
    ).toEqual(['$timestamp:now']);
  });

  it('offers no template after a whole value, where the server offers operators (no `12 pos`)', () => {
    expect(listed(complete('12 |', AFTER_A_VALUE))).toEqual(['&&', '||']);
    expect(complete('12|', [])).toEqual([]);
  });

  it('offers the templates in an empty text, which the server answers nothing for', () => {
    expect(listed(complete('|', []))).toEqual([
      '$record:{pos}',
      '$record:{bezeichnung}',
      '$config:rate',
    ]);
  });

  it('offers them where the text says a value can go when there is no server, and nothing where not', () => {
    expect(listed(complete('1 + |'))).toHaveLength(3);
    expect(listed(complete('concat(|'))).toHaveLength(3);
    expect(complete('1 + 2|')).toEqual([]);
  });

  it('offers only the fields of the record after an @', () => {
    expect(listed(complete('1 + @|', [{ label: 'pos', kind: 5 }]))).toEqual([
      '$record:{pos}',
      '$record:{bezeichnung}',
    ]);
  });

  it('lists a template as its catalogue names it, its group and type on its detail line', () => {
    // the type by its name, never its code (templateTypeBadge)
    expect(complete('|', [])[0]).toMatchObject({
      label: 'pos',
      kind: 5,
      detail: 'Fields of the row · Whole number',
    });
  });

  it('offers the server answer alone where the field has no templates', () => {
    expect(
      dpqlCompletionsWith(undefined)({
        plainText: '1 + ',
        offset: 4,
        serverItems: AFTER_AN_OPERATOR,
      })
    ).toEqual(AFTER_AN_OPERATOR.filter((item) => item.label !== '$config:'));
  });
});

describe('where a value can be written, as the text tells', () => {
  it('is an empty text, after an operator, a bracket or a comma, or where a reference is being written', () => {
    for (const before of [
      '',
      '  ',
      '1 +',
      'a == ',
      'concat(',
      'f(1, ',
      '[',
      '1 + $',
      '1 + @',
      '1 + $rec',
    ]) {
      expect(dpqlExpectsValue(before), before).toBe(true);
    }
  });

  it('is not after a value', () => {
    for (const before of ['12', '12 ', '$record:{pos}', '"text"', 'f(1)', 'pos + 1']) {
      expect(dpqlExpectsValue(before), before).toBe(false);
    }
  });
});

describe('what the list says where it offers nothing', () => {
  it('says there is no record after an @', () => {
    expect(dpqlEmptyCompletionMessage('1 + @', 5)).toBe('No record fields here');
    expect(dpqlEmptyCompletionMessage('@na', 3)).toBe('No record fields here');
  });

  it('says there are no templates after a $', () => {
    expect(dpqlEmptyCompletionMessage('1 + $', 5)).toBe('No templates here');
    expect(dpqlEmptyCompletionMessage('1 + $da', 7)).toBe('No templates here');
  });

  it('says nothing elsewhere, nor after an @ in a string', () => {
    expect(dpqlEmptyCompletionMessage('12', 2)).toBeUndefined();
    expect(dpqlEmptyCompletionMessage('"mail me @', 10)).toBeUndefined();
  });
});

/** The server's words for a character it cannot read (DPQL-E001, Qore batch 6). */
const CANNOT_BE_USED_HERE =
  "'…' can't be used here: remove it, or put it in quotes to make it text.";

describe('what the editor says of what the server refuses', () => {
  const at = (from: number, to: number, message: string): ILspDiagnostic => ({
    range: { start: { line: 0, character: from }, end: { line: 0, character: to } },
    severity: 1,
    code: 'DPQL-E001',
    source: 'dpql',
    message,
  });

  it("says once what to do with an unfinished expression's placeholders, not the server's refusal of each", () => {
    // the server on `… > …`: "'…' can't be used here" at 0 and at 4 (DPQL-E001)
    const said = presentDpqlDiagnostics(
      [at(0, 1, CANNOT_BE_USED_HERE), at(4, 5, CANNOT_BE_USED_HERE)],
      '… > …'
    );
    expect(said).toEqual([
      expect.objectContaining({ severity: 2, message: UNFINISHED_PARTS_MESSAGE }),
    ]);
    expect(UNFINISHED_PARTS_MESSAGE).toBe('Fill in each … (the parts not chosen yet).');
  });

  it('says everything else as the server says it', () => {
    const other = at(2, 2, "Something is missing at the end: a value after '+'.");
    expect(presentDpqlDiagnostics([other], '1 +')).toEqual([other]);
    expect(
      presentDpqlDiagnostics([at(0, 1, CANNOT_BE_USED_HERE), other], '… +').map((d) => d.message)
    ).toEqual([UNFINISHED_PARTS_MESSAGE, "Something is missing at the end: a value after '+'."]);
  });
});
