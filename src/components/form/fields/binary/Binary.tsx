import { ReqoreControlGroup, ReqoreTextarea } from '@qoretechnologies/reqore';
import { IReqoreTextareaProps } from '@qoretechnologies/reqore/dist/components/Textarea';
import { ChangeEvent, memo, useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'react-use';
import { IFileFormFieldValue, ReqraftFileFormField } from '../file/File';

export interface IReqraftBinaryFormFieldProps extends Omit<IReqoreTextareaProps, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * Strip a `data:<mime-type>;base64,` prefix so the emitted value carries raw base64, matching the
 * canonical binary wire form the Qorus server expects. `ReqraftFileFormField` reads uploads with
 * `readAsDataURL`, so its `content` always carries that prefix.
 */
const stripDataUrlPrefix = (dataUrl: string): string => {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
};

/**
 * A field for binary values encoded as base64. The value can be typed or pasted directly into the
 * textarea, or populated by uploading a file — the upload reuses {@link ReqraftFileFormField} (the
 * shared Reqraft file picker / drop zone) rather than a bespoke dropzone; its data-URL content is
 * decoded to raw base64 for the field value.
 */
export const ReqraftBinaryFormField = memo(
  ({ value, onChange, ...rest }: IReqraftBinaryFormFieldProps) => {
    const [localValue, setLocalValue] = useState<string>(value ?? '');

    useEffect(() => {
      if (value !== localValue) {
        setLocalValue(value ?? '');
      }
    }, [value]);

    useDebounce(
      () => {
        if (localValue !== value) {
          onChange?.(localValue);
        }
      },
      100,
      [localValue, onChange]
    );

    const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>): void => {
      setLocalValue(event.target.value);
    }, []);

    const handleFileChange = useCallback(
      (file?: IFileFormFieldValue) => {
        const base64 = stripDataUrlPrefix(file?.content ?? '');
        setLocalValue(base64);
        onChange?.(base64);
      },
      [onChange]
    );

    return (
      <ReqoreControlGroup vertical fluid>
        <ReqoreTextarea
          scaleWithContent
          fluid
          value={localValue}
          onChange={handleChange}
          onClearClick={() => {
            setLocalValue('');
            onChange?.('');
          }}
          placeholder='Base64-encoded binary value'
          {...rest}
        />
        <ReqraftFileFormField disabled={rest.disabled} onChange={handleFileChange} />
      </ReqoreControlGroup>
    );
  }
);

export default ReqraftBinaryFormField;
