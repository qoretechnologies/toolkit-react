import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreH4,
  ReqoreIcon,
  ReqoreP,
  ReqorePanel,
  ReqoreSkeleton,
  ReqoreTabs,
  ReqoreTabsContent,
} from '@qoretechnologies/reqore';
import { IReqoreButtonProps } from '@qoretechnologies/reqore/dist/components/Button';
import { IReqorePanelProps } from '@qoretechnologies/reqore/dist/components/Panel';
import { IReqoreTabsProps } from '@qoretechnologies/reqore/dist/components/Tabs';
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import { filesize } from 'filesize';
import { reduce, size } from 'lodash';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { Accept, DropzoneOptions, useDropzone } from 'react-dropzone';
// Direct import — circular dep is safe because modules are loaded before any component renders
import { FormEngine } from '../../engine/FormEngine';

export interface IFileFormFieldValue {
  name?: string;
  content?: string;
  size?: number;
  mime_type?: { type: string; value: any };
}

export interface IReqraftFileFormFieldProps extends Omit<IReqorePanelProps, 'onChange'> {
  value?: IFileFormFieldValue;
  onChange?: (value: IFileFormFieldValue) => void;
  readonly?: boolean;
  options?: DropzoneOptions;
  valueButtonProps?: IReqoreButtonProps;
  /** If provided, shows the "Build a File" tab with a FormEngine */
  argSchema?: IQorusFormSchema;
  /** While the arg_schema is being fetched from the API */
  argSchemaLoading?: boolean;
  /**
   * Accept multiple files in the picker / drop zone. When set, `onChange`
   * fires once per picked file (so consumers keep their existing
   * single-file handler shape — they just receive it N times). Picked
   * files are not previewed inline; the consumer is expected to render
   * its own list / chip group from the accumulated values.
   */
  multiple?: boolean;
}

export const ReqraftFileFormField = memo(
  ({
    value,
    onChange,
    options = {},
    valueButtonProps = {},
    argSchema,
    argSchemaLoading,
    multiple,
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
      maxFiles: multiple ? 0 : 1,
      multiple: !!multiple,
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

      const filesToRead = multiple ? acceptedFiles : [acceptedFiles[0]];

      filesToRead.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          onChange?.({
            name: file.name,
            content: reader.result as string,
            size: file.size,
          });
        };
        reader.readAsDataURL(file);
      });
    }, [acceptedFiles]);

    const handleTabChange = useCallback(
      (tabId: string | number) => {
        if (tabId === 'build') {
          onChange?.({ mime_type: { type: 'richtext', value: undefined } });
        } else {
          onChange?.(undefined);
        }
      },
      [onChange]
    );

    const tabs = useMemo(
      (): IReqoreTabsProps['tabs'] => [
        { label: 'Upload a File', id: 'upload', icon: 'FileUploadLine', compact: true },
        { label: 'Build a File', id: 'build', icon: 'FileAddLine', compact: true },
      ],
      []
    );

    const renderUploader = useCallback(() => {
      // In multi-file mode, the consumer is responsible for rendering its
      // own list of picked files (e.g. as a chip group). Always show the
      // click-or-drop area so the user can keep adding files.
      if (!multiple && value && !value.mime_type) {
        return (
          <>
            <input {...getInputProps()} />
            {typeof value.content === 'string' && value.content.startsWith('data:image') ? (
              <img
                src={value.content}
                alt={value.name || 'Uploaded file'}
                style={{ maxWidth: '100%', maxHeight: 60 }}
              />
            ) : null}
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
    }, [value, rest, valueButtonProps, getInputProps, getRootProps, renderExtensions, contentStyle, multiple]);

    if (!argSchema && !argSchemaLoading) {
      return renderUploader();
    }

    return (
      <ReqoreTabs
        size={rest.size as any}
        fill
        onTabChange={handleTabChange}
        tabsPadding='vertical'
        activeTab={value?.mime_type ? 'build' : 'upload'}
        tabs={tabs}
      >
        <ReqoreTabsContent tabId='upload'>{renderUploader()}</ReqoreTabsContent>
        <ReqoreTabsContent tabId='build'>
          {argSchemaLoading || !argSchema ?
            <ReqoreSkeleton height='120px' />
          : <FormEngine
              name='file-build'
              options={argSchema}
              value={value as any}
              onChange={(_name, val) => onChange?.(val as IFileFormFieldValue)}
              flat
              wrapperPadding='bottom'
              columns={1}
              minColumnWidth='150px'
              size={rest.size as any}
              disabled={rest.disabled}
            />
          }
        </ReqoreTabsContent>
      </ReqoreTabs>
    );
  }
);
