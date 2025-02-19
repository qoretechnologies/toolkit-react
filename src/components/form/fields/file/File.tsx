import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreH4,
  ReqoreIcon,
  ReqoreP,
  ReqorePanel,
} from '@qoretechnologies/reqore';
import { IReqoreButtonProps } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqorePanelProps } from '@qoretechnologies/reqore/dist/components/Panel';
import { filesize } from 'filesize';
import { reduce, size } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import { Accept, DropzoneOptions, useDropzone } from 'react-dropzone';

export interface IReqraftFileFormFieldValue {
  name: string;
  content: string;
  size?: number;
}
export interface IReqraftFileFormFieldProps extends Omit<IReqorePanelProps, 'onChange'> {
  value: IReqraftFileFormFieldValue;
  onChange(value: IReqraftFileFormFieldValue): void;
  readonly?: boolean;
  options?: DropzoneOptions;
  valueButtonProps?: IReqoreButtonProps;
}

export const ReqraftFileFormField = ({
  value,
  onChange,
  options = {},
  valueButtonProps = {},
  ...rest
}: IReqraftFileFormFieldProps) => {
  const contentStyle: React.CSSProperties = useMemo(
    (): React.CSSProperties => ({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }),
    []
  );

  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    disabled: rest.disabled || rest.readonly,
    maxFiles: 1,

    ...options,
  });

  const extensions = useMemo(() => {
    if (!options.accept) {
      return [];
    }

    return reduce<Accept, string[]>(
      options.accept,
      (acc, ext) => {
        return [...acc, ...ext];
      },
      []
    );
  }, [options.accept]);

  const renderExtensions = useCallback(
    (asString?: boolean) => {
      if (size(extensions) === 0) {
        return '';
      }

      if (asString) {
        return extensions.join(', ');
      }

      return (
        <ReqoreP intent='muted' size='small'>
          {extensions.join(', ')}
        </ReqoreP>
      );
    },
    [extensions]
  );

  useEffect(() => {
    if (acceptedFiles.length === 0) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      onChange({
        name: acceptedFiles[0].name,
        content: reader.result as string,
        size: acceptedFiles[0].size,
      });
    };

    reader.readAsDataURL(acceptedFiles[0]);
  }, [acceptedFiles]);

  if (value) {
    return (
      <>
        <input {...getInputProps()} />
        <ReqoreButton
          label={value.name}
          minimal
          intent='info'
          icon='FileLine'
          rightIcon='FileUploadLine'
          badge={filesize(value.size || 0)}
          description={`Click here to upload a different ${renderExtensions(true)} file`}
          {...valueButtonProps}
          {...getRootProps()}
        />
      </>
    );
  }

  return (
    <ReqorePanel contentStyle={contentStyle} {...rest} {...getRootProps()} size='huge'>
      <input {...getInputProps()} />
      <ReqoreControlGroup vertical horizontalAlign='center'>
        <ReqoreH4 size='small'>
          <ReqoreIcon icon='FileAddLine' size='small' /> Click or drop files here to upload
        </ReqoreH4>
        {renderExtensions()}
      </ReqoreControlGroup>
    </ReqorePanel>
  );
};
