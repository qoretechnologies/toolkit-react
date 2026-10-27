// Copyright 2026 Qore Technologies, s.r.o.
// What a DPQL editor's one completion list offers, and what it says (qorus#646, David's decision): the server's
// completion at the caret, with the field's templates merged in where a value can be written - opened by a click,
// a tap or Tab as by typing - and the server's diagnostics in the words the editor owes the author.
import { TTypeLabel } from '../../helpers/qorusTypeCatalogue';
import { ITemplateNode, unbracedReference } from '../../helpers/templateTree';
import { ILspCompletionItem, ILspDiagnostic } from '../../utils/lspClient.types';
import { EXPRESSION_HOLE } from '../form/expressions/renderExpressionToText';
import {
  browseAllTemplatesItem,
  templateSearchItems,
  unlistedContextMessage,
} from '../smartEditor/templateCompletions';
import { ICompletionContext } from '../smartEditor/types';
import { dpqlReferenceBeingWritten, stringOpenAt } from './dpqlHelpers';

/** The word typed before the caret: what follows the last sigil, `.` or `:` (`siz`, `dat`, `nam`, `ev`). */
const wordTyped = (textBefore: string): string =>
  (/[\p{L}\p{M}\p{N}_]*$/u.exec(textBefore)?.[0] ?? '').toLowerCase();

/** How well a completion fits the word typed: 0 its name starts with it, 1 a word in it does, 2 otherwise. */
const fitOf = (item: ILspCompletionItem, word: string): number => {
  if (!word) return 0;
  const names = [item.label, item.filterText, item.insertText]
    .filter((name): name is string => typeof name === 'string')
    .map((name) => name.toLowerCase().replace(/^[@$]+/, ''));
  if (names.some((name) => name.startsWith(word))) return 0;
  if (names.some((name) => name.split(/[^\p{L}\p{M}\p{N}]+/u).some((part) => part.startsWith(word)))) return 1;
  return 2;
};

/** The completions, the best fits of the word typed first, in the order they came otherwise. */
export const rankByFit = (items: ILspCompletionItem[], word: string): ILspCompletionItem[] =>
  items
    .map((item, index) => ({ item, index, fit: fitOf(item, word) }))
    .sort((a, b) => a.fit - b.fit || a.index - b.index)
    .map(({ item }) => item);

/** A reference as one record field is written however it is spelled: `$record:{pos}` is `@pos`. */
const fieldAsWritten = (reference: string): string => {
  const bare = unbracedReference(reference);
  return bare.startsWith('$record:') ? `@${bare.slice('$record:'.length)}` : bare;
};

/** The LSP completion kind a record's field is offered as. */
const FIELD_KIND = 5;
/** LSP completion kinds that write no value: a keyword and an operator (what the server offers after a value). */
const NO_VALUE_KINDS = new Set([14, 24]);
/** An `@` and the field name typed after it, at the end of a text. */
const FIELD_BEING_ASKED = /@[\p{L}\p{M}\p{N}_.]*$/u;

/** Why the templates beside the text cannot be used: a value at its end would follow another (qorus#646). */
export const NO_VALUE_AT_THE_END =
  'A template goes where a value can: after an operator, an opening bracket or a comma, or in an empty expression.';

/**
 * The text with `template` put in at its end, where a template chosen from the picker beside the text goes - the
 * editor keeps no caret its host can reach - in place of a reference being written there (a `$` typed to ask for
 * one), as a template picked in the text goes (qorus#646, David's review: `pos + 1 + $pos`). Undefined where no
 * value can be written at the end (`dpqlExpectsValue`): after `12`, one would be refused.
 */
export const dpqlTextWithTemplateAtTheEnd = (text: string, template: string): string | undefined => {
  if (!template || !dpqlExpectsValue(text)) {
    return undefined;
  }
  const current = text.trimEnd();
  const written = dpqlReferenceBeingWritten(current);
  const before = current.slice(0, current.length - written);
  return (
    !before.trim() ? template
    : written ? `${before}${template}`
    : `${before} ${template}`
  );
};

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

/** A `$` and the template typed after it, at the end of a text: `$data:receive_order.`. */
const TEMPLATE_BEING_TYPED = /\$[\p{L}\p{M}\p{N}_.:{}[\]*-]*$/u;

/**
 * The template typed at the end of `textBefore` (`$`, `$data:receive_order.`); '' where none is, or where it is in
 * a string.
 */
const templateTyped = (textBefore: string): string => {
  const match = TEMPLATE_BEING_TYPED.exec(textBefore);
  return match && !stringOpenAt(textBefore.slice(0, match.index)) ? match[0] : '';
};

/** The field asked for at the end of `textBefore` (`@`, `@na`), typed as written, not in a string; or ''. */
const fieldTyped = (textBefore: string): string => {
  const match = FIELD_BEING_ASKED.exec(textBefore);
  return match && !stringOpenAt(textBefore.slice(0, match.index)) ? match[0] : '';
};

/** Whether an `@` asks for a field at the end of `textBefore`: typed as written, not in a string. */
const asksForAField = (textBefore: string): boolean => !!fieldTyped(textBefore);

