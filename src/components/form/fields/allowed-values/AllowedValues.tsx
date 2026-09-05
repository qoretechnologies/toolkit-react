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

/**
 * Whether a creatable field's value is carried by the chip picker rather than
 * by a raw editor with a suggestion list beside it.
 *
 * String-valued only, and only with something to suggest. Every other shape a
 * creatable field can declare either does not fit a one-line chip (a document
 * — `long-string`, `binary`, `data`; a hash; a list) or would come back out of
 * one as a string (a number, a date), and a field with nothing to offer is
 * better served by the editor it has always had. Those keep today's rendering:
 * the raw editor, with the saved-and-suggested picker under it.
 *
 * `select-string` counts, and leaving it out was the bug. A picker field
 * declares its storage type (`*string`) and its `ui_type` (`select-string`),
 * and by the time a schema reaches here the two have been flattened to one:
 * `type` arrives as `select-string`. So this returned false for every such
 * field and NEITHER renderer stood down — the picker drew the value, and the
 * saved-and-suggested list drew the same candidates again underneath it. A
 * test's Service and Method fields showed 183 and 7 items twice over, in two
 * controls that set one value. A select-string's value IS a string and fits the
 * chip, which is the only thing this predicate is really asking.
 *
 * Both the renderer of the picker (`FieldAllowedValues`) and the renderer of
 * the raw editor (`AutoFormField`, `FormField`) ask this, so that exactly one
 * of them draws the value.
 */
export const rendersCreatableValueSelect = (
  type?: string,
  allowCreation?: boolean,
  items?: unknown[]
): boolean =>
  !!allowCreation && (type === 'string' || type === 'select-string') && count(items) > 0;

export const FieldAllowedValuesCheckGroup = memo(
  ({
    items,
    multiSelect,
    onChange,
    name,
    value,
    label,
    ...rest
  }: Partial<Omit<IFieldAllowedValuesProps, 'items'>> & {
    multiSelect?: boolean;
    items: ISelectFormFieldItem[];
    /**
     * The field's own name, used as the group's heading.
     *
     * A picker headed by what it IS beats one headed by a generic instruction:
     * "Select one:" says nothing the shape of a radio group has not already
     * said, and in a container that absorbs a sibling it forced the field's name
     * to be printed a second time beside the group. Falls back to the
     * instruction when a field declares no display name.
     */
    label?: string;
  }) => {
    return (
      <ReqoreControlGroup vertical size={rest.size || 'small'} gapSize='tiny'>
        <ReqoreSpan effect={{ opacity: 0.6, uppercase: true, weight: 'bold' }} size='tiny'>
          {label ? `${label}:`
          : multiSelect ? 'Select one or more:'
          : 'Select one:'}
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
            // `isEqual`, and only once there is a value to match. The single
            // -select branch compared JSON.stringify(value) with
            // JSON.stringify(item.value), and JSON.stringify(undefined) is
            // undefined — so an unset field whose items carry no resolved value
            // compared undefined with undefined and reported EVERY option as
            // checked, on a field that was simultaneously "This field is
            // required". Nothing selected must read as nothing selected.
            checked={
              multiSelect
                ? Array.isArray(value) && value.some((v) => isEqual(v, item.value))
                : value !== undefined && value !== null && isEqual(value, item.value)
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
    label,
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

    // Creatable, and the value fits a chip: ONE control that both holds the
    // value and offers the candidates, instead of a raw editor with a
    // value-less suggestion picker beside it. The author sees what is set
    // without having to read a path out of a text box.
    if (rendersCreatableValueSelect(type, allowCreation, items)) {
      return (
        <Select
          items={fullItems}
          value={value}
          onChange={(value) => onChange(name, value)}
          canCreateItems
          fluid
          fixed={false}
          showDescription={Boolean(showDescription || showDescription === undefined)}
          style={style}
          size={size}
          disabled={disabled || readOnly}
        />
      );
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
            label={label}
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
