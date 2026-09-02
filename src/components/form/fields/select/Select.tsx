import {
  ReqoreButton,
  ReqoreDropdown,
  ReqoreMenu,
  ReqoreMenuItem,
  ReqoreSingleSelect,
  ReqoreTag,
} from '@qoretechnologies/reqore';
import { IReqoreButtonProps, TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { TReqoreMultiSelectItem } from '@qoretechnologies/reqore/dist/components/MultiSelect';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { isEqual, size } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getSelectItemShortDescription,
  ISelectFieldCollectionItem,
  SelectFieldCollection,
} from './SelectCollection';

export type ISelectFormFieldItem = ISelectFieldCollectionItem;

export interface ISelectFormFieldProps {
  items?: ISelectFormFieldItem[];
  value?: unknown;
  onChange?: (value: unknown) => void;
  placeholder?: string;
  disabled?: boolean;
  predicate?: (value: unknown) => boolean;
  filters?: string[];
  autoSelect?: boolean;
  asMenu?: boolean;
  icon?: IReqoreIconName;
  showDescription?: 'tooltip' | boolean;
  /**
   * Renders the picker as a chip plus a searchable list, and lets a value that
   * no item offers be entered. The value the caller gets back is one of the
   * offered values, unchanged, whenever it matches one; a value created by the
   * author comes back as the string they typed, so only call this for a field
   * whose value is a string.
   */
  canCreateItems?: boolean;
  /** Label for the CLOSED trigger in place of the selected item's
   * `display_name` — the open list keeps the item labels (e.g. a unit symbol
   * on the trigger, full names in the picker). Ignored while nothing is
   * selected. */
  valueLabel?: string;
  showPlaceholder?: boolean;
  showRightIcon?: boolean;
  hideItemCount?: boolean;
  forceDropdown?: boolean;
  fluid?: boolean;
  flat?: boolean;
  intent?: TReqoreIntent;
  tooltip?: IReqoreButtonProps['tooltip'];
  size?: IReqoreButtonProps['size'];
  minimal?: boolean;
  [key: string]: unknown;
}

const valueToShow = (value: unknown) =>
  typeof value === 'object' ? JSON.stringify(value) : value?.toString();

const fixItems = (
  items: (ISelectFormFieldItem & { name?: unknown })[] = []
): ISelectFormFieldItem[] =>
  items.map((item) => ({
    ...item,
    display_name: item.display_name || item.name?.toString() || valueToShow(item.value),
    value: item.value ?? item.name,
  }));

