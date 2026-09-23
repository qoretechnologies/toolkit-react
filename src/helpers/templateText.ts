// Copyright 2026 Qore Technologies, s.r.o.
// A string holding template references, as the nodes a rich-text editor draws.
//
// A field whose value is a plain string can still hold references —
// `Dear $local:name` — and those should read as the names they were chosen by,
// not as their spelling. These convert between the stored string and the
// editor's paragraphs, where each reference is a chip, so the editor can draw
// chips while the field keeps storing exactly the string it always stored.
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { getTagLabel } from '../components/dpqlEditor/dpqlHelpers';
import { IRichtextSegment } from './common';
import { describeTemplateReference, TEMPLATE_TOKEN_SOURCE } from './templates';

/* Stated here rather than borrowed from Reqore's editor props: those resolve
   to Reqore's `CustomElement`, which it does not export, so the published
   declarations could not name this module's types (TS4023 on `yarn build`). */

/** A run of text. */
export interface ITemplateTextLeaf {
  text: string;
}

/** A template reference, drawn as a chip. */
export interface ITemplateTextTag {
  type: 'tag';
  value: string;
  label: string;
  metadata?: unknown;
  children: ITemplateTextLeaf[];
}

/** One line of the string. */
export interface ITemplateTextParagraph {
  type: 'paragraph';
  children: Array<ITemplateTextLeaf | ITemplateTextTag>;
}

/**
 * What a reference chip says: the name the catalogue gives the reference, else
 * the reference as the DPQL Text view labels it (`local: name`), so the same
 * reference reads alike in the Visual builder and the Text view.
 *
 * `getTagLabel` only where the token IS reqraft's grammar. It reads a token as
 * `<key>: <path>` and drops the leading `$`, which is right for `$local:name`
 * and nonsense for a host's own spelling: an unnamed `$._case.mode` came out as
 * `._case.mode`, a string that is neither the reference nor a name for it. With
 * nothing to call it, the reference itself is the honest answer — the same
 * floor `describeTemplateReference` documents.
 */
export const templateChipLabel = (templates: IReqoreFormTemplates | undefined, value: string): string => {
  const { label, item } = describeTemplateReference(templates, value);
  if (item) {
    return label;
  }
  return value.includes(':') ? getTagLabel(value) : value;
};

// ---------------------------------------------------------------------------
// Finding the references in a string. ONE pass, used by both the editor's
// document and the read-only row: the two disagreeing about what counts as a
// reference is the whole defect this file exists to close, and the only way
// they cannot disagree is by asking the same question of the same code.
// ---------------------------------------------------------------------------

/**
 * Every value the catalogue offers, longest first.
 *
 * A host may write its references in a grammar reqraft has never seen — a Qorus
 * test spells one `$._case.mode`, which `TEMPLATE_TOKEN_SOURCE` cannot match
 * because it has no `$key:` at all. Asking the field's own list which strings
 * it NAMES settles that without reqraft guessing at anybody's syntax, and it is
 * the same question the whole-value branch of the read row already asks
 * (`findTemplate`).
 *
 * Longest first so `$.result.status` is recognised before `$.result`, which is
 * a prefix of it; `aliasValues` are included because a catalogue may spell the
 * same reference two ways (see `matchesTemplateValue`).
 */
/* Keyed on the catalogue's identity, because a form hands the SAME object to
   every row it draws and a row draws on every keystroke elsewhere in the form.
   Walking a 29-item catalogue per row per render is work with one answer. */
const catalogueValueCache = new WeakMap<object, string[]>();

const catalogueValues = (templates?: IReqoreFormTemplates): string[] => {
  if (!templates) {
    return [];
  }
  const cached = catalogueValueCache.get(templates as object);
  if (cached) {
    return cached;
  }

  const values = new Set<string>();

  const walk = (items?: ReadonlyArray<Record<string, any>>): void => {
    items?.forEach((item) => {
      if (typeof item?.value === 'string' && item.value) {
        values.add(item.value);
      }
      (item?.metadata as { aliasValues?: string[] } | undefined)?.aliasValues?.forEach((alias) => {
        if (typeof alias === 'string' && alias) {
          values.add(alias);
        }
      });
      walk(item?.items);
    });
  };

  walk((templates as { items?: ReadonlyArray<Record<string, any>> } | undefined)?.items);

  // `Array.from`, not a spread: this file is emitted by `tsconfig.prod.json`,
  // which targets ES5 and cannot down-level a Set spread without `downlevelIteration`.
  const sorted = Array.from(values).sort((a, b) => b.length - a.length);
  catalogueValueCache.set(templates as object, sorted);
  return sorted;
};

