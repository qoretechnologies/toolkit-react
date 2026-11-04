// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { BaseEditor, Editor, Path, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { builtInTypeLabel, TTypeLabel } from '../../helpers/qorusTypeCatalogue';
import { templateBaseType, templateType } from '../../helpers/templateType';
import {
  ITemplateNode,
  RECORD_FIELDS_LABEL,
  searchTemplateReferences,
  allTemplateNodes,
  templateContextOf,
  templateContextsOf,
  WHOLE_TEMPLATE_CONTEXTS,
  wholeContextValue,
  TEMPLATE_NODE_KIND_LABELS,
  templateNodeIntent,
  TTemplateIntent,
  unbracedReference,
} from '../../helpers/templateTree';
import { ILspCompletionItem } from '../../utils/lspClient.types';
import { TCompletionInserter } from './types';

/** LSP completion kinds the list draws a field and a template with (`COMPLETION_KIND_CHIPS`). */
const FIELD_KIND = 5;
const TEMPLATE_KIND = 6;

type TTemplateItem = {
  label?: unknown;
  value?: unknown;
  badge?: unknown;
  /** The template's type and base type (`templateType`). */
  metadata?: Record<string, unknown>;
  description?: unknown;
  /** Where it comes from, as the host says (`withTemplateSources`): the first thing its row's detail says. */
  source?: unknown;
  items?: TTemplateItem[];
};

/**
 * The catalogue with each template marked with where it comes from, as the host says (the IDE: the app action
 * that captures it): the template picker showed it beside the template held, and every list of templates shows it
 * in the template's row (qorus#646). `sourceOf` answers for a template, not a group; nothing is changed where it
 * says nothing.
 */
export const withTemplateSources = <T extends { items?: unknown[] } | undefined>(
  templates: T,
  sourceOf?: (template: TTemplateItem) => string | undefined
): T => {
  if (!templates || !sourceOf) return templates;
  const mark = (list: TTemplateItem[] | undefined): TTemplateItem[] | undefined =>
    list?.map((item) => {
      const source = typeof item.value === 'string' && item.value ? sourceOf(item) : undefined;
      // `items` only on a group: a list draws a row with an `items` key and no members as disabled
      return {
        ...item,
        ...(Array.isArray(item.items) ? { items: mark(item.items) } : {}),
        ...(source ? { source } : {}),
      };
    });
  return { ...templates, items: mark(templates.items as TTemplateItem[] | undefined) };
};

/**
 * A field's templates as completion items, for `$` typed in a value's text (qorus#646): every template that can
 * be written, wherever it sits in the catalogue - found by what is typed after the `$`, in the one completion
 * list typing opens (`CompletionMenu`). Browsing the catalogue as a tree is the browse list's
 * (`TemplateBrowser`). A record's field (`$record:{name}`) is a Field, anything else a Variable; the groups it
 * is in and its type's name (`typeLabel`) are its detail (after where it comes from, when the host says), its
 * description its documentation.
 */
export const templateCompletionItems = (
  templates?: IReqoreFormTemplates,
  typeLabel: TTypeLabel = builtInTypeLabel
): ILspCompletionItem[] => {
  const items: ILspCompletionItem[] = [];
  const seen = new Set<string>();
  const walk = (list: TTemplateItem[] | undefined, trail: string[]) => {
    for (const item of list ?? []) {
      const label = typeof item.label === 'string' && item.label ? item.label : undefined;
      if (typeof item.value === 'string' && item.value && !seen.has(item.value)) {
        seen.add(item.value);
        const where = trail.join(' › ');
        // the template's type, named: never its code (qorus#646)
        const templateTypeName = templateType(item);
        const type =
          templateTypeName ? typeLabel(templateTypeName, templateBaseType(item)) : undefined;
        const source = typeof item.source === 'string' ? item.source : undefined;
        items.push({
          label: label ?? item.value,
          kind: item.value.startsWith('$record:') ? FIELD_KIND : TEMPLATE_KIND,
          detail: [source, where, type].filter(Boolean).join(' · ') || undefined,
          documentation:
            typeof item.description === 'string' && item.description.trim() ?
              { kind: 'markdown', value: item.description }
            : undefined,
          insertText: item.value,
          filterText: `${item.value} ${label ?? ''}`,
        });
      }
      if (Array.isArray(item.items)) walk(item.items, label ? [...trail, label] : trail);
    }
  };
  walk(templates?.items as TTemplateItem[] | undefined, []);
  return items;
};

/**
 * A reference being typed at the end of a text: a `$` and the template after it (`$data:receive_order.`), or an
 * `@` and the record field after it (`@po`) - an `@` that starts a word, not one in an email address. The one rule
 * for both what opens a text's template list (`RichText`) and what a pick from it takes the place of
 * (`templateChipInserter`): a pick that deleted what did not open the list took a word the author wrote with it.
 */
