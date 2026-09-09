import type { TMarkdownRenderer } from '../components/Description/markdownRendererContext';

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
 * "Select Template" dropdown and `RichText` renders the in-editor `$` list, and
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
 * Without a host renderer the items are returned untouched, so a host that has
 * no markdown keeps exactly what it had.
 */
export const renderTemplateItemDescriptions = <T,>(
  items: T[] | undefined,
  render: TMarkdownRenderer | undefined
): T[] | undefined => {
  if (!render || !items?.length) {
    return items;
  }

  return items.map((item) => {
    const entry = item as { description?: unknown; items?: unknown };
    const next = { ...entry } as Record<string, unknown>;

    if (typeof entry.description === 'string' && entry.description.trim()) {
      /* `compact`, for the reason the context gives: a row is a constrained
         container, and markdown authored as a document opens with a heading
         that would outgrow the label above it. */
      next.description = render({ value: entry.description, compact: true });
    }

    // Only when the item HAS children — writing the key unconditionally would
    // give every leaf an `items` a picker could read as an empty submenu.
    if (Array.isArray(entry.items)) {
      next.items = renderTemplateItemDescriptions(entry.items, render);
    }

    return next as T;
  });
};
