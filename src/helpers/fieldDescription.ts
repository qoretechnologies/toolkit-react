/**
 * Does a field's long description say more than its one-line summary?
 *
 * The Qorus server copies a field's plain-text `short_desc` into its markdown
 * `desc` whenever the field declares no `desc` of its own
 * (`QorusMapManager::getUiFieldInfo()`), so a `desc` alone does not mean there
 * is anything more to read. Offering help on every field meant most help opened
 * a dialog repeating the line already under the field, which teaches people the
 * affordance is worth nothing. qorus-ide answers the same question the same way
 * (`getFieldLongDescription` in its `helpers/descriptions.ts`).
 */

/** Whitespace-, case- and trailing-full-stop-insensitive. */
const comparisonKey = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '')
    .toLowerCase();

/** Enough of markdown removed that `**Webhooks**` reads as the word it styles. */
const plainText = (markdown: string): string =>
  markdown
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2');

export const fieldHasLongDescription = (field?: {
  desc?: unknown;
  short_desc?: unknown;
}): boolean => {
  const long = typeof field?.desc === 'string' ? field.desc.trim() : '';
  if (!long) {
    return false;
  }
  const short = typeof field?.short_desc === 'string' ? field.short_desc.trim() : '';
  return !short || comparisonKey(short) !== comparisonKey(plainText(long));
};
