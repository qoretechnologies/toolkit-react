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
import { pageLocale } from '../../../../helpers/locale';
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
import { TCronPart } from '../labels';

/** The parts of a cron expression, in the order it is written: the data key of each box, never its words. */
const CRON_PARTS: TCronPart[] = ['minute', 'hour', 'day', 'month', 'weekday'];

/**
 * The language cronstrue describes an expression in: the page's (`pageLocale`), where the host has loaded
 * cronstrue's words for it (`import 'cronstrue/locales/de'`), else English. Only a loaded one is asked for: cronstrue
 * warns of any other on the console. `de-AT` is `de`, `pt-BR` is `pt_BR`, as cronstrue names them.
 */
export const cronLocale = (locale = pageLocale()): string | undefined => {
  const loaded = (cronstrue as unknown as { locales?: Record<string, unknown> }).locales ?? {};
  const [language, region] = (locale ?? '').split('-');
  return [`${language}_${region}`, language].find((name) => name && loaded[name]);
};

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
  const words = useReqraftLabels().fields;
  const { message, isError } = useMemo(() => {
    try {
      return { message: cronstrue.toString(value, { locale: cronLocale() }) };
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
        {CRON_PARTS.map((part, index) => {
          return (
            <ReqoreInput
              {...(inputProps?.[index] ?? {})}
              key={part}
              aria-label={words.cronParts[part]}
              placeholder={words.cronParts[part]}
              onChange={(event) => {
                const cronData: Record<string, string> = {};
                [
                  cronData.minute = '',
                  cronData.hour = '',
                  cronData.day = '',
                  cronData.month = '',
                  cronData.weekday = '',
                ] = value.split(' ');
                cronData[part] = event.currentTarget.value;

                onChange?.(
                  `${cronData.minute} ${cronData.hour} ${cronData.day} ${cronData.month} ${cronData.weekday}`
                );
              }}
              value={value.split(' ')?.[index] ?? ''}
            />
          );
        })}

        <ReqoreButton
          fixed
          onClick={() => onChange?.('')}
          icon={'CloseLine'}
          aria-label={words.clearCron}
          tooltip={words.clearCron}
        />
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
