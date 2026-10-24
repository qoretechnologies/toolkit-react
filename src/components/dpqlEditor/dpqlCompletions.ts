// Copyright 2026 Qore Technologies, s.r.o.
// What a DPQL editor's one completion list offers, and what it says (qorus#646, David's decision): the server's
// completion at the caret, with the field's templates merged in where a value can be written - opened by a click,
// a tap or Tab as by typing - and the server's diagnostics in the words the editor owes the author.
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { ILspCompletionItem, ILspDiagnostic } from '../../utils/lspClient.types';
import { EXPRESSION_HOLE } from '../form/expressions/renderExpressionToText';
import { templateCompletionItems } from '../smartEditor/templateCompletions';
import { ICompletionContext } from '../smartEditor/types';
import { dpqlReferenceBeingWritten, stringOpenAt } from './dpqlHelpers';

/** LSP completion kinds that write no value: a keyword and an operator (what the server offers after a value). */
const NO_VALUE_KINDS = new Set([14, 24]);
/** A record's field as a template: `$record:{name}`. */
const RECORD_FIELD = /^\$record:\{(.+)\}$/;
/** An `@` and the field name typed after it, at the end of a text. */
const FIELD_BEING_ASKED = /@[\p{L}\p{M}\p{N}_.]*$/u;
/**
 * A template's context alone (`$data:`, `$qore-expr:`): the server offers each where a value can go, "needs a
 * value after ':'", and picked it is no value - nothing more is offered after it, and the server refuses it
 * (DPQL-E033, "This template isn't finished"). Not offered: a pick makes a value, and an author works with the
 * field's templates and fields, not with how they are written (qorus#646, David's review).
 */
const BARE_CONTEXT = /^\$[\w-]+:$/;

/** What a value cannot follow - so it can be written next: an operator, an opening bracket, a comma. */
const BEFORE_A_VALUE = /[-+*/%<>=!&|,([?:]$/;

/**
 * Whether a value can be written at the end of `textBefore`, as far as the text tells: nothing written yet, an
 * operator, an opening bracket or a comma before it, or a reference being written there. Asked where the server
 * cannot be: there is none, or the document is empty, which it answers nothing for.
 */
export const dpqlExpectsValue = (textBefore: string): boolean => {
  if (dpqlReferenceBeingWritten(textBefore) > 0) {
    return true;
  }
  const written = textBefore.trimEnd();
  return !written || BEFORE_A_VALUE.test(written);
};

/** Whether an `@` asks for a field at the end of `textBefore`: typed as written, not in a string. */
const asksForAField = (textBefore: string): boolean => {
  const match = FIELD_BEING_ASKED.exec(textBefore);
  return !!match && !stringOpenAt(textBefore.slice(0, match.index));
};

/**
 * What the list offers at the caret: the server's answer, and the field's templates where a value can be written
 * there - where the server offers values (anything but keywords and operators), or, where it offers nothing or
 * cannot be asked, where the text says one can go (`dpqlExpectsValue`). A pick is then always a value where one
 * can stand: after `12` the server offers operators, and no template is offered (`12 pos` is refused).
 *
 * After an `@`, only the templates that are the record's fields. A field the server offers that a template names
 * already is listed once, as the template, with its group and type in its detail line. A template's context alone
 * (`$data:`) is not offered (`BARE_CONTEXT`).
 */
export const dpqlCompletionsWith =
  (templates?: IReqoreFormTemplates) =>
  ({ plainText, offset, serverItems }: ICompletionContext): ILspCompletionItem[] => {
    const server = (serverItems ?? []).filter(
      (item) => !BARE_CONTEXT.test(item.insertText ?? item.label)
    );
    const before = plainText.slice(0, offset);
    const valueHere =
      serverItems?.length ?
        serverItems.some((item) => !NO_VALUE_KINDS.has(item.kind ?? 0))
      : dpqlExpectsValue(before);
    const offered = valueHere ? templateCompletionItems(templates) : [];
    const ours =
      asksForAField(before) ?
        offered.filter((item) => RECORD_FIELD.test(item.insertText ?? ''))
      : offered;
    if (!ours.length) {
      return server;
    }
    const named = new Set(ours.map((item) => RECORD_FIELD.exec(item.insertText ?? '')?.[1]));
    return [
      ...ours,
      ...server.filter((item) => !(item.kind === 5 && named.has(item.label.replace(/^@/, '')))),
    ];
  };

/**
 * What the list says where it offers nothing at the caret (qorus#646): after an `@`, that there is no record; after
 * a `$`, that there are no templates here.
 */
export const dpqlEmptyCompletionMessage = (
  plainText: string,
  offset: number
): string | undefined => {
  const before = plainText.slice(0, offset);
  if (asksForAField(before)) {
    return 'No record fields here';
  }
  const written = dpqlReferenceBeingWritten(before);
  return written && before[before.length - written] === '$' ? 'No templates here' : undefined;
};

/** What is said of the placeholders an unfinished expression is written with, for each part not chosen yet. */
export const UNFINISHED_PARTS_MESSAGE = `Fill in each ${EXPRESSION_HOLE} (the parts not chosen yet).`;

/**
 * The server's diagnostics as a DPQL editor says them. The Text view writes an unfinished expression with a
 * placeholder for each part not chosen yet (`… > …`), and the server refuses each: "'…' can't be used here",
 * twice, of text the author did not write (qorus#646, David's decision). Those are said once, as what to do; what
 * the server says of anything else is said as it says it.
 */
export const presentDpqlDiagnostics = (
  diagnostics: ILspDiagnostic[],
  plainText: string
): ILspDiagnostic[] => {
  const lines = plainText.split('\n');
  const atPlaceholder = ({ range: { start, end } }: ILspDiagnostic) =>
    start.line === end.line &&
    lines[start.line]?.slice(start.character, end.character) === EXPRESSION_HOLE;
  const placeholders = diagnostics.filter(atPlaceholder);
  if (!placeholders.length) {
    return diagnostics;
  }
  return [
    {
      range: placeholders[0].range,
      severity: 2,
      source: placeholders[0].source,
      message: UNFINISHED_PARTS_MESSAGE,
    },
    ...diagnostics.filter((diagnostic) => !atPlaceholder(diagnostic)),
  ];
};
