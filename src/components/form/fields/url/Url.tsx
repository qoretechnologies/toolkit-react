// Ported verbatim from qorus-ide `src/components/Field/urlField.tsx`
// (FIELD_STACK_REPORT batch). Replaces the previous from-scratch single-input
// URL field (FORM_FIELD_EXTRAS) — the IDE renders a protocol picker + `://` +
// address, and the value-splitting (`getProtocol`/`getAddress`) handles `://`
// inside the address. Seams: the `qorus_instance`-gated remote protocols
// fetch (`options/remote?list`) is dropped; the `protocols` prop (with the
// IDE's default list) remains. reqraft API kept: single-arg `onChange(value)`.
import { ReqoreControlGroup, ReqoreP } from '@qoretechnologies/reqore';
import { memo, useEffect, useState } from 'react';
import { useUpdateEffect } from 'react-use';
import { getAddress, getProtocol } from '../../../../helpers/common';
import { SelectFormField } from '../select/Select';
import { StringFormField } from '../string/String';

// Re-exported so the existing public API (form barrel) keeps offering them;
// the implementations moved to `helpers/common.ts` for non-component use.
export { getAddress, getProtocol } from '../../../../helpers/common';

export interface IUrlFormFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  protocols?: string[];
  disabled?: boolean;
  [key: string]: any;
}

export const UrlFormField = memo(
  ({ value, onChange, disabled, protocols: protocolsProp, ...rest }: IUrlFormFieldProps) => {
    const [protocols] = useState<string[]>(protocolsProp || ['http', 'https', 'rest', 'rests']);
    const [protocol, setProtocol] = useState<string>(getProtocol(value));
    const [address, setAddress] = useState<string>(getAddress(value));

    // SEAM: `useUpdateEffect`, not the IDE's mount-firing `useEffect` —
    // onChange stays edge-triggered (the field never rewrites the consumer's
    // value on mount). The IDE's 2020-era mount emission normalized values
    // for consumers without a form layer; reqraft's FormEngine owns defaults,
    // and the `url` validator flags protocol-less values instead.
    useUpdateEffect(() => {
      onChange?.(`${protocol}://${address}`);
    }, [protocol, address]);

    useEffect(() => {
      setProtocol(getProtocol(value));
      setAddress(getAddress(value));
    }, [value]);

    const handleAddressChange = (newAddress: string) => {
      if (getProtocol(newAddress)) {
        setProtocol(getProtocol(newAddress));
      }

      setAddress(getAddress(newAddress));
    };

    return (
      <ReqoreControlGroup fluid>
        <SelectFormField
          fixed
          items={protocols.map((prot) => ({ value: prot }))}
          onChange={(v) => setProtocol(v as string)}
          value={protocol}
          disabled={disabled}
        />
        {/* IDE StringField renders its `label` as a muted paragraph beside
            the input — mirrored here since reqraft's StringFormField has no
            label prop. */}
        <ReqoreP intent='muted'>://</ReqoreP>
        {/* Rest props (`aria-label`, …) forward to the address input; the
            IDE's URLField ignores extras. */}
        <StringFormField
          {...(rest as any)}
          value={address}
          onChange={(v) => handleAddressChange(v)}
          disabled={disabled}
        />
      </ReqoreControlGroup>
    );
  }
);

export default UrlFormField;
