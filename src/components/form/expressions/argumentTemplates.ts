// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { getQorusTypes, IQorusTypeObject } from '../../../hooks/useQorusTypes';
import { filterTemplatesByType } from '../../../helpers/templates';
import { isSoftArgument, SOFT_CONVERTED_TYPES } from './argumentTypes';
import { IExpressionSchemaArg } from './types';

/**
 * The templates an argument offers: those whose type its schema type accepts. A soft argument (its signature type
 * `softint`, `*softstring`) takes every scalar Qorus converts, so it offers every scalar template, whatever control
 * it is drawn with; a true-or-false option offers only templates that hold true or false; an argument of any type
 * offers every template.
 */
export const getArgumentTemplates = (
  templates: IReqoreFormTemplates | undefined,
  schema: IExpressionSchemaArg | undefined,
  types: IQorusTypeObject[] = getQorusTypes()
): IReqoreFormTemplates | undefined => {
  if (!templates || !schema?.ui_type) {
    return templates;
  }
  if (!isSoftArgument(schema)) {
    return filterTemplatesByType(templates, schema.ui_type, false, types, schema.base_type);
  }
  // a template fits a soft argument when it fits its own type or any type it converts
  const fits = [schema.ui_type, ...SOFT_CONVERTED_TYPES].map((type) =>
    filterTemplatesByType(templates, type, false, types, schema.base_type)
  );
  return mergeTemplates(templates, fits);
};

/** The templates that are in any of `fits` (each a filtered copy of `all`), in `all`'s order. */
const mergeTemplates = (
  all: IReqoreFormTemplates,
  fits: IReqoreFormTemplates[]
): IReqoreFormTemplates => {
  const kept = new Set<string>();
  const collect = (items: any[] = []) =>
    items.forEach((item) => {
      if (item?.value !== undefined) kept.add(String(item.value));
      collect(item?.items);
    });
  fits.forEach((filtered) => collect(filtered.items as any[]));
  const keep = (items: any[] = []): any[] =>
    items.reduce((result: any[], item) => {
      if (item?.items) {
        const children = keep(item.items);
        if (children.length) result.push({ ...item, items: children });
      } else if (item?.value === undefined || kept.has(String(item.value))) {
        result.push(item);
      }
      return result;
    }, []);
  return { ...all, items: keep(all.items as any[]) } as IReqoreFormTemplates;
};

/* One filter per argument schema, so a template field handed it keeps the same function from one render to the
   next (it recomputes its list when the function changes). */
const filters = new WeakMap<IExpressionSchemaArg, (templates: IReqoreFormTemplates) => IReqoreFormTemplates>();

/**
 * The filter a template field applies to what an argument OFFERS (`filterTemplatesFunc`): the field keeps the whole
 * catalogue for naming a template the value already holds, so a value of another type keeps its chip's name.
 */
export const argumentTemplatesFilter = (
  schema: IExpressionSchemaArg | undefined
): ((templates: IReqoreFormTemplates) => IReqoreFormTemplates) | undefined => {
  if (!schema?.ui_type) {
    return undefined;
  }
  let filter = filters.get(schema);
  if (!filter) {
    filter = (templates) => getArgumentTemplates(templates, schema) ?? templates;
    filters.set(schema, filter);
  }
  return filter;
};