export const REFERENCE_BEING_TYPED = /(?:^|[^\p{L}\p{N}_.])([$@][\p{L}\p{M}\p{N}_.:{}[\]*-]*)$/u;

/**
 * Writes a completion as text in the place of what is typed of it (or of the chip it replaces): the reference of
 * a context, a state or a record taken to go on into (`$data:`, `$data:receive_order.`), which is completed on.
 */
export const templateTextInserter: TCompletionInserter = (item, editor, ctx) => {
  const value = item.insertText ?? item.label;
  if (ctx.replacementPath) {
    Editor.withoutNormalizing(editor, () => {
      Transforms.removeNodes(editor, { at: ctx.replacementPath });
      Transforms.insertNodes(editor, { text: value } as any, {
        at: ctx.replacementPath,
        select: true,
      });
    });
    focusEditor(editor);
    return;
  }
  if (editor.selection) {
    const typed = typedInTheText(editor);
    const written = /[$@][\w.:{}[\]*-]*$/.exec(typed)?.[0] ?? '';
    const extended = chipExtendedBy(editor, typed, value);
    for (let left = extended ? typed.length : written.length; left > 0; left--) {
      Editor.deleteBackward(editor, { unit: 'character' });
    }
    if (extended) {
      Transforms.removeNodes(editor, { at: extended });
    }
  }
  Transforms.insertText(editor, value);
  focusEditor(editor);
};

/**
 * Inserts a template chosen from the completion list or the picker as the chip it is, in place of what was typed
 * for it: the `$` or `@` that opened the list and the word after it (`REFERENCE_BEING_TYPED`). The `@` stayed in
 * front of the chip (qorus#646, David's review): only a `$` was taken away.
 *
 * Nothing else is deleted. A pick from the picker opened by a click in the text is asked for by no word, and it
 * took the word before the caret all the same: "SUP-" typed, the text clicked and a field picked read as the chip
 * alone (qorus#646, the IDE's Sheet Contract Review).
 */
export const templateChipInserter: TCompletionInserter = (item, editor, ctx) => {
  const value = item.insertText ?? item.label;
  if (ctx.replacementPath) {
    // a chip clicked and replaced: the pick takes its place
    Editor.withoutNormalizing(editor, () => {
      Transforms.removeNodes(editor, { at: ctx.replacementPath });
      Transforms.insertNodes(
        editor,
        { type: 'tag', value, label: item.label, children: [{ text: '' }] } as any,
        { at: ctx.replacementPath, select: true }
      );
    });
    Transforms.move(editor);
    focusEditor(editor);
    return;
  }
  if (editor.selection) {
    const typed = typedInTheText(editor);
    const written = REFERENCE_BEING_TYPED.exec(typed)?.[1] ?? '';
    const extended = chipExtendedBy(editor, typed, value);
    for (let left = extended ? typed.length : written.length; left > 0; left--) {
      Editor.deleteBackward(editor, { unit: 'character' });
    }
    if (extended) {
      Transforms.removeNodes(editor, { at: extended });
    }
  }
  Transforms.insertNodes(editor, {
    type: 'tag',
    value,
    label: item.label,
    children: [{ text: '' }],
  } as any);
  Transforms.move(editor);
  focusEditor(editor);
};

const focusEditor = (editor: BaseEditor) => {
  try {
    ReactEditor.focus(editor as ReactEditor);
  } catch {
    // the editor is not in the document
  }
};

/** What is typed before the caret in the text it is in: never anything across a chip. */
export const typedInTheText = (editor: BaseEditor): string => {
  const at = editor.selection?.anchor;
  if (!at) {
    return '';
  }
  try {
    const [node] = Editor.node(editor as unknown as Editor, at.path);
    return typeof (node as { text?: unknown }).text === 'string' ?
        (node as { text: string }).text.slice(0, at.offset)
      : '';
  } catch {
    // a path the editor no longer has: nothing was typed there
    return '';
  }
};

/**
 * The chip a pick goes on from, where what is typed after it continues its reference (qorus#646, David's review):
 * a state's chip (`$data:receive_order`) and `.` typed after it, then Event type picked, is the one reference
 * `$data:{receive_order.event_type}` - the pick takes the chip's place as well as the `.`. It was put in after the
 * chip, and the text read `$data:receive_order$data:{receive_order.event_type}`. Undefined where nothing but a
 * `.` or `[` and a name is typed straight after a chip whose reference the pick's starts with.
 */
