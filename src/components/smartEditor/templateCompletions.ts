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
  TEMPLATE_NODE_KIND_LABELS,
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
 * The signs a template is asked for by, as it is typed: `$`, as a template is written, and `@`, as a field is
 * named in an expression - the list opens on either (`useLspAutocomplete`'s sigil tokens), so the template chosen
 * takes either's place.
 */
const TEMPLATE_SIGILS = new Set(['$', '@']);

/**
 * Inserts a template chosen from the completion list as the chip it is, in place of what was typed for it: the `$`
 * or `@` that opened the list and the word after it. The `@` stayed in front of the chip (qorus#646, David's
 * review): only a `$` was taken away.
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
    let start = ctx.cursorOffset - 1;
    while (start >= 0 && /[\w.:{}-]/.test(ctx.plainText[start])) start--;
    if (!(start >= 0 && TEMPLATE_SIGILS.has(ctx.plainText[start]))) start++;
    const typed = typedInTheText(editor);
    const extended = chipExtendedBy(editor, typed, value);
    for (
      let left = Math.min(ctx.cursorOffset - start, extended ? typed.length : Infinity);
      left > 0;
      left--
    ) {
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
  /** Taking it opens the picker at its members rather than writing it: a group. */
  opens?: boolean;
  /** The row that opens the picker at the top of the field's templates. */
  browseAll?: boolean;
  /** The section of the list it is listed in. */
  section?: string;
  /** What it is (State data, Context...) and its type, named: its badges. */
  kindLabel?: string;
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
  typeLabel: TTypeLabel = builtInTypeLabel
): ILspCompletionItem[] =>
  searchTemplateReferences(roots, typed).map((node) => {
    const opens = !!node.children?.length || !!node.loadChildren;
    const kindLabel = TEMPLATE_NODE_KIND_LABELS[node.kind];
    const type = node.type ? typeLabel(node.type, node.baseType) : undefined;
    const where = node.trail.length ? `in ${node.trail.join(' › ')}` : undefined;
    const data: ITemplateRowData = {
      templateNodeId: node.id,
      opens,
      section: node.kind === 'field' ? RECORD_FIELDS_LABEL : 'Templates',
      kindLabel,
      typeLabel: type,
    };
    const documentation = [node.description, node.source ? `From ${node.source}.` : undefined]
      .filter(Boolean)
      .join('\n\n');
    return {
      label: node.label,
      kind: node.kind === 'field' ? FIELD_KIND : TEMPLATE_KIND,
      detail: where,
      documentation: documentation ? { kind: 'markdown', value: documentation } : undefined,
      insertText: node.value ?? node.reference ?? node.label,
      // narrowed as it is typed by its reference: `$data:receive_order.ev` keeps Event type
      filterText: node.reference ?? node.label,
      data: data as Record<string, unknown>,
    };
  });

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
