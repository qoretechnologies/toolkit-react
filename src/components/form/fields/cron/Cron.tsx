import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreInput,
  ReqoreMessage,
} from '@qoretechnologies/reqore';
import { IReqoreControlGroupProps } from '@qoretechnologies/reqore/dist/components/ControlGroup';
import { IReqoreInputProps } from '@qoretechnologies/reqore/dist/components/Input';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import cronstrue from 'cronstrue';
import { useMemo } from 'react';

export interface ICronFormFieldProps {
  value?: string;
  onChange?(value: string): void;
  wrapperProps?: Partial<IReqoreControlGroupProps>;
  inputProps?: IReqoreInputProps[];
  size?: TSizes;
}

export const CronFormField = ({
  onChange,
  value = '',
  wrapperProps,
  inputProps,
  size,
}: ICronFormFieldProps) => {
  const { message, isError } = useMemo(() => {
    try {
      return { message: cronstrue.toString(value, {}) };
    } catch (message: any) {
      return {
        message,
        isError: true,
      };
    }
  }, [value]);

  return (
    <ReqoreControlGroup fluid stack={false} vertical gapSize='big' size={size} {...wrapperProps}>
      <ReqoreControlGroup fluid stack size={size}>
        {['Minute', 'Hour', 'Day', 'Month', 'Weekday'].map((label, index) => {
          return (
            <ReqoreInput
              {...(inputProps?.[index] ?? {})}
              key={index}
              aria-label={label}
              placeholder={label}
              onChange={(event) => {
                const cronData: Record<string, string> = {};
                [
                  cronData.minute = '',
                  cronData.hour = '',
                  cronData.day = '',
                  cronData.month = '',
                  cronData.weekday = '',
                ] = value.split(' ');
                cronData[label.toLowerCase() as any] = event.currentTarget.value;

                onChange?.(
                  `${cronData.minute} ${cronData.hour} ${cronData.day} ${cronData.month} ${cronData.weekday}`
                );
              }}
              value={value.split(' ')?.[index] ?? ''}
            />
          );
        })}

        <ReqoreButton fixed onClick={() => onChange('')} icon={'CloseLine'} />
      </ReqoreControlGroup>
      {value && (
        <ReqoreMessage intent={isError ? 'danger' : 'info'} opaque={false}>
          {message}
        </ReqoreMessage>
      )}
    </ReqoreControlGroup>
  );
};

export default CronFormField;