export const chipExtendedBy = (
  editor: BaseEditor,
  typedBefore: string,
  value: string
): Path | undefined => {
  const at = editor.selection?.anchor;
  const continuation = /^[.[][^\s]*$/.exec(typedBefore)?.[0];
  if (!at || !continuation || at.path.length < 2 || at.path[at.path.length - 1] === 0) {
    return undefined;
  }
  const chipPath = [...at.path.slice(0, -1), at.path[at.path.length - 1] - 1];
  try {
    const [chip] = Editor.node(editor as unknown as Editor, chipPath);
    const chipValue =
      (chip as { type?: string; value?: unknown }).type === 'tag' ?
        (chip as { value?: unknown }).value
      : undefined;
    if (typeof chipValue !== 'string') {
      return undefined;
    }
    const goesOn = unbracedReference(`${chipValue}${continuation}`).toLowerCase();
    return unbracedReference(value).toLowerCase().startsWith(goesOn) ? chipPath : undefined;
  } catch {
    // no node before the text: nothing is gone on from
    return undefined;
  }
};

/** What a template row carries for the list (`ILspCompletionItem.data`): the node it is and how it is drawn. */
export interface ITemplateRowData {
  /** The node it is (`ITemplateNode.id`). */
  templateNodeId?: string;
  /** Taking it opens the picker at its members rather than writing it: a group no reference names. */
  opens?: boolean;
  /**
   * Taking it writes its reference as text and lists what is in it, as typing goes on into it: a context
   * (`$data:`), a state or a record (`$data:receive_order.`). Never a chip: a chip is a whole reference.
   */
  continues?: boolean;
  /** What "Use" writes for a group taken whole: its value (`$data:{receive_order}`). */
  wholeValue?: string;
  /** A group that can also be taken whole (a record, a Qog state's data): its row's "Use" writes it. */
  takesWhole?: boolean;
  /** The row that opens the picker at the top of the field's templates. */
  browseAll?: boolean;
  /** The section of the list it is listed in. */
  section?: string;
  /** What it is (State data, Context...) and its type, named: its badges; its kind's badge in its chip's color. */
  kindLabel?: string;
  kindIntent?: TTemplateIntent;
  typeLabel?: string;
}

/** The label of the row that opens the picker at the top of the field's templates. */
export const BROWSE_ALL_TEMPLATES = 'Browse all templates';

/**
 * The rows typing a reference offers (`$`, `$data:`, `$data:receive_order.`, `@na`): the nodes of the field's
 * templates and fields it reaches (`searchTemplateReferences`) - a group is a row that opens the picker at its
 * members - each saying where it is ("in Receive order"), not what group it is in as if that were what it is.
 * Nothing that does not go on from what is typed is listed (qorus#646, David's review).
 */
export const templateSearchItems = (
  roots: ITemplateNode[],
  typed: string,
  typeLabel: TTypeLabel = builtInTypeLabel,
  /** Whether the value takes a record: a context, a state or a record is then offered whole too (`Use`). */
  wholeRecords?: boolean
): ILspCompletionItem[] => {
  /* A `$` and a context's name being written: the contexts it starts, each written and gone on from - then, from
     two letters on, the templates named so (qorus#646, David: "`$` → contexts", each level filtered by what is
     typed of it). */
  const context = /^\$([\w-]*)$/.exec(typed);
  if (context) {
    const partial = context[1];
    const wanted = partial.toLowerCase();
    const named =
      partial.length >= 2 ?
        allTemplateNodes(roots).filter(
          (node) =>
            !!node.value &&
            !node.children?.length &&
            // a context of free keys is its context's row, above
            !node.writesKey &&
            node.label
              .toLowerCase()
              .split(/[^\p{L}\p{N}]+/u)
              .some((word) => word.startsWith(wanted))
        )
      : [];
    return onceEach([
      ...templateContextsOf(roots, partial, wholeRecords).map((node) =>
        templateRow(node, typeLabel)
      ),
      ...named.map((node) => templateRow(node, typeLabel)),
    ]);
  }
  /* A context of free keys (`$dynamic:*`) is completed by writing its key: no row stands for its keys once its
     context is written - the list says to write the key (`unlistedContextMessage`). A context Qorus reads whole
     is offered whole first, `$data:*`, where the value takes a record (qorus#646, David's review). */
  const inContext = /^(\$[\w-]+:)(\*?)$/.exec(typed);
  const known =
    roots.length > 0 &&
    allTemplateNodes(roots).some((node) => templateContextOf(node.reference) === inContext?.[1]);
  // what the field's catalogue says of the context, where it has one (`withTemplateCatalogue`); else as Qorus reads it
  const catalogued =
    inContext ?
      templateContextsOf(roots, inContext[1].slice(1, -1)).find(
        (node) => node.reference === inContext[1] && node.catalogue
      )
    : undefined;
  const readWhole =
    catalogued ?
      !!catalogued.catalogue!.use_whole
    : !!inContext && WHOLE_TEMPLATE_CONTEXTS.has(inContext[1].slice(1, -1));
  const whole =
    inContext && known && wholeRecords !== false && readWhole ?
      [wholeContextRow(inContext[1])]
    : [];
  return onceEach([
    ...whole,
    ...searchTemplateReferences(roots, typed)
      .filter((node) => !node.writesKey)
      .map((node) => templateRow(node, typeLabel)),
  ]);
};

/* Each reference once: a template a field lists in a group of its own (Context Data) and its catalogue lists in its
   context is one row, the first. */
const onceEach = (rows: ILspCompletionItem[]): ILspCompletionItem[] => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const written = unbracedReference(row.insertText ?? row.label);
    if (seen.has(written)) {
      return false;
    }
    seen.add(written);
    return true;
  });
};

