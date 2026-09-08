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