export const SelectFormField = memo(
  ({
    items: rawItems = [],
    value,
    onChange,
    predicate,
    placeholder,
    disabled,
    autoSelect,
    asMenu,
    icon,
    filters,
    showDescription = true,
    canCreateItems,
    valueLabel,
    showPlaceholder = true,
    showRightIcon = true,
    hideItemCount,
    forceDropdown = true,
    fluid,
    flat,
    intent,
    // Renamed: `size` would shadow lodash's `size(items)` used below.
    size: componentSize,
    ...rest
  }: ISelectFormFieldProps) => {
    const [items, setItems] = useState<ISelectFormFieldItem[]>(fixItems(rawItems));
    const [collectionOpen, setCollectionOpen] = useState(false);

    useEffect(() => {
      setItems(fixItems(rawItems));
    }, [JSON.stringify(rawItems)]);

    const handleSelectClick = useCallback(
      (item: Partial<ISelectFormFieldItem>) => {
        if (isEqual(item.value, value)) {
          return;
        }
        onChange?.(item.value);
        setCollectionOpen(false);
      },
      [onChange, value]
    );

    const getItemDescription = useCallback(
      (itemValue: unknown) => {
        const item = items.find((item) => isEqual(item.value, itemValue));
        return getSelectItemShortDescription(item);
      },
      [items]
    );

    const filteredItems: ISelectFormFieldItem[] = useMemo((): ISelectFormFieldItem[] => {
      return items.filter((item) => {
        if (predicate) {
          return predicate(item.value);
        }
        return true;
      });
    }, [predicate, items]);

    const reqoreItems: IReqoreDropdownItem[] = useMemo(() => {
      return filteredItems.map((item) => ({
        label: item.display_name || valueToShow(item.value),
        description: getItemDescription(item.value) as string,
        value: item.value,
        selected: isEqual(item.value, value),
        intent: item.intent,
        disabled: item.disabled,
        onClick: () => handleSelectClick(item),
      }));
    }, [JSON.stringify(filteredItems), value]) as IReqoreDropdownItem[];

    const getItemShortDescription = useCallback(
      (itemName: unknown, defaultDesc = '') => {
        if (showDescription !== true) {
          return null;
        }
        if (!itemName) {
          return defaultDesc;
        }
        const item = items.find(
          (item) => isEqual(item.display_name, itemName) || isEqual(item.value, itemName)
        );
        return getSelectItemShortDescription(item, defaultDesc);
      },
      [items, showDescription]
    );

    const hasItemsWithDesc = useCallback((data: ISelectFormFieldItem[]) => {
      return data.some((item) => item.desc || item.short_desc);
    }, []);

    const hasItemsWithError = useCallback((data: ISelectFormFieldItem[]) => {
      return data.some(
        (item) =>
          item.intent === 'danger' || item.messages?.find((message) => message.intent === 'danger')
      );
    }, []);

    const hasError = useCallback(
      (data: ISelectFormFieldItem[], val?: unknown) => {
        if (!val) {
          return hasItemsWithError(data);
        }
        const item = data.find((item) => isEqual(item.value, val));
        return (
          item?.intent === 'danger' ||
          !!item?.messages?.find((message) => message.intent === 'danger')
        );
      },
      [hasItemsWithError]
    );

    const hasItemsWithWarning = useCallback((data: ISelectFormFieldItem[]) => {
      return data.some(
        (item) =>
          item.intent === 'warning' ||
          item.messages?.find((message) => message.intent === 'warning') ||
          (item.metadata as Record<string, unknown>)?.needs_auth
      );
    }, []);

    const hasWarning = useCallback(
      (data: ISelectFormFieldItem[], val?: unknown) => {
        if (!val) {
          return hasItemsWithWarning(data);
        }
        const item = data.find((item) => isEqual(item.value, val));
        return (
          item?.intent === 'warning' ||
          !!item?.messages?.find((message) => message.intent === 'warning') ||
          !!(item?.metadata as Record<string, unknown>)?.needs_auth
        );
      },
      [hasItemsWithWarning]
    );

    const getLabel = useCallback((data: ISelectFormFieldItem[], val: unknown) => {
      return data?.find((item) => isEqual(item.value, val))?.display_name || valueToShow(val);
    }, []);

    const getIcon = useCallback(
      (
        data: ISelectFormFieldItem[],
        val: unknown
      ): Pick<IReqoreButtonProps, 'icon' | 'leftIconProps'> => {
        const item = data?.find((item) => isEqual(item.value, val));
        if (item?.image) {
          return {
            icon: 'CheckboxBlankLine',
            leftIconProps: {
              image: item.image as string,
              size: '30px',
              rounded: true,
            },
          };
        }
        return {
          icon: item?.icon || (hasError(data, val) ? 'ErrorWarningLine' : icon),
        };
      },
      [icon]
    );

    const itemCount: TReqoreBadge = useMemo(
      () =>
        hideItemCount ? undefined : (
          {
            label: size(items),
            align: 'right' as const,
            flat: flat ?? false,
            intent:
              hasError(items) ? 'danger'
              : hasWarning(items) ? 'warning'
              : undefined,
          }
        ),
      [size(items), hideItemCount]
    );

    const autoSelectedItem = useMemo(
      () =>
        // Not when a value can be created: committing the sole offered item
        // takes the field straight past the one thing the author came to do.
        autoSelect && !canCreateItems && filteredItems.length === 1 && !filteredItems[0].disabled
          ? filteredItems[0]
          : undefined,
      [autoSelect, canCreateItems, filteredItems]
    );

    const creatableItems = useMemo<TReqoreMultiSelectItem[]>(
      () =>
        filteredItems.map((item) => ({
          value: valueToShow(item.value) as string,
          label: item.display_name || (valueToShow(item.value) as string),
          description: getItemDescription(item.value) as string,
          disabled: item.disabled,
          intent: item.intent,
          wrap: true,
        })),
      [filteredItems, getItemDescription]
    );

    const handleCreatableChange = useCallback(
      (next?: string) => {
        if (next === undefined) {
          onChange?.(undefined);
          return;
        }
        // The control deals in strings, so an OFFERED value goes back out as
        // the value the caller gave us — its own shape intact. Only a value
        // the author created is a string of their own making.
        const offered = filteredItems.find((item) => valueToShow(item.value) === next);
        onChange?.(offered ? offered.value : next);
      },
      [filteredItems, onChange]
    );

    // Selecting during render causes a parent-controlled field to synchronously
    // update while this component is still rendering. React rejects that update
    // and can enter an infinite render loop. Commit the derived default after
    // rendering instead; the button below already renders the sole item's label
    // while the controlled value catches up.
    useEffect(() => {
      const valueIsUnset = value === undefined || value === null || value === '';

      if (
        autoSelectedItem &&
        !disabled &&
        valueIsUnset &&
        !isEqual(autoSelectedItem.value, value)
      ) {
        handleSelectClick(autoSelectedItem);
      }
    }, [autoSelectedItem, disabled, handleSelectClick, value]);

    if (canCreateItems) {
      return (
        <ReqoreSingleSelect
          items={creatableItems}
          value={
            value === undefined || value === null ? undefined : (valueToShow(value) as string)
          }
          onValueChange={handleCreatableChange}
          canCreateItems
          enterKeySelects
          disabled={disabled}
          size={componentSize}
          selectedItemSize={componentSize}
          flat={flat}
          minimal={(rest as { minimal?: boolean }).minimal}
          // Only override reqore's own placeholder when the caller gave one:
          // `selectorProps` is spread over the default, so passing `undefined`
          // here would erase it and leave the search box unlabelled.
          selectorProps={{
            useTargetWidth: false,
            ...(placeholder ? { placeholder } : {}),
          }}
        />
      );
    }

    if (autoSelectedItem) {
      const itemHasError = hasError(items, autoSelectedItem.value);
      const itemHasWarning = hasWarning(items, autoSelectedItem.value);

      return (
        <ReqoreButton
          // Pass-through parity with the IDE's Select: unknown caller props
          // (className, id, tooltip, …) reach ReQore; the computed props
          // below stay authoritative.
          {...(rest as any)}
          fluid={fluid}
          flat={flat ?? false}
          size={componentSize}
          label={valueLabel ?? getLabel(items, value ?? autoSelectedItem.value)}
          description={getItemShortDescription(value as string) as string}
          readOnly
          fixed
          minimal
          {...getIcon(filteredItems, autoSelectedItem.value)}
          intent={
            itemHasError ? 'danger'
            : itemHasWarning ?
              'warning'
            : (intent ?? 'info')
          }
          disabled={false}
        />
      );
    }

    if (!filteredItems || filteredItems.length === 0) {
      return (
        <ReqoreTag
          {...(rest as any)}
          intent='muted'
          label='No data available'
          icon='ForbidLine'
          fixed
          size={componentSize}
        />
      );
    }

    return (
      <>
        {collectionOpen && (
          // SEAM (reqraft): the IDE mounts this collection modal at the app
          // root via its global `modalStore`, so clicks inside it never reach
          // the opener's React tree. Here the modal is rendered inline, and
          // React portal events bubble through it — a collapsible ancestor
          // (e.g. the ExpressionBuilder card whose title hosts this Select)
          // would treat an item click as a title-bar click and collapse.
          // `display: contents` keeps the barrier box-less.
          <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
            <SelectFieldCollection
              items={filteredItems}
              filters={filters}
              value={value}
              onItemSelect={handleSelectClick}
              onClose={() => setCollectionOpen(false)}
            />
          </div>
        )}
        {asMenu ?
          <ReqoreMenu>
            {filteredItems.map((item) => (
              <ReqoreMenuItem
                key={valueToShow(item.value)}
                label={item.display_name || valueToShow(item.value)}
                disabled={item.disabled}
                intent={item.intent}
                onClick={() => handleSelectClick(item)}
              />
            ))}
          </ReqoreMenu>
        : hasItemsWithDesc(items) && !forceDropdown ?
          <ReqoreButton
            {...(rest as any)}
            transparent={!value}
            minimal
            flat={flat}
            size={componentSize}
            intent={
              hasError(items, value) ? 'danger'
              : hasWarning(items, value) ?
                'warning'
              : value ?
                (intent ?? 'info')
              : intent
            }
            fluid={fluid}
            compact
            key={valueToShow(value) as string}
            badge={itemCount}
            {...getIcon(items, value)}
            rightIcon={showRightIcon ? 'ExpandUpDownLine' : undefined}
            onClick={(e) => {
              e.stopPropagation();
              setCollectionOpen(true);
            }}
            description={getItemShortDescription(value as string) as string}
            tooltip={rest.tooltip as IReqoreButtonProps['tooltip']}
            disabled={disabled}
          >
            {value ?
              (valueLabel ?? getLabel(items, value as string))
            : showPlaceholder ?
              placeholder || 'Please select'
            : undefined}
          </ReqoreButton>
        : <ReqoreDropdown
            {...(rest as any)}
            items={reqoreItems}
            listCustomTheme={{
              main: '#010811',
            }}
            filterable
            fluid={fluid}
            compact
            badge={itemCount}
            {...getIcon(items, value)}
            key={valueToShow(value) as string}
            disabled={disabled}
            readOnly={reqoreItems.length === 0}
            paging={{
              itemsPerPage: 20,
              infinite: true,
              includeBottomControls: false,
            }}
            description={getItemShortDescription(value as string) as string}
            minimal
            flat={flat}
            size={componentSize}
            intent={
              hasError(items, value) ? 'danger'
              : value ?
                (intent ?? 'info')
              : intent
            }
          >
            {value ?
              (valueLabel ?? getLabel(items, value as string))
            : showPlaceholder ?
              placeholder || 'Please select'
            : undefined}
          </ReqoreDropdown>
        }
      </>
    );
  }
);
