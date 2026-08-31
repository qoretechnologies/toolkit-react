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
import { recordIdentity } from '../../engine/readFirst';
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
  // The row this component just created, so its sub-form can open the field it
  // cannot be saved without. Only a row added HERE gets it: the rows already in
  // the value were added by an earlier session (or arrived from the server), and
  // opening one of those on mount would be this component reopening a decision
  // the author already made.
  const [justAddedIndex, setJustAddedIndex] = useState<number | undefined>(undefined);

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
    setJustAddedIndex(localValue.length);
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
      {map(localValue, (val: string | number, idx: string) => {
        // The same field the collapsed preview promotes, resolved by the same
        // definition — see `recordIdentity`. A list of seven methods headed
        // `#1 … #7` makes the reader open each one to find out which is which,
        // and heading them differently in the preview and the editor would make
        // one item answer to two names.
        const identity =
          val && typeof val === 'object' && !Array.isArray(val)
            ? recordIdentity(val as Record<string, unknown>, rest.arg_schema)
            : undefined;

        return (
        <ReqorePanel
          key={idx}
          // `#N` stays as the fallback: a row whose identifying field is still
          // empty (one just added) has nothing to be called yet, and a blank
          // heading would be worse than a number.
          label={identity?.text || `#${idx + 1}`}
          tooltip={identity?.label}
          unMountContentOnCollapse={false}
          // The position moves to the badge once the name owns the heading, so
          // "which of these is third" stays answerable.
          badge={identity ? `#${idx + 1}` : display_name || name}
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
            // AFTER `{...rest}` on purpose: this is the one prop that differs
            // per row, and spreading rest over it would give every row the same
            // answer. Rides TemplateField's `rest` into the row's AutoFormField,
            // which hands it to the row's nested FormEngine (case 'hash').
            expandFirstRequired={Number(idx) === justAddedIndex}
            value={val}
            onChange={(_name, value) => handleChange(idx, value)}
          />
          {showValidationMessage(val)}
        </ReqorePanel>
        );
      })}
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
