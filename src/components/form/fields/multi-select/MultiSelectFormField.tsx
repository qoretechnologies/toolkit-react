import { ReqoreMultiSelect } from '@qoretechnologies/reqore';
import { TReqoreMultiSelectItem } from '@qoretechnologies/reqore/dist/components/MultiSelect';
import { IQorusAllowedValue } from '@qoretechnologies/ts-toolkit';
import { memo, useMemo } from 'react';

export interface IMultiSelectFormFieldProps {
  /** Currently selected values (plain scalars) */
  value?: unknown[];
  /** The fixed list of allowed items */
  items: IQorusAllowedValue[];
  onChange: (value: unknown[]) => void;
  disabled?: boolean;
  size?: string;
}

/**
 * Simple multi-select built on top of ReqoreMultiSelect.
 * Used by FormField for `list` fields that have `element_allowed_values`.
 */
export const MultiSelectFormField = memo(
  ({ value = [], items, onChange, disabled, size }: IMultiSelectFormFieldProps) => {
    const reqoreItems = useMemo<TReqoreMultiSelectItem[]>(
      () =>
        items.map((item) => ({
          value: item.value?.value as string,
          label: item.display_name ?? String(item.value?.value ?? ''),
          description: item.short_desc || item.desc,
          disabled: !!item.disabled,
        })),
      [JSON.stringify(items)]
    );

    const selectedValues = useMemo<string[]>(
      () => (value as unknown[]).map(String),
      [JSON.stringify(value)]
    );

    return (
      <ReqoreMultiSelect
        items={reqoreItems}
        value={selectedValues}
        onValueChange={(selected) => onChange(selected as unknown[])}
        disabled={disabled}
        size={size as any}
      />
    );
  }
);