/** The row for the whole of a context, `$data:*`: written as its chip. */
const wholeContextRow = (context: string): ILspCompletionItem => ({
  label: wholeContextValue(context),
  kind: TEMPLATE_KIND,
  detail: `all of ${context}`,
  insertText: wholeContextValue(context),
  filterText: wholeContextValue(context),
  data: { whole: true, section: 'Templates', kindLabel: 'Template context' } as Record<
    string,
    unknown
  >,
});

/** A node's row in the completion list. */
const templateRow = (node: ITemplateNode, typeLabel: TTypeLabel): ILspCompletionItem => {
  const group = !!node.children?.length || !!node.loadChildren;
  // a context written to go on into it (`$local:`): of the field's own templates, or of its catalogue
  const isContext =
    node.id.startsWith('context:') || (!!node.catalogue && /^\$[\w-]+:$/.test(node.reference ?? ''));
  /* A group that a reference names - a context, a state, a record - is gone on into as it is typed: taken, its
     reference is written and what is in it is listed (qorus#646, David: "accepting an intermediate level continues
     to the next level"). A group no reference names (Context Data) opens the picker at its members. */
  const continuation =
    isContext ? node.reference
    : group && node.reference && /^(?:\$[^:]*:.|@.)/.test(node.reference) ? `${node.reference}.`
    : undefined;
  const kindLabel = isContext ? 'Template context' : TEMPLATE_NODE_KIND_LABELS[node.kind];
  const type = node.type ? typeLabel(node.type, node.baseType) : undefined;
  const where = node.trail.length ? `in ${node.trail.join(' › ')}` : undefined;
  const data: ITemplateRowData = {
    templateNodeId: node.id,
    opens: group && !continuation,
    continues: !!continuation,
    // a context of keys written freely has none listed, and is taken whole all the same (`$dynamic:*`)
    takesWhole: (group || isContext) && !!node.takesWhole,
    wholeValue: (group || isContext) && node.takesWhole ? node.value : undefined,
    section: node.kind === 'field' ? RECORD_FIELDS_LABEL : 'Templates',
    kindLabel,
    kindIntent: templateNodeIntent(node),
    typeLabel: type,
  };
  /* Under its name: where it is, what it is and where it comes from - in the row, never a hover over its edge
     (qorus#646, David's review). */
  const said = [where, node.description, node.source ? `from ${node.source}` : undefined].filter(
    Boolean
  );
  return {
    label: node.label,
    kind: node.kind === 'field' ? FIELD_KIND : TEMPLATE_KIND,
    detail: said.length ? said.join(' · ') : undefined,
    insertText: continuation ?? node.value ?? node.reference ?? node.label,
    // narrowed as it is typed by its reference: `$data:receive_order.ev` keeps Event type
    filterText: node.reference ?? node.label,
    data: data as Record<string, unknown>,
  };
};

/** The row that opens the picker at the top of the field's templates: every template, browsed as they nest. */
export const browseAllTemplatesItem = (): ILspCompletionItem => ({
  label: BROWSE_ALL_TEMPLATES,
  kind: 19,
  insertText: '',
  filterText: '',
  documentation: {
    kind: 'markdown',
    value: 'Every template and field this value can use, by group.',
  },
  data: { browseAll: true, section: '' } as Record<string, unknown>,
});

/**
 * What the list says where a template context is written and nothing is listed in it (qorus#646, David's review:
 * a context picked was left as an unfinished template, the list gone): what to write next, the list held open.
 */
export const unlistedContextMessage = (before: string): string | undefined => {
  const context = /(\$[\w-]+:)[\w.]*$/.exec(before)?.[1];
  // said with the rows there are (the whole of it, Browse all templates) or in their place: true either way
  return context ?
      `Write what ${context} refers to after the ':', or pick from the list`
    : undefined;
};
