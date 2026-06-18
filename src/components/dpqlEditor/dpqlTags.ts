// Copyright 2026 Qore Technologies, s.r.o.
// DPQL tag rendering — colors per template prefix, field-meta tooltips,
// `getTagProps` callback for ReqoreRichTextEditor.

import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { ISlateElement } from '../smartEditor/types';
import { IDpqlFieldMeta } from './useDpqlSession';

/** Color scheme for tag rendering, keyed by template prefix. */
export const TEMPLATE_COLORS: Record<
  string,
  { bg: string; border: string; fg: string }
> = {
  data:        { bg: 'rgba(56, 132, 244, 0.22)', border: 'rgba(56, 132, 244, 0.55)', fg: '#7bb8ff' },
  local:       { bg: 'rgba(156, 86, 214, 0.22)', border: 'rgba(156, 86, 214, 0.55)', fg: '#c9a0f0' },
  timestamp:   { bg: 'rgba(72, 199, 142, 0.22)', border: 'rgba(72, 199, 142, 0.55)', fg: '#7ee6b8' },
  config:      { bg: 'rgba(230, 162, 60, 0.22)', border: 'rgba(230, 162, 60, 0.55)', fg: '#f0c878' },
  autovar:     { bg: 'rgba(214, 86, 156, 0.22)', border: 'rgba(214, 86, 156, 0.55)', fg: '#e8a0d0' },
  globalvar:   { bg: 'rgba(214, 86, 156, 0.22)', border: 'rgba(214, 86, 156, 0.55)', fg: '#e8a0d0' },
  localvar:    { bg: 'rgba(214, 86, 156, 0.22)', border: 'rgba(214, 86, 156, 0.55)', fg: '#e8a0d0' },
  dynamic:     { bg: 'rgba(230, 162, 60, 0.22)', border: 'rgba(230, 162, 60, 0.55)', fg: '#f0c878' },
  static:      { bg: 'rgba(230, 162, 60, 0.22)', border: 'rgba(230, 162, 60, 0.55)', fg: '#f0c878' },
  temp:        { bg: 'rgba(230, 162, 60, 0.22)', border: 'rgba(230, 162, 60, 0.55)', fg: '#f0c878' },
  step:        { bg: 'rgba(230, 162, 60, 0.22)', border: 'rgba(230, 162, 60, 0.55)', fg: '#f0c878' },
  foreach:     { bg: 'rgba(72, 199, 142, 0.22)', border: 'rgba(72, 199, 142, 0.55)', fg: '#7ee6b8' },
  for:         { bg: 'rgba(72, 199, 142, 0.22)', border: 'rgba(72, 199, 142, 0.55)', fg: '#7ee6b8' },
};

export const DEFAULT_TEMPLATE_COLOR = {
  bg: 'rgba(150, 150, 150, 0.22)',
  border: 'rgba(150, 150, 150, 0.55)',
  fg: '#c8c8c8',
};

export const FIELD_REF_COLOR = {
  bg: 'rgba(86, 182, 214, 0.22)',
  border: 'rgba(86, 182, 214, 0.55)',
  fg: '#7dd4f0',
};

export const getTemplatePrefixColor = (value: string): string => {
  const colonIdx = value.indexOf(':');
  const prefix = colonIdx > 1 ? value.slice(1, colonIdx).toLowerCase() : '';
  return (TEMPLATE_COLORS[prefix] || DEFAULT_TEMPLATE_COLOR).fg;
};

/**
 * Build the `tagRenderer` callback for DpqlEditor. Closes over the live
 * `fieldMeta` map so `@field` tooltips reflect the latest schema returned
 * by `dpql/setContext`.
 */
export function makeDpqlTagRenderer(fieldMeta: Record<string, IDpqlFieldMeta>) {
  return (tag: ISlateElement): IReqoreTagProps => {
    const tagValue = tag.value?.toString();
    if (!tagValue) return {};

    if (tagValue.startsWith('@')) {
      const fieldName = tagValue.slice(1);
      const meta = fieldMeta[fieldName];
      const tooltip = meta
        ? `${meta.display_name || fieldName}${
            meta.type?.name ? ` (${meta.type.name})` : ''
          }${meta.short_desc ? `\n${meta.short_desc}` : ''}`
        : undefined;

      return {
        icon: 'Database2Line',
        color: FIELD_REF_COLOR.fg as `#${string}`,
        tooltip,
        label: meta?.display_name || fieldName,
      };
    }

    if (tagValue.startsWith('$')) {
      return {
        icon: 'ExchangeDollarLine',
        color: getTemplatePrefixColor(tagValue) as `#${string}`,
      };
    }

    return {};
  };
}
