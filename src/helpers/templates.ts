import { modalStore } from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import {
  TReqoreDropdownItem,
  TReqoreDropdownItems,
} from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { cloneDeep, size } from 'lodash';
import { createElement } from 'react';
import { ReqraftTemplateExampleValueModal } from '../components/form/fields/template/ExampleValueModal';
import { areQorusTypesCompatible } from './expressions';

/**
 * The DOM ceiling for a serialized example value in a picker item — a
 * binary-carrying field's example (e.g. an email attachment body) can be an
 * entire base64 file, and it must not enter the item wholesale. The VISUAL
 * truncation is not this number: past the ceiling the item also gets a
 * single-line-ellipsis description (`descriptionEffect.noWrap`), which cuts at
 * the popover's ACTUAL rendered width — container-intrinsic, no breakpoints —
 * paired with the "?" action that shows the full value.
 */
export const TEMPLATE_EXAMPLE_PREVIEW_LENGTH = 150;

/**
 * Shared template string utilities.
 * Used by both validations and TemplateField.
 */

export type TTemplateMeta = { image?: string; builtIn?: boolean; isEventTrigger?: boolean };

export const getTemplateTagStyle = (
  meta?: TTemplateMeta
): { intent: 'success' | 'info' | 'custom1' } => {
  if (meta?.isEventTrigger) return { intent: 'success' };
  if (meta?.builtIn) return { intent: 'custom1' };
  return { intent: 'info' };
};

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

// Ported verbatim from qorus-ide `helpers/functions.tsx` (FIELD_STACK_REPORT
// batch) — the previous reqraft version used naive badge equality; the IDE
// routes compatibility through `areQorusTypesCompatible` (int↔string coercion
// etc.) and keeps top-level groups with their (possibly emptied) sub-items.
export const filterTemplatesByType = (
  templates: IReqoreFormTemplates = {},
  fieldType = 'string',
  hasArgSchema?: boolean
): IReqoreFormTemplates => {
  if ((fieldType === 'hash' || fieldType === 'list') && hasArgSchema) {
    return templates;
  }

  const newTemplates = cloneDeep(templates);

  const filterItems = (items: TReqoreDropdownItems = []): TReqoreDropdownItems => {
    return items?.reduce((newItems: TReqoreDropdownItem[], subItem): TReqoreDropdownItem[] => {
      const newSubItem = cloneDeep(subItem);
      const isCompatible = areQorusTypesCompatible(fieldType, subItem.badge as string);

      if (subItem.items) {
        newSubItem.items = filterItems(subItem.items);

        if (!size(newSubItem.items)) {
          delete newSubItem.items;
        }
      }

      if (size(newSubItem.items)) {
        if (!isCompatible) {
          return [
            ...newItems,
            {
              ...newSubItem,
              leftAction: undefined,
            },
          ];
        }

        return [...newItems, newSubItem];
      }

      if (isCompatible) {
        return [
          ...newItems,
          {
            ...newSubItem,
            leftAction: undefined,
          },
        ];
      }

      return newItems;
    }, []);
  };

  newTemplates.items = newTemplates.items?.reduce((newItems: TReqoreDropdownItem[], item) => {
    if (item.divider) {
      return [...newItems, item];
    }
    const subItems = filterItems(item.items);

    return [
      ...newItems,
      {
        ...item,
        items: subItems,
      },
    ];
  }, []);

  return newTemplates;
};

// --- buildTemplates — ported verbatim from qorus-ide `helpers/functions.tsx`
// (line ~870). Converts the server's `system/getContextData` payload into
// ReQore dropdown templates. SEAM (reqraft): the IDE's optional `states`
// (FSM validity) parameter is dropped — without it every group is valid.

interface ITemplateItemPayload {
  display_name?: string;
  value?: string;
  example_value?: unknown;
  type?: string;
  items?: ITemplateItemPayload[];
  data_role?: string;
}

