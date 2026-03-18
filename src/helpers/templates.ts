import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import {
  TReqoreDropdownItem,
  TReqoreDropdownItems,
} from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { cloneDeep } from 'lodash';

/**
 * Shared template string utilities.
 * Used by both validations and TemplateField.
 */

export const isValueTemplate = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return value.startsWith('$') && value.includes(':');
};

export const getTemplateKey = (value: string): string => {
  const [key] = value.split(':');
  return key.replace('$', '');
};

export const getTemplateValue = (value: string): string => {
  const colonIndex = value.indexOf(':');
  return value.substring(colonIndex + 1);
};

export const findTemplate = (
  templates: IReqoreFormTemplates,
  value: string
): TReqoreDropdownItem | undefined => {
  if (!value) return undefined;

  let result: TReqoreDropdownItem | undefined = undefined;

  const findItem = (items: TReqoreDropdownItems) => {
    items?.forEach((item) => {
      if (item.value === value) {
        result = item;
        return;
      }

      if (item.items) {
        findItem(item.items);
      }
    });
  };

  findItem(templates?.items);
  return result;
};

export const filterTemplatesByType = (
  templates: IReqoreFormTemplates = {},
  fieldType = 'string',
  hasArgSchema?: boolean
): IReqoreFormTemplates => {
  if (!templates?.items) {
    return templates;
  }

  if ((fieldType === 'hash' || fieldType === 'list') && hasArgSchema) {
    return templates;
  }

  const newTemplates = cloneDeep(templates);

  const filterItems = (items: TReqoreDropdownItems = []): TReqoreDropdownItems => {
    return items?.reduce((newItems: TReqoreDropdownItem[], subItem): TReqoreDropdownItem[] => {
      const newSubItem = cloneDeep(subItem);

      // Recurse into nested items
      if (newSubItem.items) {
        newSubItem.items = filterItems(newSubItem.items);
        if (newSubItem.items.length > 0) {
          return [...newItems, newSubItem];
        }
        return newItems;
      }

      const badge = subItem.badge as string;
      const isCompatible =
        !badge || badge === 'auto' || badge === fieldType || fieldType === 'auto' || fieldType === 'any';

      if (isCompatible) {
        return [...newItems, newSubItem];
      }

      return newItems;
    }, []);
  };

  newTemplates.items = filterItems(newTemplates.items);
  return newTemplates;
};
