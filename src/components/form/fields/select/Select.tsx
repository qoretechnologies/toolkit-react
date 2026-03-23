import {
  ReqoreButton,
  ReqoreDropdown,
  ReqoreMenu,
  ReqoreMenuItem,
  ReqoreTag,
} from '@qoretechnologies/reqore';
import { IReqoreButtonProps, TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqoreDropdownItem } from '@qoretechnologies/reqore/dist/components/Dropdown/list';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { isEqual, size } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ISelectFieldCollectionItem, SelectFieldCollection } from './SelectCollection';

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
  showPlaceholder?: boolean;
  showRightIcon?: boolean;
  hideItemCount?: boolean;
  forceDropdown?: boolean;
  fluid?: boolean;
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
    showPlaceholder = true,
    showRightIcon = true,
    hideItemCount,
    forceDropdown,
    fluid,
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
      },
      [onChange, value]
    );

    const getItemDescription = useCallback(
      (itemValue: unknown) => {
        const item = items.find((item) => isEqual(item.value, itemValue));
        return item?.desc || item?.short_desc;
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
        return item?.short_desc || (item?.desc ? 'Hover to see description' : defaultDesc);
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
            flat: false,
            intent:
              hasError(items) ? 'danger'
              : hasWarning(items) ? 'warning'
              : undefined,
          }
        ),
      [size(items), hideItemCount]
    );

    if (autoSelect && filteredItems.length === 1 && !filteredItems[0].disabled) {
      if (!disabled && !isEqual(filteredItems[0].value, value) && !value) {
        handleSelectClick(filteredItems[0]);
      }

      const itemHasError = hasError(items, filteredItems[0].value);
      const itemHasWarning = hasWarning(items, filteredItems[0].value);

      return (
        <ReqoreButton
          fluid={fluid}
          flat={false}
          label={getLabel(items, value ?? filteredItems[0].value)}
          description={getItemShortDescription(value as string) as string}
          readOnly
          fixed
          minimal
          {...getIcon(filteredItems, filteredItems[0].value)}
          intent={
            itemHasError ? 'danger'
            : itemHasWarning ?
              'warning'
            : 'info'
          }
          disabled={false}
        />
      );
    }

    if (!filteredItems || filteredItems.length === 0) {
      return <ReqoreTag intent='muted' label='No data available' icon='ForbidLine' fixed />;
    }

    return (
      <>
        {collectionOpen && (
          <SelectFieldCollection
            items={filteredItems}
            filters={filters}
            getItemDescription={(v) => getItemDescription(v) as string}
            value={value}
            onItemSelect={handleSelectClick}
            onClose={() => setCollectionOpen(false)}
          />
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
            transparent={!value}
            minimal
            intent={
              hasError(items, value) ? 'danger'
              : hasWarning(items, value) ?
                'warning'
              : value ?
                'info'
              : (rest.intent as TReqoreIntent)
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
              getLabel(items, value as string)
            : showPlaceholder ?
              placeholder || 'Please select'
            : undefined}
          </ReqoreButton>
        : <ReqoreDropdown
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
            intent={
              hasError(items, value) ? 'danger'
              : value ?
                'info'
              : (rest.intent as TReqoreIntent)
            }
          >
            {value ?
              getLabel(items, value as string)
            : showPlaceholder ?
              placeholder || 'Please select'
            : undefined}
          </ReqoreDropdown>
        }
      </>
    );
  }
);
