import { ReqoreControlGroup } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { memo } from 'react';
import { splitByteSize } from '../../../../helpers/common';
import NumberFormField from '../number/Number';
import { SelectFormField } from '../select/Select';

// IDE `byteSize.tsx` parity — the IDE offers exactly KiB/MiB. (GiB/TiB were a
// reqraft addition in FORM_FIELD_EXTRAS; trimmed for 1:1, re-add post-parity
// if needed.) SEAM: the IDE's mount-time `default_value` population is
// intentionally NOT ported — onChange stays edge-triggered; FormEngine
// materializes defaults at the form level.
const SIZE_UNITS = [{ value: 'KiB' }, { value: 'MiB' }];

export interface IByteSizeFormFieldProps {
  /** The combined byte-size string, e.g. `"512MiB"`. */
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  size?: TSizes;
  /** Unknown props (`aria-label`, …) forward to the primary (amount) input;
   * the IDE's ByteSizeField ignores extras. */
  [key: string]: unknown;
}

/**
 * A byte-size input — a numeric amount stacked with a unit selector
 * (`KiB`/`MiB`/…). The field value is the concatenated string the
 * server stores (`"512MiB"`).
 */
export const ByteSizeFormField = memo(
  ({ value, onChange, disabled, readOnly, size, ...rest }: IByteSizeFormFieldProps) => {
    const [amount, unit] = splitByteSize(value);

    return (
      <ReqoreControlGroup stack fluid size={size}>
        <NumberFormField
          {...(rest as any)}
          fluid
          value={amount}
          onChange={(next) => onChange?.(`${next ?? ''}${unit ?? ''}`)}
          disabled={disabled}
          readOnly={readOnly}
        />
        <SelectFormField
          items={SIZE_UNITS}
          value={unit}
          onChange={(next) => onChange?.(`${amount ?? ''}${next ?? ''}`)}
          disabled={disabled || readOnly}
        />
      </ReqoreControlGroup>
    );
  }
);

export default ByteSizeFormField;
