// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A template's type, as a typed member of its row in a list of templates (qorus#646).
 *
 * A template kept its type only as its row's `badge`, which Reqore draws as it is: every list of templates said
 * "int" or "qoretechnologies/money" beside a template, and the badge could not be named, because the field read
 * it back as the template's type. `buildTemplates` now gives each template its type in `metadata.type` and its
 * base type, which Qorus gives with every template, in `metadata.baseType`; a list names the type in the badge
 * it draws (`styleTemplateItems`). These read the type wherever a template's row is.
 */

/** A row of a list of templates, as far as its type goes. */
export interface ITemplateTypeRow {
  /** What a template is written as; a group of templates has none. */
  value?: unknown;
  badge?: unknown;
  metadata?: { type?: unknown; baseType?: unknown } | Record<string, unknown>;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

/**
 * A template's type: its typed member (`metadata.type`), else its badge, where a host builds its own rows and keeps
 * the type there. A group of templates has no type: its badge names the app it comes from (`buildTemplates`), and
 * read as a type it was named "Unknown type".
 */
export const templateType = (row: ITemplateTypeRow | undefined): string | undefined =>
  text((row?.metadata as { type?: unknown } | undefined)?.type) ??
  (row?.value !== undefined ? text(row?.badge) : undefined);

/** The base type of a template's values (`metadata.baseType`), which Qorus gives with every template. */
export const templateBaseType = (row: ITemplateTypeRow | undefined): string | undefined =>
  text((row?.metadata as { baseType?: unknown } | undefined)?.baseType);
