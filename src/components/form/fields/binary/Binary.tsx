import { ReqoreButton, ReqoreControlGroup, ReqorePanel, ReqoreTextarea } from '@qoretechnologies/reqore';
import { IReqoreTextareaProps } from '@qoretechnologies/reqore/dist/components/Textarea';
import { ChangeEvent, memo, useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDebounce } from 'react-use';

export interface IReqraftBinaryFormFieldProps extends Omit<IReqoreTextareaProps, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * Strip a `data:<mime-type>;base64,` prefix so the emitted value carries raw base64, matching the
 * canonical binary wire form the Qorus server expects.
 */
const stripDataUrlPrefix = (dataUrl: string): string => {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
};

/**
 * A field for binary values encoded as base64. The value can be typed or pasted directly, or populated by
 * uploading a file, which is read and base64-encoded client-side.
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

    const handleDrop = useCallback(
      (files: File[]) => {
        const file = files[0];
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = stripDataUrlPrefix(reader.result as string);
          setLocalValue(base64);
          onChange?.(base64);
        };
        reader.onerror = () => {
          // Surface the failure rather than silently swallowing it (a corrupt
          // file, a permissions error, etc.). The value is left untouched.
          console.error('ReqraftBinaryFormField: failed to read file', file.name, reader.error);
        };
        reader.readAsDataURL(file);
      },
      [onChange]
    );

    const { getRootProps, getInputProps } = useDropzone({
      maxFiles: 1,
      multiple: false,
      disabled: rest.disabled,
      onDrop: handleDrop,
    });

    const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>): void => {
      setLocalValue(event.target.value);
    }, []);

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
        <ReqorePanel flat rounded padded={false} {...getRootProps()}>
          {/* hidden file input required by react-dropzone (same pattern as the File field) */}
          <input {...getInputProps()} />
          <ReqoreButton icon='Upload2Line' minimal fluid disabled={rest.disabled}>
            Upload a file to encode as base64
          </ReqoreButton>
        </ReqorePanel>
      </ReqoreControlGroup>
    );
  }
);

export default ReqraftBinaryFormField;
