// Copyright 2026 Qore Technologies, s.r.o.
// DPQL tag rendering — colors per template prefix, field-meta tooltips,
// `getTagProps` callback for ReqoreRichTextEditor.

import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { descriptionTooltip, IDescriptionTooltipOptions } from '../../helpers/descriptionTooltip';
import {
  describeTemplateReference,
  getTemplateTagStyle,
  REFERENCE_CHIP_PROPS,
  templateTooltip,
  TTemplateMeta,
} from '../../helpers/templates';
import { recordTemplateOfReference } from '../../helpers/recordFieldReference';
import { templateChipLabel } from '../../helpers/templateText';
import { ISlateElement } from '../smartEditor/types';
import { dpqlFieldName } from './dpqlHelpers';
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

export interface IDpqlTagRendererOptions {
  /**
   * Draw a template (`$…`) chip as every other template chip is drawn - in a value's text, a template field, a
   * read row (`getTemplateTagStyle`): `info`, or the catalogue entry's built-in (`custom1`) or event-trigger
   * (`success`) intent. The default (qorus#646, David's review: a template picked on a value's Value tab was blue
   * there and gray on its Expression tab). `false` keeps the per-prefix palette (`TEMPLATE_COLORS`), which drew a
   * prefix it did not list (`$record:`) gray.
   */
  templateTagsUseIntent?: boolean;
  /**
   * The template catalogue the surface offers. A reference found in it reads
   * as the name it was chosen by — `trim(Choices[0].message.content)` rather
   * than the `$data:{…}` path — with the entry's description as its hover; one
   * that is not found keeps its path.
   */
  templates?: IReqoreFormTemplates;
  /**
   * How the editor shows a description's card (`useDescriptionTooltips`): a field's and a template's
   * description is markdown, drawn as the template list draws it, and opened by a tap on a touch screen.
   */
  descriptions?: IDescriptionTooltipOptions;
}

/**
 * Build the `tagRenderer` callback for DpqlEditor. Closes over the live
 * `fieldMeta` map so `@field` tooltips reflect the latest schema returned
 * by `dpql/setContext`.
 */
export function makeDpqlTagRenderer(
  fieldMeta: Record<string, IDpqlFieldMeta>,
  options: IDpqlTagRendererOptions = {}
) {
  /**
   * A template's chip, as every view draws it: its catalogue name and description, else `<key>: <path>`. A field
   * gives its own hover (`field`): the record's description of it, or none, so that the server's hover is the one
   * shown and the chip's text is not repeated as its tooltip.
   */
  const templateChip = (
    template: string,
    field?: { tooltip: IReqoreTagProps['tooltip'] }
  ): IReqoreTagProps => {
    const named = options.templates && describeTemplateReference(options.templates, template);
    return {
      ...REFERENCE_CHIP_PROPS,
      icon: 'ExchangeDollarLine',
      /* the catalogue's name for it; else a template keeps the label its element was given (`<key>: <path>`), and a
         field, whose element is labeled with its name, says the template's */
      ...(named?.item ? { label: named.label }
      : field ? { label: templateChipLabel(options.templates, template) }
      : {}),
      ...(named?.item ? { tooltip: templateTooltip(options.templates, template, options.descriptions ?? {}) }
      : field ? { tooltip: field.tooltip }
      : {}),
      ...(options.templateTagsUseIntent === false ?
        { color: getTemplatePrefixColor(template) as `#${string}` }
      : getTemplateTagStyle(named?.item?.metadata as TTemplateMeta | undefined)),
    };
  };

  return (tag: ISlateElement): IReqoreTagProps => {
    const tagValue = tag.value?.toString();
    if (!tagValue) return {};

    /* A field, `@name`, quoted `@"order-id"` or with its accessors `@orders[*].id`, is a field of the record: the
       same record field a value holds as `$record:{orders[*].id}`, and drawn as that chip - its color, its icon
       and its label, `record: orders[*].id` (qorus#646, David: one chip for one record field). The record's own
       description of the field is its hover where the catalogue does not describe it. */
    const fieldName = dpqlFieldName(tagValue);
    if (fieldName !== undefined) {
      const meta = fieldMeta[fieldName];
      // the field's name and type head the card, and its description is drawn under them
      const tooltip =
        meta ?
          descriptionTooltip(
            meta.short_desc,
            options.descriptions ?? {},
            `${meta.display_name || fieldName}${meta.type?.name ? ` (${meta.type.name})` : ''}`
          )
        : undefined;
      const template = recordTemplateOfReference(tagValue);
      return template ?
          templateChip(template, { tooltip })
        : {
            ...REFERENCE_CHIP_PROPS,
            icon: 'ExchangeDollarLine',
            label: fieldName,
            tooltip,
            ...getTemplateTagStyle(undefined),
          };
    }

    if (tagValue.startsWith('$')) {
      return templateChip(tagValue);
    }

    return {};
  };
}
