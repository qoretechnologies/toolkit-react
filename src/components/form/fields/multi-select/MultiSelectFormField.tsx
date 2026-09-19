import { ReqoreMultiSelect } from '@qoretechnologies/reqore';
import { TReqoreMultiSelectItem } from '@qoretechnologies/reqore/dist/components/MultiSelect';
import { IQorusAllowedValue } from '@qoretechnologies/ts-toolkit';
import { memo, useMemo } from 'react';
import {
  getSelectItemShortDescription,
  getSelectItemUnavailability,
  UNAVAILABLE_ITEM_CLASS,
} from '../select/SelectCollection';

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

    /**
     * The values this picker will not take, by their string form.
     *
     * Only a refusal the SERVER resolved reaches here: this component is handed
     * the raw `allowed_values`, not the mapped items the single-value pickers
     * build, so a value's own `depends_on` is not judged against the form —
     * see `design/UNAVAILABLE_ALLOWED_VALUES.md`.
     */
    const refusedValues = useMemo<Set<string>>(
      () =>
        new Set(
          items
            .filter(
              (item) =>
                !!getSelectItemUnavailability({
                  disabled: item.disabled,
                  messages: item.messages,
                })
            )
            .map((item) => String(item.value?.value ?? ''))
        ),
      [JSON.stringify(items)]
    );

    const reqoreItems = useMemo<TReqoreMultiSelectItem[]>(() => {
      const base = items.map(
        (item): TReqoreMultiSelectItem => {
          const description = getSelectItemShortDescription(item);
          /* Never reqore's `disabled` for a refused VALUE: it applies
             `DisabledElement` (`pointer-events: none`), which takes the row's
             tooltip with it — the one place the whole reason fits. The
             refusal itself is in `onValueChange` below, because reqore owns
             this list's selection and there is no per-row handler to drop. */
          const unavailable = getSelectItemUnavailability({
            disabled: item.disabled,
            messages: item.messages,
          });

          return {
            value: item.value?.value as string,
            label: item.display_name ?? String(item.value?.value ?? ''),
            description:
              unavailable ?
                [unavailable.title, unavailable.content, description].filter(Boolean).join(' — ')
              : description,
            tooltip: unavailable ? unavailable.content : undefined,
            icon: unavailable ? ('LockLine' as const) : undefined,
            className: unavailable ? UNAVAILABLE_ITEM_CLASS : undefined,
            effect: unavailable ? { opacity: 0.55 } : undefined,
            readOnly: !!unavailable,
            wrap: true,
            /* IDE parity: when `*` is selected, every other item is disabled.
               That one stays reqore's `disabled` — the wildcard is a state of
               the SELECTION rather than a refusal of the value, and it has no
               reason of its own to protect. */
            disabled: selectedValues.includes('*') && item.value?.value !== '*',
          };
        }
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
          /* The refusal, for the same reason the rows carry no `disabled`: the
             row itself has no handler to withhold, so this is where a refused
             value is dropped. A value already HELD is kept even once it is
             refused — the picker will not take it again, but clearing an
             answer the author gave because a sibling edit closed the value is
             worse than holding one the form can no longer offer.

             Before the wildcard, so that a refused `*` is refused too. */
          const accepted = selected.filter(
            (val) => selectedValues.includes(val) || !refusedValues.has(val)
          );

          // IDE parity: picking the `*` wildcard collapses the selection.
          onChange?.(accepted.includes('*') ? ['*'] : (accepted as unknown[]));
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