/** One recognised reference inside a line. */
interface ITokenSpan {
  start: number;
  end: number;
}

/**
 * Where a literal catalogue value occurs in `line`, as whole references only.
 *
 * The boundary check is what stops `$.result` being chipped out of the middle
 * of `$.result.status` when the catalogue names only the shorter one: a
 * reference that continues into a further path step is not the reference the
 * catalogue named, and half a path drawn as a name would be a lie about what
 * the value reads.
 */
const literalSpans = (line: string, literal: string): ITokenSpan[] => {
  const spans: ITokenSpan[] = [];
  let from = 0;
  for (;;) {
    const start = line.indexOf(literal, from);
    if (start === -1) {
      break;
    }
    const end = start + literal.length;
    const before = start > 0 ? line[start - 1] : '';
    const after = end < line.length ? line[end] : '';
    if (!/[\w$]/.test(before) && !/[\w.[]/.test(after)) {
      spans.push({ start, end });
    }
    from = start + 1;
  }
  return spans;
};

/** Where a grammar matches in `line`. A fresh expression each time: a shared
 *  `/g` instance carries `lastIndex` between calls. */
const patternSpans = (line: string, source: string): ITokenSpan[] => {
  const spans: ITokenSpan[] = [];
  const pattern = new RegExp(source, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match[0] === '') {
      pattern.lastIndex += 1;
      continue;
    }
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
};

/** A grammar as a source string, however the field declared it. */
const grammarSource = (grammar?: RegExp | string): string | undefined => {
  if (grammar instanceof RegExp) {
    return grammar.source;
  }
  return typeof grammar === 'string' && grammar ? grammar : undefined;
};

/**
 * The references one line holds, in order and non-overlapping.
 *
 * Three ways a reference is recognised, in the order a longer match wins:
 *
 *  1. the grammar the FIELD declares (`templateToken`), which is the only thing
 *     that knows the extent of a host's own spelling;
 *  2. reqraft's own token grammar, so `$local:name` embedded in prose is drawn
 *     the way the template picker would name it;
 *  3. any value the field's catalogue actually offers, so a host that declares
 *     no grammar still gets the references it named drawn as names.
 *
 * Overlaps resolve to the longest span starting earliest, so a catalogue entry
 * never carves a shorter name out of a longer reference.
 */
const lineReferenceSpans = (
  line: string,
  templates?: IReqoreFormTemplates,
  tokenGrammar?: RegExp | string
): ITokenSpan[] => {
  const declared = grammarSource(tokenGrammar);
  const candidates: ITokenSpan[] = [
    ...(declared ? patternSpans(line, declared) : []),
    ...patternSpans(line, TEMPLATE_TOKEN_SOURCE),
    ...catalogueValues(templates).flatMap((literal) => literalSpans(line, literal)),
  ].sort((a, b) => a.start - b.start || b.end - a.end);

  const spans: ITokenSpan[] = [];
  let cursor = 0;
  candidates.forEach((span) => {
    if (span.start < cursor) {
      // Already inside a reference that started earlier, or covered by a longer
      // one at the same position — either way it is not its own token.
      return;
    }
    spans.push(span);
    cursor = span.end;
  });
  return spans;
};

// ---------------------------------------------------------------------------
// The string as the EDITOR's document.
// ---------------------------------------------------------------------------

/**
 * `text` as paragraphs, one per line, with each template reference a chip.
 *
 * A chip is an inline VOID and holds no text of its own, so a cursor can only
 * sit in the text nodes around it; one is kept on each side even when empty.
 * The chip's label is `templateChipLabel`.
 *
 * `tokenGrammar` is the field's own `templateToken`, and it is the reason this
 * takes a third argument at all: without it the editor knew only reqraft's
 * built-in `$key:{path}` and drew a host's own spelling (`$._case.mode`) as raw
 * text, while the collapsed row that opens it — which IS given the grammar —
 * drew the same reference as a named chip. The two surfaces have to recognise
 * the same references, so they resolve them with the same
 * `lineReferenceSpans`.
 */
export const templateTextToNodes = (
  text: string,
  templates?: IReqoreFormTemplates,
  tokenGrammar?: RegExp | string
): ITemplateTextParagraph[] =>
  (text ?? '').split('\n').map((line) => {
    const children: ITemplateTextParagraph['children'] = [];
    let last = 0;
    lineReferenceSpans(line, templates, tokenGrammar).forEach((span) => {
      const value = line.slice(span.start, span.end);
      const { item } = describeTemplateReference(templates, value);
      children.push({ text: line.slice(last, span.start) });
      children.push({
        type: 'tag',
        value,
        label: templateChipLabel(templates, value),
        metadata: item?.metadata,
        children: [{ text: '' }],
      });
      last = span.end;
    });
    children.push({ text: line.slice(last) });
    return { type: 'paragraph' as const, children };
  });

/** The string the paragraphs stand for: each chip written as its reference. */
export const templateNodesToText = (nodes?: ReadonlyArray<{ children?: unknown[] }>): string =>
  (nodes ?? [])
    .map((paragraph: any) =>
      (paragraph?.children ?? [])
        .map((node: any) =>
          typeof node?.text === 'string' ? node.text
          : node?.type === 'tag' ? String(node.value ?? '')
          : ''
        )
        .join('')
    )
    .join('\n');

// ---------------------------------------------------------------------------
// The same string, drawn for READING rather than edited.
// ---------------------------------------------------------------------------

/**
 * `text` as prose runs and reference chips.
 *
 * The read-only twin of {@link templateTextToNodes}: the editor turns the same
 * string into chips a cursor can move around, this turns it into segments a row
 * can draw. A value is very often a reference INSIDE something the author
 * wrote — `$._case.mode != 'simulate'` — and the comparison is theirs and stays
 * exactly as typed; only the reference becomes a chip.
 *
 * Three ways a reference is recognised, in the order a longer match wins:
 *
 *  1. the grammar the FIELD declares (`templateToken`), which is the only thing
 *     that knows the extent of a host's own spelling;
 *  2. reqraft's own token grammar, so `$local:name` embedded in prose is drawn
 *     the way the template picker would name it;
 *  3. any value the field's catalogue actually offers, so a host that declares
 *     no grammar still gets the references it named drawn as names.
 *
 * Which references are recognised, and how overlaps resolve, is
 * `lineReferenceSpans` — the same answer {@link templateTextToNodes} builds the
 * editor's chips from.
 */
export const templateTextSegments = (
  text: string,
  templates?: IReqoreFormTemplates,
  tokenGrammar?: RegExp | string
): IRichtextSegment[] => {
  const source = String(text ?? '');
  if (!source) {
    return [];
  }

  const segments: IRichtextSegment[] = [];

  const pushText = (value: string): void => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last?.kind === 'text') {
      last.text += value;
    } else {
      segments.push({ kind: 'text', text: value });
    }
  };

  source.split('\n').forEach((line, lineIndex) => {
    if (lineIndex) {
      pushText('\n');
    }

    let cursor = 0;
    lineReferenceSpans(line, templates, tokenGrammar).forEach((span) => {
      pushText(line.slice(cursor, span.start));
      const value = line.slice(span.start, span.end);
      segments.push({ kind: 'tag', value, text: templateChipLabel(templates, value) });
      cursor = span.end;
    });

    pushText(line.slice(cursor));
  });

  return segments;
};

/** Does this text hold a reference at all? The one question a caller asks
 *  before deciding whether the chipped rendering applies — answered by the
 *  same pass that would draw it, so the two cannot disagree. */
export const hasTemplateText = (
  text: string,
  templates?: IReqoreFormTemplates,
  tokenGrammar?: RegExp | string
): boolean =>
  templateTextSegments(text, templates, tokenGrammar).some((segment) => segment.kind === 'tag');
