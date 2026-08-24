import { ReqoreControlGroup, useReqoreProperty } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { memo, useState } from 'react';
import {
  getLargestExactTimeoutUnit,
  TIMEOUT_UNITS,
  timeoutUnitSymbol,
  timeoutUnitToMs,
  TTimeoutUnit,
} from '../../../../helpers/common';
import NumberFormField from '../number/Number';
import { SelectFormField } from '../select/Select';

const UNIT_ITEMS = TIMEOUT_UNITS.map(({ value }) => ({ value }));

export interface ITimeoutFormFieldProps {
  /** Integer count of milliseconds — the shape the server stores. */
  value?: number;
  onChange?: (value?: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  size?: TSizes;
  /** Show unit symbols (ms/s/m/h) instead of full names. Defaults to the
   * viewport's phone-width flag. */
  abbreviateUnits?: boolean;
  /** Unknown props (`aria-label`, …) forward to the primary (amount) input. */
  [key: string]: unknown;
}

/**
 * A timeout input — a numeric amount stacked with a unit selector
 * (ms/seconds/minutes/hours). The field value stays the integer millisecond
 * count the server stores; the unit only scales the display, and changing it
 * re-interprets the shown amount (45 seconds → 45 minutes).
 */
export const TimeoutFormField = memo(
  ({ value, onChange, disabled, readOnly, size, abbreviateUnits, ...rest }: ITimeoutFormFieldProps) => {
    const isMobile = useReqoreProperty('isMobile');
    const shortUnits = abbreviateUnits ?? isMobile;
    // The ms value alone can't say whether 45000 should read "45 seconds" or
    // "45000 ms", so the unit is pinned once the user touches the field.
    // Until then — and whenever the controlled value stops dividing evenly by
    // the pin (a parent-side reset) — the largest exact unit wins, so the
    // display never rounds.
    const [pinnedUnit, setPinnedUnit] = useState<TTimeoutUnit>();
    const unit =
      pinnedUnit && (value == null || value % timeoutUnitToMs(pinnedUnit) === 0)
        ? pinnedUnit
        : getLargestExactTimeoutUnit(value);
    const amount = value != null ? value / timeoutUnitToMs(unit) : undefined;

    return (
      <ReqoreControlGroup stack fluid size={size}>
        <NumberFormField
          {...(rest as any)}
          fluid
          type='int'
          value={amount}
          onChange={(next) => {
            setPinnedUnit(unit);
            onChange?.(typeof next === 'number' ? next * timeoutUnitToMs(unit) : undefined);
          }}
          disabled={disabled}
          readOnly={readOnly}
        />
        <SelectFormField
          fixed
          hideItemCount
          items={UNIT_ITEMS}
          // Where space is tight only the trigger abbreviates — the open
          // picker keeps the full unit names.
          valueLabel={shortUnits ? timeoutUnitSymbol(unit) : undefined}
          value={unit}
          onChange={(next) => {
            setPinnedUnit(next as TTimeoutUnit);
            if (amount != null) {
              onChange?.(amount * timeoutUnitToMs(next as TTimeoutUnit));
            }
          }}
          disabled={disabled || readOnly}
        />
      </ReqoreControlGroup>
    );
  }
);

export default TimeoutFormField;