/**
 * What the list offers at the caret: the server's answer, and the field's templates and fields that what is typed
 * reaches (qorus#646, David's review): after `$d` or `$data` the states, after `$data:` the states, after
 * `$data:receive_order.` that state's data, after `@` the record's fields - a group a row that opens the picker at
 * its members. Nothing that does not go on from what is typed: a template list of everything, under whatever was
 * typed, read as if all of it fitted. Where a value can be written and nothing is typed, the field's templates are
 * a row that opens the picker at their top ("Browse all templates"), with the server's answer. A pick is always a
 * value where one can stand: after `12` the server offers operators, and no template is offered.
 *
 * A field or a template the server offers that the field's own list has is listed once, as the field's own, with
 * where it is. A template's context alone (`$data:`) is not offered (`BARE_CONTEXT`).
 */
/** Whether a completion row is a record field (`@pos`, its template `$record:{pos}`). */
const isRecordField = (item: ILspCompletionItem): boolean => {
  const written = item.textEdit?.newText ?? item.insertText ?? item.label;
  return item.kind === FIELD_KIND || written.startsWith('@') || unbracedReference(written).startsWith('$record:');
};

export const dpqlCompletionsWith =
  (roots: ITemplateNode[] = [], typeLabel?: TTypeLabel) =>
  ({ plainText, offset, serverItems, typedInText }: ICompletionContext): ILspCompletionItem[] => {
    /* The server's completions are offered as it offers them - a template's context (`$data:`) among them, which a
       pick writes and goes on from, listing what is in it (qorus#646, David: "typing '$dat' or '@nam' does not
       result in any LSP completion support, but it should") - ranked by how well they fit what is typed. */
    const before = plainText.slice(0, offset);
    /* What is typed, where a value can be written: the server says so by offering values (a whole reference before
       the caret - a chip - is a value already, and the server offers operators after it), or, where it offers
       nothing or cannot be asked, the text does. */
    /* What is typed of a reference: read from the text the caret is in where the editor says what that is - a
       chip before it is a value already, not a reference being typed - else from the plain text. */
    /* a `.` or `[` typed straight after a chip goes on from the chip's reference (`$data:receive_order` and `.`):
       read with it */
    const written = typedInText !== undefined && !/^[.[]/.test(typedInText) ? typedInText : before;
    const server = rankByFit(serverItems ?? [], wordTyped(written));
    const typed = templateTyped(written) || fieldTyped(written);
    const valueHere =
      serverItems?.length ? serverItems.some((item) => !NO_VALUE_KINDS.has(item.kind ?? 0))
      : typed ? dpqlExpectsValue(before.slice(0, before.length - typed.length))
      : dpqlExpectsValue(before);
    const serverReferences = new Set(
      server.map((item) => fieldAsWritten(item.textEdit?.newText ?? item.insertText ?? item.label))
    );
    /* A record field the server offers is listed as the server lists it - it knows the record - and once: a field
       of the field's own list it offers too is left out of that list. */
    const ours = rankByFit(
      typed && valueHere && roots.length ? templateSearchItems(roots, typed, typeLabel) : [],
      wordTyped(written)
    ).filter(
      (item) =>
        !(item.kind === FIELD_KIND && serverReferences.has(fieldAsWritten(item.insertText ?? ''))) &&
        // after a `$` only a template can follow: a record field is written with an `@` (qorus#646, David's review)
        !(typed.startsWith('$') && isRecordField(item))
    );
    const browse = valueHere && roots.length ? [browseAllTemplatesItem()] : [];
    if (!ours.length) {
      // a context written that nothing is listed in: the list says what to write next (`unlistedContextMessage`)
      if (!server.length && unlistedContextMessage(typed || written)) {
        return [];
      }
      return [...server, ...browse];
    }
    /* a template context the server offers is listed as the server offers it, with its words; a template the
       server offers that the field's own list has is listed once, as the field's own */
    const serverWritten = new Set(server.map((item) => item.textEdit?.newText ?? item.insertText ?? item.label));
    const oursListed = ours.filter(
      (item) =>
        !((item.data as { kindLabel?: string } | undefined)?.kindLabel === 'Template context' &&
          serverWritten.has(item.insertText ?? ''))
    );
    // by the reference each stands for: a state gone on into writes `$data:receive_order.`, the server's is the state
    const ownReferences = new Set(
      oursListed.flatMap((item) => [
        unbracedReference(item.insertText ?? ''),
        unbracedReference(item.filterText ?? ''),
      ])
    );
    const rest = [
      ...oursListed,
      ...server.filter(
        (item) =>
          !ownReferences.has(unbracedReference(item.textEdit?.newText ?? item.insertText ?? item.label))
      ),
    ];
    /* the contexts first, by name as Qorus lists them, the field's own and the server's alike, then what is named
       so: `$time` lists $timestamp: before Current Timestamp */
    const isContext = (item: ILspCompletionItem) => /^\$[\w-]+:$/.test(item.insertText ?? '');
    return [
      ...rest.filter(isContext).sort((a, b) => (a.insertText ?? '').localeCompare(b.insertText ?? '')),
      ...rest.filter((item) => !isContext(item)),
      ...browse,
    ];
  };

/**
 * What the list says where it offers nothing at the caret (qorus#646): after an `@`, that there is no record; after
 * a `$`, that there are no templates here.
 */
export { unlistedContextMessage };

export const dpqlEmptyCompletionMessage = (
  plainText: string,
  offset: number
): string | undefined => {
  const before = plainText.slice(0, offset);
  if (asksForAField(before)) {
    return 'No record fields here';
  }
  // a context written: what to write in it; a `$` alone or a context's name being written: that there is none
  const inContext = unlistedContextMessage(before);
  if (inContext) {
    return inContext;
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
