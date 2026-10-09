// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreCustomTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import { TReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import type React from 'react';
import { mapCompletionKindToIcon } from './helpers';
import { COMPLETION_KIND_INTENTS } from './styling';
import { COMPLETION_KIND_CHIPS } from './useLspAutocomplete';

/*
 * One look for the two lists a field offers what can be written in (qorus#646, David: "use the same
 * components ... a consistent UX"): the completion list typing opens (`CompletionList`) and the list a field's
 * templates are browsed in (`TemplateBrowser`, kept apart because a large catalogue needs its hierarchy). Both
 * take their colour, their rows' font, and their kinds' icons and chips from here, so they cannot drift.
 */

/** The lists' own colour. */
export const COMPLETION_LIST_THEME: IReqoreCustomTheme = { main: '#1e0d29' };

/** A row's text: monospace, as what it writes. Module-scoped, so a memoized row keeps its reference. */
export const COMPLETION_ITEM_STYLE: React.CSSProperties = { fontFamily: 'monospace' };

/** The LSP completion kinds a template is drawn as: a record's field, and any other template. */
export const FIELD_KIND = 5;
export const TEMPLATE_KIND = 6;

/** A row's kind chip (Field, Variable, Function...), as the completion list draws it. */
export const kindBadge = (kind: number | undefined) =>
  kind !== undefined && COMPLETION_KIND_CHIPS[kind] ?
    {
      label: COMPLETION_KIND_CHIPS[kind],
      minimal: true as const,
      size: 'small' as const,
      intent: COMPLETION_KIND_INTENTS[kind],
    }
  : undefined;

/** The kind a template value is drawn as. */
export const templateKind = (value: unknown) =>
  typeof value === 'string' && value.startsWith('$record:') ? FIELD_KIND : TEMPLATE_KIND;

/**
 * A catalogue's rows drawn as the completion list draws its own: the kind's icon, the row's type as its
 * badge, its text monospace, compact and borderless. A group (a row with members and no value of its
 * own) keeps its icon and gets no chip. Members, the "+" that takes a record whole and the "?" that opens an
 * example are kept as they are.
 */
export const styleTemplateItems = <T extends TReqoreDropdownItem>(items?: T[]): T[] | undefined =>
  items?.map((item) => {
    const entry = item as T & {
      value?: unknown;
      badge?: unknown;
      items?: T[];
      style?: React.CSSProperties;
    };
    const isGroup =
      Array.isArray(entry.items) && entry.items.length > 0 && entry.value === undefined;
    const kind = isGroup ? undefined : templateKind(entry.value);
    return {
      ...entry,
      // the kind's icon, as the completion list draws it; the row's type stays its `badge`, which the field
      // reads as the type of the template chosen
      icon: kind !== undefined ? mapCompletionKindToIcon(kind) : (entry as { icon?: unknown }).icon,
      style: { ...COMPLETION_ITEM_STYLE, ...entry.style },
      compact: true,
      minimal: true,
      flat: true,
      // only a row with members carries `items`: Reqore draws a row whose `items` is empty as disabled
      ...(Array.isArray(entry.items) ? { items: styleTemplateItems(entry.items) } : {}),
    } as T;
  });
