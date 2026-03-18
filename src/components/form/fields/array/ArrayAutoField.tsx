import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqorePanel,
  ReqoreTag,
  ReqoreVerticalSpacer,
  useReqoreProperty,
} from '@qoretechnologies/reqore';
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { map, size } from 'lodash';
import { memo, useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import { validateFieldWithResult } from '../../../../helpers/validations';

export interface IArrayAutoFieldProps {
  name: string;
  value?: unknown[];
  display_name?: string;
  type?: string;
  arg_schema?: IQorusFormSchema;
  disabled?: boolean;
  readOnly?: boolean;
  size?: string;
  allowed_values?: unknown[];
  allowed_values_creatable?: boolean;
  onChange: (name: string, value: unknown[] | undefined) => void;
  /** Render function for each item — avoids circular FormField → ArrayAutoField → FormField */
  renderItem: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    index: number;
    type?: string;
    arg_schema?: IQorusFormSchema;
    allowed_values?: unknown[];
    allowed_values_creatable?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    size?: string;
  }) => React.ReactNode;
}

const defaultValueByType: Record<string, unknown> = {
  string: undefined,
  int: undefined,
  float: undefined,
  date: undefined,
  hash: {},
  list: [],
};

export const ArrayAutoField = memo(
  ({
    name,
    onChange,
    value = [],
    display_name,
    type,
    arg_schema,
    allowed_values,
    allowed_values_creatable,
    disabled,
    readOnly,
    size: fieldSize,
    renderItem,
  }: IArrayAutoFieldProps) => {
    const confirmAction = useReqoreProperty('confirmAction');
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
      setLocalValue(value);
    }, [JSON.stringify(value)]);

    useDebounce(
      () => {
        onChange(name, localValue);
      },
      300,
      [JSON.stringify(localValue)]
    );

    const addItem = useCallback(() => {
      setLocalValue((prev) => [...(prev || []), defaultValueByType[type] ?? undefined]);
    }, [type]);

    const removeItem = useCallback(
      (idx: number) => {
        setLocalValue((prev) => (prev || []).filter((_, i) => i !== idx));
      },
      []
    );

    const handleItemChange = useCallback((idx: number, itemValue: unknown) => {
      setLocalValue((prev) => {
        const next = [...(prev || [])];
        next[idx] = itemValue;
        return next;
      });
    }, []);

    const renderValidationMessage = (val: unknown) => {
      if (!type) return null;
      const result = validateFieldWithResult(type, val);
      if (!result.isValid) {
        return (
          <ReqoreControlGroup vertical>
            <ReqoreVerticalSpacer height={5} />
            <ReqoreTag
              intent='danger'
              size='tiny'
              minimal
              icon='ErrorWarningLine'
              label={result.reason}
            />
          </ReqoreControlGroup>
        );
      }
      return null;
    };

    return (
      <ReqoreControlGroup vertical fluid>
        {map(localValue, (val, idx) => (
          <ReqorePanel
            key={idx}
            label={`#${idx + 1}`}
            badge={display_name || name}
            collapsible
            unMountContentOnCollapse={false}
            responsiveActions={false}
            responsiveTitle={false}
            className='array-auto-item'
            collapseButtonProps={{
              transparent: true,
              style: { paddingLeft: 0, paddingRight: 0, minWidth: '10px' },
            }}
            size='small'
            minimal
            actions={[
              {
                show: size(localValue) !== 1 && !disabled && !readOnly,
                icon: 'DeleteBinLine',
                intent: 'danger',
                className: 'array-auto-item-remove',
                tooltip: 'Remove item',
                onClick: () => confirmAction({ onConfirm: () => removeItem(idx) }),
                minimal: true,
              },
            ]}
          >
            {renderItem({
              value: val,
              onChange: (v) => handleItemChange(idx, v),
              index: idx,
              type,
              arg_schema,
              allowed_values,
              allowed_values_creatable,
              disabled,
              readOnly,
              size: fieldSize,
            })}
            {renderValidationMessage(val)}
          </ReqorePanel>
        ))}

        <ReqoreButton
          onClick={addItem}
          icon='AddLine'
          rightIcon='AddLine'
          textAlign='center'
          customTheme={{ main: '#22273b' }}
          size={fieldSize as any}
          disabled={disabled || readOnly}
        >
          Add new item {display_name || name ? `for "${display_name || name}"` : null}
        </ReqoreButton>
      </ReqoreControlGroup>
    );
  }
);
