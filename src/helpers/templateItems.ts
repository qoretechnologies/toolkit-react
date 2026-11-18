import { createElement, Fragment, ReactNode } from 'react';
import type { TMarkdownRenderer } from '../components/Description/markdownRendererContext';
import { markdownToProse } from './markdownText';
import { builtInTypeLabel, TTypeLabel } from './qorusTypeCatalogue';
import { templateBaseType, templateType } from './templateType';

/**
 * What a template picker should actually list.
 *
 * Pickers group templates by category, which is what makes a long catalogue
 * scannable. A LONE category buys nothing and costs a click: the author opens
 * the picker, sees one row naming the category, clicks it, and only then sees
 * the values — with a back arrow as the only other thing on offer. So a single
 * category is opened for them.
 *
 * Two or more categories keep the grouping, because there the headers are doing
 * real work. This only ever removes a step that could not have gone any other
 * way.
 *
 * Lives here rather than beside either picker: `TemplateField` renders the
 * "Select template" dropdown and `RichText` renders the in-editor `$` list, and
 * `TemplateField` already imports `RichText` — so a shared home is the only one
 * that does not close an import cycle.
 */
export const templateItemsToShow = <T,>(items: T[] | undefined): T[] | undefined => {
  if (items?.length !== 1) {
    return items;
  }
  const only = items[0] as { items?: unknown[] };
  return Array.isArray(only.items) && only.items.length ? (only.items as T[]) : items;
};

/**
 * A picker row's description, DRAWN.
 *
 * A description is prose, and a host that writes prose writes markdown: the
 * same author, in the same dialect, as the field descriptions and schema
 * messages this package already draws through the host's renderer. Left as a
 * string, a row explaining that a step needs a **Fixture Output** printed the
 * asterisks at the reader.
 *
 * WHERE THIS MAY BE CALLED, and why it is not simply done at the source: the
 * template list is a memo KEY in several places — `TemplateField` stringifies
 * both the incoming `templates` and the resolved `filteredTemplates`, and the
 * list is handed down to nested fields that stringify it again. `JSON.stringify`
 * throws on a React element's circular `_owner`, so an element anywhere in the
 * list takes the whole form down to a blank panel.
 *
 * So this runs at the LAST hop only — the call that hands items to a Reqore
 * control, after every key has been computed — and its result is never passed
 * on to anything that might stringify it. Reqore itself does not: it draws the
 * description into a `ReqoreTextEffect` and styled-components filters the prop
 * off the DOM.
 *
 * Without a host renderer a description reads as the prose its markdown renders
 * to (`markdownToProse`): the words, none of the marks, on the row's one line.
 */
export const renderTemplateItemDescriptions = <T,>(
  items: T[] | undefined,
  render: TMarkdownRenderer | undefined
): T[] | undefined => {
  if (!items?.length) {
    return items;
  }

  return items.map((item) => {
    const entry = item as { description?: unknown; items?: unknown };
    const next = { ...entry } as Record<string, unknown>;

    if (typeof entry.description === 'string' && entry.description.trim()) {
      /* `compact`, for the reason the context gives: a row is a constrained
         container, and markdown authored as a document opens with a heading
         that would outgrow the label above it. */
      next.description =
        render ? render({ value: entry.description, compact: true }) : markdownToProse(entry.description);
    }

    // Only when the item HAS children — writing the key unconditionally would
    // give every leaf an `items` a picker could read as an empty submenu.
    if (Array.isArray(entry.items)) {
      next.items = renderTemplateItemDescriptions(entry.items, render);
    }

    return next as T;
  });
};

/** What a value's row says under its name: what it said before, then its type in words, as the $ list's detail. */
const withTypeWords = (words: string, description: unknown): ReactNode => {
  if (description === undefined || description === null || description === '') {
    return words;
  }
  if (typeof description === 'string') {
    return `${description} · ${words}`;
  }
  // a description already drawn (`renderTemplateItemDescriptions`): the words on a line under it
  return createElement(
    Fragment,
    null,
    description as ReactNode,
    createElement('span', { style: { display: 'block' } }, words)
  );
};

/**
 * A list of templates whose values say their type in words, in their description ("For example: 1705496417 · Whole
 * number", last, as the $ list's detail says it), never as their badge (board r-ed-30; decision 026: no machine word in front of a business reader).
 * A row's badge said its type's code ("int"), and a reader choosing "the order's number" had a type name to read
 * past. The type stays the value's, a typed member (`metadata.type`) a field matches it by (`templateType`), also
 * where a host's row kept it only in its badge: that badge goes. Any other badge stays, and a group keeps its own
 * (the app it comes from).
 *
 * At the LAST hop only, as `renderTemplateItemDescriptions`: where a description is already drawn, the words are
 * drawn with it, and a drawn description must never reach a list that is stringified.
 */
export const sayTemplateTypesInWords = <T,>(
  items: T[] | undefined,
  typeLabel: TTypeLabel = builtInTypeLabel
): T[] | undefined =>
  items?.map((item) => {
    const entry = item as {
      value?: unknown;
      badge?: unknown;
      description?: unknown;
      items?: unknown;
      metadata?: Record<string, unknown>;
    };
    if (Array.isArray(entry.items) && entry.value === undefined) {
      return { ...entry, items: sayTemplateTypesInWords(entry.items as T[], typeLabel) } as T;
    }
    const type = templateType(entry);
    if (!type) {
      return item;
    }
    const words = typeLabel(type, templateBaseType(entry));
    // the badge goes where it was the type: a host's row that kept it only there, or kept it there too
    const badgeWasType = typeof entry.badge === 'string' && (entry.badge === type || !entry.metadata?.type);
    const { badge, ...rest } = entry;
    return {
      ...rest,
      ...(badgeWasType ? {} : { badge }),
      metadata: { ...entry.metadata, type },
      ...(words ? { description: withTypeWords(words, entry.description) } : {}),
    } as T;
  });
