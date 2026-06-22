import { ReqoreMultiSelect } from '@qoretechnologies/reqore';
import { TReqoreMultiSelectItem } from '@qoretechnologies/reqore/dist/components/MultiSelect';
import { IQorusAllowedValue } from '@qoretechnologies/ts-toolkit';
import { memo, useMemo } from 'react';

export interface IMultiSelectFormFieldProps {
  /** Currently selected values (plain scalars) */
  value?: unknown[];
  /** The fixed list of allowed items */
  items: IQorusAllowedValue[];
  canCreateItems?: boolean;
  onChange: (value: unknown[]) => void;
  disabled?: boolean;
  size?: string;
}

/**
 * Multi-select built on top of ReqoreMultiSelect. Used by FormField for
 * `multi-select` fields and `list` fields with `element_allowed_values`.
 * Aligned to qorus-ide's `MultiSelectField` portable behaviour
 * (FIELD_STACK_REPORT batch): selected values missing from the allowed list
 * still render as chips, a `*` wildcard collapses the selection and disables
 * the other items, and item chips wrap with the description as tooltip. The
 * IDE's editor dialog / FieldEnhancer `reference` machinery is app-coupled
 * and not ported.
 */
export const MultiSelectFormField = memo(
  ({ value = [], items, onChange, disabled, size, canCreateItems }: IMultiSelectFormFieldProps) => {
    const selectedValues = useMemo<string[]>(
      () => (value as unknown[]).map(String),
      [JSON.stringify(value)]
    );

    const reqoreItems = useMemo<TReqoreMultiSelectItem[]>(() => {
      const base = items.map(
        (item): TReqoreMultiSelectItem => ({
          value: item.value?.value as string,
          label: item.display_name ?? String(item.value?.value ?? ''),
          description: item.short_desc || item.desc,
          tooltip: item.desc || item.short_desc,
          wrap: true,
          // IDE parity: when `*` is selected, every other item is disabled.
          disabled:
            !!item.disabled || (selectedValues.includes('*') && item.value?.value !== '*'),
        })
      );

      // IDE parity: selected values that aren't in the allowed list still
      // render as (removable) items.
      const extras = selectedValues
        .filter((val) => !base.some((item) => item.value === val))
        .map((val): TReqoreMultiSelectItem => ({ value: val, label: val, wrap: true }));

      return [...base, ...extras];
    }, [JSON.stringify(items), JSON.stringify(selectedValues)]);

    return (
      <ReqoreMultiSelect
        items={reqoreItems}
        value={selectedValues}
        onValueChange={(selected) => {
          // IDE parity: picking the `*` wildcard collapses the selection.
          onChange?.(selected.includes('*') ? ['*'] : (selected as unknown[]));
        }}
        disabled={disabled}
        size={size as any}
        selectedItemSize={size as any}
        canCreateItems={canCreateItems}
        enterKeySelects
        canRemoveItems
        showNoItemsMessage={false}
        selectorProps={{ useTargetWidth: false }}
      />
    );
  }
);
