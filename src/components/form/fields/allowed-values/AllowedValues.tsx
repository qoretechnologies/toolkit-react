// Ported verbatim from qorus-ide `src/components/AllowedValues/index.tsx`
// (FIELD_STACK_REPORT batch). Markup, props and the debounced local-value
// flow are preserved. Seams (IDE-only infrastructure, same classes as the
// ExpressionBuilder port):
// - `useSavedValues` — saved-values storage is IDE-only; `showSavedValues`
//   stays in the interface but contributes no items.
// - `useSubscriptionEvents` (CONNECTION_DELETED pruning) — dropped.
// - `ConnectionManagement` per-item actions — dropped (actions omitted).
// - `Select` → reqraft `SelectFormField` (`items` instead of `defaultItems`,
//   single-arg `onChange`; `type`/`closeCollectionOnUnMount` not forwarded).
import { ReqoreCheckbox, ReqoreControlGroup, ReqoreSpan } from '@qoretechnologies/reqore';
import { IReqoreButtonProps } from '@qoretechnologies/reqore/dist/components/Button';
import { IQorusAllowedValue, TQorusType } from '@qoretechnologies/ts-toolkit';
import { size as count, isEqual } from 'lodash';
import { memo, useMemo } from 'react';
import { getSelectItemShortDescription } from '../select/SelectCollection';
import { ISelectFormFieldItem, SelectFormField as Select } from '../select/Select';

export interface IFieldAllowedValuesProps extends Pick<
  IReqoreButtonProps,
  'size' | 'disabled' | 'readOnly'
> {
  items: IQorusAllowedValue[];
  type: TQorusType;
  value: unknown;
  name?: string;
  onChange: (name: string, value: unknown) => void;
  allowCreation?: boolean;
  showDescription?: boolean;
  app?: string;
  action?: string;
  showSavedValues?: boolean;
  forceDropdown?: boolean;
  [key: string]: any;
}

const DISALLOW_COMPACT_AO_TYPES = ['connection'];

export const FieldAllowedValuesCheckGroup = memo(
  ({
    items,
    multiSelect,
    onChange,
    name,
    value,
    ...rest
  }: Partial<Omit<IFieldAllowedValuesProps, 'items'>> & {
    multiSelect?: boolean;
    items: ISelectFormFieldItem[];
  }) => {
    return (
      <ReqoreControlGroup vertical size={rest.size || 'small'} gapSize='tiny'>
        <ReqoreSpan effect={{ opacity: 0.6, uppercase: true, weight: 'bold' }} size='tiny'>
          {multiSelect ? 'Select one or more:' : 'Select one:'}
        </ReqoreSpan>
        {items?.map((item) => (
          <ReqoreCheckbox
            margin='right'
            key={item.value?.toString()}
            label={item.display_name || JSON.stringify(item.value)}
            tooltip={getSelectItemShortDescription(item)}
            disabled={rest.disabled}
            readOnly={rest.readOnly}
            intent={item.value === value ? 'info' : undefined}
            checked={
              multiSelect
                ? Array.isArray(value) && value.some((v) => isEqual(v, item.value))
                : JSON.stringify(value) === JSON.stringify(item.value)
            }
            onClick={() => {
              if (multiSelect) {
                let newValue: unknown[] = Array.isArray(value) ? [...value] : [];

                if (newValue.some((v) => isEqual(v, item.value))) {
                  newValue = newValue.filter((v) => !isEqual(v, item.value));
                } else {
                  newValue.push(item.value);
                }

                onChange(name, newValue);
              } else {
                onChange(name, isEqual(value, item.value) ? undefined : item.value);
              }
            }}
          />
        ))}
      </ReqoreControlGroup>
    );
  }
);

export const FieldAllowedValues = memo(
  ({
    items = [],
    type,
    onChange,
    value,
    allowCreation,
    showSavedValues,
    showDescription,
    forceDropdown,
    size,
    disabled,
    name,
    readOnly,
  }: IFieldAllowedValuesProps) => {
    const fullItems = useMemo(() => {
      const result = [
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...items.map(({ metadata, value, ...rest }) => ({
          value: value?.value,
          ...rest,
        })),
      ] as ISelectFormFieldItem[];

      return result;
    }, [JSON.stringify(items), type, value, showSavedValues, disabled, readOnly]);

    const style = useMemo(() => ({ width: '100%' }), []);

    if (!count(fullItems) || type === 'enum' || (!count(items) && !showSavedValues)) {
      return null;
    }

    // These are simple allowed values
    if (count(items) && !allowCreation) {
      if (count(fullItems) <= 3 && !DISALLOW_COMPACT_AO_TYPES.includes(type)) {
        return (
          <FieldAllowedValuesCheckGroup
            items={fullItems}
            onChange={onChange}
            value={value}
            name={name}
          />
        );
      }

      return (
        <Select
          items={fullItems}
          value={value}
          onChange={(value) => onChange(name, value)}
          fluid
          fixed={false}
          showDescription={Boolean(showDescription || showDescription === undefined)}
          forceDropdown={forceDropdown}
          style={style}
          size={size}
          disabled={disabled}
        />
      );
    }

    return (
      <Select
        items={fullItems}
        onChange={(value) => onChange(name, value)}
        fluid
        fixed={false}
        showDescription={false}
        forceDropdown={forceDropdown}
        style={style}
        minimal
        placeholder={'Saved & Suggested Values'}
        size={size}
        disabled={disabled}
        icon='SaveFill'
      />
    );
  }
);
