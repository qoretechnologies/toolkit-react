// Ported verbatim from qorus-ide `src/components/Field/arrayAuto.tsx`
// (FIELD_STACK_REPORT batch) — the panel-per-item list editor the IDE's auto
// field renders for typed lists (each item is a full
// `TemplateField component={auto}` with templates and expressions).
//
// This intentionally coexists with reqraft's own compact `ArrayAutoField`
// (tags + renderItem seam), which `Field.tsx` — reqraft's dispatcher — keeps
// using. The ported auto field uses THIS one, matching the IDE 1:1.
//
// Seams: `IField`/`IFieldChange` types folded in locally; the IDE's debug
// `console.log`s removed; `StyledPairField` return-type annotation dropped.
import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqorePanel,
  ReqoreTag,
  ReqoreVerticalSpacer,
  useReqoreProperty,
} from '@qoretechnologies/reqore';
import { map, size } from 'lodash';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import { validateFieldWithResult } from '../../../../helpers/validations';
import { useWhyDidYouUpdate } from '../../../../hooks/useWhyDidYouUpdate';
// Direct imports — the cycle (ArrayAuto → TemplateField/auto → ArrayAuto) is
// safe the same way Field → AutoFormField → Field is.
import { AutoFormField } from '../auto/AutoFormField';
import { TemplateField } from '../template/TemplateField';

export const allowedTypes: string[] = ['string', 'int', 'float', 'date', 'file'];
const defaultValueByType = {
  string: undefined,
  int: undefined,
  float: undefined,
  date: undefined,
  file: undefined,
  hash: {},
  list: [],
};

export interface IArrayAutoProps {
  name?: string;
  onChange?: (name: string, value: any[]) => void;
  value?: any[];
  default_value?: any;
  display_name?: string;
  type?: string;
  /** Render each row's `arg_schema` sub-form in compact (read-first) mode,
   *  matching the parent engine. Deliberately NOT destructured below: it rides
   *  `...rest` into each row's `TemplateField` -> `AutoFormField`, whose `hash`
   *  case hands it to the nested `FormEngine`. Destructuring it here would break
   *  that chain and silently return every row to the classic layout. */
  compact?: boolean;
  [key: string]: any;
}

export const ArrayAuto = ({
  name,
  onChange,
  value = [],
  default_value,
  display_name,
  ...rest
}: IArrayAutoProps): any => {
  const confirmAction = useReqoreProperty('confirmAction');
  const [localValue, setLocalValue] = useState(value);

  useWhyDidYouUpdate(`Array Auto ${name}`, {
    name,
    onChange,
    value,
    default_value,
    display_name,
    ...rest,
  });

  useEffect(() => {
    setLocalValue(value);
  }, [JSON.stringify(value)]);

  useDebounce(
    () => {
      onChange?.(name, localValue);
    },
    300,
    [JSON.stringify(localValue)]
  );

  const addValue: () => void = () => {
    setLocalValue([...localValue, defaultValueByType[rest.type]]);
  };

  const handleRemoveClick: (id: number) => void = (id) => {
    setLocalValue(localValue.filter((_, idx) => idx !== id));
  };

  const handleChange: (idx: string, itemValue: any) => void = (idx, itemValue) => {
    const newValues = [...localValue];

    newValues[idx] = itemValue;

    setLocalValue(newValues);
  };

  const showValidationMessage = (value) => {
    const validationResult = validateFieldWithResult(rest.type, value);

    if (!validationResult.isValid) {
      return (
        <ReqoreControlGroup vertical>
          <ReqoreVerticalSpacer height={5} />
          <ReqoreTag
            intent='danger'
            size='tiny'
            minimal
            icon='ErrorWarningLine'
            label={validationResult.reason}
          />
        </ReqoreControlGroup>
      );
    }

    return null;
  };

  // Render list of auto fields
  return (
    <ReqoreControlGroup vertical fluid>
      {map(localValue, (val: string | number, idx: string) => (
        <ReqorePanel
          key={idx}
          label={`#${idx + 1}`}
          unMountContentOnCollapse={false}
          badge={display_name || name}
          collapsible
          responsiveActions={false}
          responsiveTitle={false}
          className='array-auto-item'
          collapseButtonProps={{
            transparent: true,
            style: {
              paddingLeft: 0,
              paddingRight: 0,
              minWidth: '10px',
            },
          }}
          size='small'
          minimal
          actions={[
            {
              show: size(localValue) !== 1 && !rest.disabled && !rest.readOnly,
              icon: 'DeleteBinLine',
              intent: 'danger',
              className: 'array-auto-item-remove',
              tooltip: 'Remove item',
              onClick: () =>
                confirmAction({
                  onConfirm: () => handleRemoveClick(Number(idx)),
                }),
              minimal: true,
            },
          ]}
        >
          <TemplateField
            key={idx}
            component={AutoFormField}
            {...rest}
            fluid
            allowCustomValues
            allowFunctions
            allowTemplates
            defaultType={rest.type}
            name={`${name}-${idx}`}
            value={val}
            onChange={(_name, value) => handleChange(idx, value)}
          />
          {showValidationMessage(val)}
        </ReqorePanel>
      ))}
      <ReqoreControlGroup fluid>
        <ReqoreButton
          onClick={addValue}
          icon='AddLine'
          rightIcon='AddLine'
          textAlign='center'
          customTheme={{
            main: '#22273b',
          }}
          size={rest.size}
          disabled={rest.disabled || rest.readOnly}
        >
          Add new item {display_name || name ? `for "${display_name || name}"` : null}
        </ReqoreButton>
      </ReqoreControlGroup>
    </ReqoreControlGroup>
  );
};
