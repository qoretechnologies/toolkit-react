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
  dpqlTextWithTemplateAtTheEnd,
} from '../../src/components/dpqlEditor/dpqlCompletions';
import { BROWSE_ALL_TEMPLATES } from '../../src/components/smartEditor/templateCompletions';
import { templateTree } from '../../src/helpers/templateTree';
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

/** What a list offers, as written: the row that opens the picker by its label. */
const listed = (items: ILspCompletionItem[]) =>
  items.map((item) => (item.data?.browseAll ? BROWSE_ALL_TEMPLATES : (item.insertText ?? item.label)));
const ROOTS = templateTree(TEMPLATES);
const complete = (text: string, serverItems?: ILspCompletionItem[]) => {
  const caret = text.indexOf('|');
  return dpqlCompletionsWith(ROOTS)({
    plainText: text.replace('|', ''),
    offset: caret,
    serverItems,
  });
};

describe('what the one completion list offers', () => {
  /* qorus#646, David's review: the list offered every template under whatever was typed, and read as if all of
     them fitted. Where nothing is typed, the templates are one row that opens the picker. */
  it("offers the server's answer and a row that opens the picker where a value can go and nothing is typed", () => {
    expect(listed(complete('$record:{pos} + |', AFTER_AN_OPERATOR))).toEqual([
      'pos',
      'bezeichnung',
      '$config:',
      '!',
      BROWSE_ALL_TEMPLATES,
    ]);
  });

  /* qorus#646, David's review of the picker: typing `$dat` offered no language-server completion. A template's
     context is offered as the server offers it: written as text, the list goes on from it (its `:` asks again). */
  it("offers the server's template contexts with the field's templates, which a pick goes on from", () => {
    const contexts: ILspCompletionItem[] = [
      { label: '$data:', insertText: '$data:', kind: 6, detail: "needs a value after ':'" },
      {
        label: '$qore-expr:',
        insertText: '$qore-expr:',
        kind: 6,
        detail: "needs a value after ':'",
      },
    ];
    // no record field after a `$`: a field is written with an `@` (qorus#646, David's review)
    // the contexts of the field's templates and the server's, each once: `$` lists contexts (David: "`$` → contexts")
    expect(listed(complete('1 + $|', contexts))).toEqual([
      '$config:',
      '$data:',
      '$qore-expr:',
      BROWSE_ALL_TEMPLATES,
    ]);
    // with no templates, the server's answer alone
    expect(
      listed(dpqlCompletionsWith([])({ plainText: '1 + $', offset: 5, serverItems: contexts }))
    ).toEqual(['$data:', '$qore-expr:']);
    // what the server offers after a context is a whole value: kept
    const after: ILspCompletionItem[] = [
      { label: '$timestamp:now', insertText: '$timestamp:now', kind: 6 },
    ];
    expect(
      listed(dpqlCompletionsWith([])({ plainText: '$timestamp:', offset: 11, serverItems: after }))
    ).toEqual(['$timestamp:now']);
  });

  it('ranks the best fits of the word typed first: a name it starts, then a word in it starts', () => {
    const functions: ILspCompletionItem[] = [
      { label: 'resize', kind: 3 },
      { label: 'list_size', kind: 3 },
      { label: 'size', kind: 3 },
    ];
    expect(listed(dpqlCompletionsWith([])({ plainText: 'siz', offset: 3, serverItems: functions }))).toEqual([
      'size',
      'list_size',
      'resize',
    ]);
  });

  it('offers no template after a whole value, where the server offers operators (no `12 pos`)', () => {
    expect(listed(complete('12 |', AFTER_A_VALUE))).toEqual(['&&', '||']);
    expect(complete('12|', [])).toEqual([]);
  });

  it('offers the row that opens the picker in an empty text, which the server answers nothing for', () => {
    expect(listed(complete('|', []))).toEqual([BROWSE_ALL_TEMPLATES]);
  });

  it('offers it where the text says a value can go when there is no server, and nothing where not', () => {
    expect(listed(complete('1 + |'))).toEqual([BROWSE_ALL_TEMPLATES]);
    expect(listed(complete('concat(|'))).toEqual([BROWSE_ALL_TEMPLATES]);
    expect(complete('1 + 2|')).toEqual([]);
  });

  it("offers the record's fields after an @, each once, as the server lists it where it does", () => {
    const roots = templateTree(TEMPLATES, { fields: { pos: { type: { name: 'int' } }, qty: { type: 'int' } } });
    const server: ILspCompletionItem[] = [
      { label: 'pos', kind: 5, detail: 'Whole number', textEdit: { range: { start: { line: 0, character: 4 }, end: { line: 0, character: 5 } }, newText: '@pos' } },
    ];
    const offered = dpqlCompletionsWith(roots)({ plainText: '1 + @', offset: 5, serverItems: server });
    // the catalogue's field bezeichnung, the field's own list's qty, and pos once, as the server lists it
    expect(listed(offered)).toEqual([
      '$record:{bezeichnung}',
      '@qty',
      'pos',
      BROWSE_ALL_TEMPLATES,
    ]);
  });

  it('lists a template by its name, where it is on its detail line, and what it is and its type as its badges', () => {
    expect(complete('@|', [])[0]).toMatchObject({
      label: 'pos',
      kind: 5,
      detail: 'in Fields of the row',
      data: expect.objectContaining({ kindLabel: 'Field', typeLabel: 'Whole number', section: 'Record fields' }),
    });
  });

  it('offers the server answer alone where the field has no templates, a context gone on into and used whole', () => {
    const offered = dpqlCompletionsWith([])({
      plainText: '1 + ',
      offset: 4,
      serverItems: AFTER_AN_OPERATOR,
    });
    expect(listed(offered)).toEqual(listed(AFTER_AN_OPERATOR));
    // a template context is a container: gone on into, its row's Use taking it whole (qorus#646 round 4)
    const context = offered.find((item) => item.label === '$config:');
    expect(context?.data).toMatchObject({ continues: true, takesWhole: true });
    expect((context?.data as { wholeValue?: string }).wholeValue).toMatch(/^\$[\w-]+:\*$/);
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

describe('dpqlTextWithTemplateAtTheEnd', () => {
  it('puts the template in an empty text, after an operator, and in place of a reference being written', () => {
    expect(dpqlTextWithTemplateAtTheEnd('', '$local:id')).toBe('$local:id');
    expect(dpqlTextWithTemplateAtTheEnd('   ', '$local:id')).toBe('$local:id');
    expect(dpqlTextWithTemplateAtTheEnd('@pos +', '$local:id')).toBe('@pos + $local:id');
    expect(dpqlTextWithTemplateAtTheEnd('@pos + 1 + $po', '$pos')).toBe('@pos + 1 + $pos');
  });

  it('writes nothing where no value can follow, or for no template', () => {
    expect(dpqlTextWithTemplateAtTheEnd('12', '$local:id')).toBeUndefined();
    expect(dpqlTextWithTemplateAtTheEnd('@pos +', '')).toBeUndefined();
  });
});

describe('a template being typed', () => {
  // a Qog state's data, as a host gives it (fsms?action=getStateData), and a context data item
  const QOG_TEMPLATES = {
    items: [
      { label: 'Context Data', items: [{ label: 'Interface ID', value: '$local:id', badge: 'int' }] },
      {
        label: 'Receive order',
        items: [
          { label: 'Order ID', value: '$data:{receive_order.order_id}', badge: 'int' },
          { label: 'User name', value: '$data:{receive_order.user_name}', badge: 'string' },
        ],
      },
    ],
  } as IReqoreFormTemplates;
  // what the server offers after `$data:receive_order.`: the state's data, each the whole reference
  const STATE_DATA: ILspCompletionItem[] = [
    { label: 'Order ID', kind: 6, insertText: '$data:receive_order.order_id' },
    { label: 'User name', kind: 6, insertText: '$data:receive_order.user_name' },
    { label: 'Event type', kind: 6, insertText: '$data:receive_order.event_type' },
  ];
  // what it offers after `$data:`: the states, each the whole reference
  const STATES: ILspCompletionItem[] = [{ label: 'Receive order', kind: 6, insertText: '$data:receive_order' }];
  const completeQog = (text: string, serverItems?: ILspCompletionItem[]) =>
    dpqlCompletionsWith(templateTree(QOG_TEMPLATES))({ plainText: text, offset: text.length, serverItems });

  it("is gone on with only by the templates it starts, braces or not, and the server's others", () => {
    expect(listed(completeQog('$data:receive_order.', STATE_DATA))).toEqual([
      '$data:{receive_order.order_id}',
      '$data:{receive_order.user_name}',
      // the server's reference no template is
      '$data:receive_order.event_type',
      BROWSE_ALL_TEMPLATES,
    ]);
    // a context's name being written: the context, written and gone on from
    expect(listed(completeQog('$loc'))).toEqual(['$local:', BROWSE_ALL_TEMPLATES]);
    expect(listed(completeQog('$local:'))).toEqual(['$local:*', '$local:id', BROWSE_ALL_TEMPLATES]);
  });

  /* qorus#646, David's review (round 3): typing goes on level by level - `$d` and `$data` the context, `$data:` its
     states, each taken writes its reference as text and lists what is in it; a chip is a whole reference */
  it('offers the context for `$d` and `$data`, and its states for `$data:`, each gone on into', () => {
    for (const typed of ['$d', '$data']) {
      const offered = completeQog(typed);
      expect(listed(offered), typed).toEqual(['$data:', BROWSE_ALL_TEMPLATES]);
      expect(offered[0]).toMatchObject({ label: '$data:', data: expect.objectContaining({ continues: true }) });
    }
    // the whole of it first (`$data:*`), then the states
    const states = completeQog('$data:', STATES);
    expect(listed(states)).toEqual(['$data:*', '$data:receive_order.', BROWSE_ALL_TEMPLATES]);
    expect(states[1]).toMatchObject({ label: 'Receive order', data: expect.objectContaining({ continues: true }) });
    // a context row has Use: the whole of it
    expect(completeQog('$d')[0].data).toMatchObject({ takesWhole: true, wholeValue: '$data:*' });
  });

  it('offers the contexts while only its `$` is typed', () => {
    // by name, as Qorus lists them
    expect(listed(completeQog('$'))).toEqual(['$data:', '$local:', BROWSE_ALL_TEMPLATES]);
  });

  /* qorus#646, David's review: each state's data said "Receive order" under its name, as if that were what it is */
  it('says where a template is apart from what it is, and calls state data state data, not a Variable', () => {
    const [orderId] = completeQog('$data:receive_order.o');
    expect(orderId).toMatchObject({
      label: 'Order ID',
      detail: 'in Receive order',
      data: expect.objectContaining({ kindLabel: 'State data' }),
    });
  });
});

describe('after a whole reference', () => {
  /* qorus#646: a chip's text is in the plain text before the caret; it is a value already, and the server offers
     operators after it - no template is offered there (`pos pos` is refused) */
  it('offers what the server offers after a value, and no template', () => {
    const roots = templateTree(TEMPLATES);
    expect(
      listed(
        dpqlCompletionsWith(roots)({ plainText: '$record:{pos}', offset: 13, serverItems: AFTER_A_VALUE })
      )
    ).toEqual(['&&', '||']);
    // with no server: the editor says nothing is typed in the text after the chip
    expect(
      dpqlCompletionsWith(roots)({ plainText: '$record:{pos}', offset: 13, serverItems: [], typedInText: '' })
    ).toEqual([]);
  });
});
