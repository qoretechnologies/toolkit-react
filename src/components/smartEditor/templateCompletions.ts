// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { builtInTypeLabel, TTypeLabel } from '../../helpers/qorusTypeCatalogue';
import { templateBaseType, templateType } from '../../helpers/templateType';
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
  if (editor.selection) {
    let start = ctx.cursorOffset - 1;
    while (start >= 0 && /[\w.:{}-]/.test(ctx.plainText[start])) start--;
    if (!(start >= 0 && TEMPLATE_SIGILS.has(ctx.plainText[start]))) start++;
    for (let left = ctx.cursorOffset - start; left > 0; left--) {
      Editor.deleteBackward(editor, { unit: 'character' });
    }
  }
  Transforms.insertNodes(editor, {
    type: 'tag',
    value,
    label: item.label,
    children: [{ text: '' }],
  } as any);
  Transforms.move(editor);
  try {
    ReactEditor.focus(editor);
  } catch {
    // the editor is not in the document
  }
};