export interface ITemplatesPayload {
  [dataId: string]: {
    display_name?: string;
    items?: ITemplateItemPayload[];
    app?: string;
    action?: string;
    short_desc?: string;
    internal?: boolean;
    builtin?: boolean;
    is_event_trigger?: boolean;
    data_role?: string;
    logo?: string;
  };
}

export const buildTemplates = (
  templates?: ITemplatesPayload
): IReqoreFormTemplates | undefined => {
  if (!templates || !Object.keys(templates).length) {
    return undefined;
  }

  const mapTemplates = (
    items: ITemplateItemPayload[] = [],
    app?: string,
    action?: string,
    logo?: string,
    display_name?: string,
    builtIn?: boolean,
    isEventTrigger?: boolean,
    dataRole?: string
  ): TReqoreDropdownItems =>
    items.map(
      ({
        display_name: itemDisplayName,
        value,
        example_value,
        type,
        items: childItems,
        data_role: itemDataRole,
      }): TReqoreDropdownItem => {
        const serializedExample =
          example_value !== undefined ? JSON.stringify(example_value) : undefined;
        const exampleIsLong =
          serializedExample !== undefined &&
          serializedExample.length > TEMPLATE_EXAMPLE_PREVIEW_LENGTH;

        const item: TReqoreDropdownItem = {
          label: itemDisplayName,
          description: serializedExample
            ? `Example value: ${
                exampleIsLong
                  ? `${serializedExample.slice(0, TEMPLATE_EXAMPLE_PREVIEW_LENGTH)}…`
                  : serializedExample
              }`
            : undefined,
          // Ellipsize ONLY where the "?" full-value affordance exists — for a
          // short value an ellipsis would hide information with no way to
          // reveal it. The single line cuts at the rendered width, so the
          // preview adapts to any popover/panel width without breakpoints.
          descriptionEffect: exampleIsLong ? { noWrap: true } : undefined,
          badge: type,
          metadata: {
            image: logo,
            displayName: display_name,
            builtIn,
            isEventTrigger,
            app,
            action,
            dataRole: itemDataRole || dataRole,
          },
          value,
          flat: false,
          transparent: false,
          minimal: true,
        };

        if (exampleIsLong) {
          // Menu-item actions stop propagation, so the click never selects or
          // expands the item. The modal rides reqore's global modal queue
          // (rendered by the provider portal), so no host component is needed
          // — the modals wrapper injects `isOpen`/`onClose` itself.
          item.rightAction = {
            icon: 'QuestionLine',
            compact: true,
            tooltip: 'Show the full example value',
            onClick: () => {
              modalStore.getState().addModal(
                createElement(ReqraftTemplateExampleValueModal, {
                  label: itemDisplayName,
                  value: serializedExample,
                })
              );
            },
          };
        }

        if (childItems?.length) {
          item.items = mapTemplates(
            childItems,
            app,
            action,
            logo,
            display_name,
            builtIn,
            isEventTrigger,
            dataRole
          );
          item.stackWithActions = false;
          item.leftAction = {
            icon: 'AddCircleLine',
            compact: true,
            tooltip: 'Select this item',
            onClick: (_event, _itemId, _closePopover, metadata) => {
              (metadata as { selectItem?: () => void })?.selectItem?.();
            },
          };
        }

        return item;
      }
    );

  return {
    items: Object.values(templates).map(
      ({
        display_name,
        items,
        app,
        action,
        short_desc,
        builtin,
        is_event_trigger,
        data_role,
        logo,
      }): TReqoreDropdownItem => ({
        label: display_name,
        description: short_desc,
        flat: false,
        transparent: false,
        minimal: true,
        leftIconProps: {
          image: logo,
        },
        badge: app,
        metadata: {
          dataRole: data_role,
        },
        items: mapTemplates(
          items,
          app,
          action,
          logo,
          display_name,
          builtin,
          is_event_trigger,
          data_role
        ),
      })
    ),
  } as IReqoreFormTemplates;
};
