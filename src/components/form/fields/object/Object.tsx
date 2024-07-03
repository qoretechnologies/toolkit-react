import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreSpan,
  ReqoreTabs,
  ReqoreTabsContent,
} from '@qoretechnologies/reqore';
import { IReqoreTabsProps } from '@qoretechnologies/reqore/dist/components/Tabs';
import { IReqoreTreeProps, ReqoreTree } from '@qoretechnologies/reqore/dist/components/Tree';
import jsyaml from 'js-yaml';
import { useCallback, useMemo, useState } from 'react';
import LongStringFormField, { ILongStringFormFieldProps } from '../long-string/LongString';

export interface IReqraftObjectFormFieldProps extends Omit<IReqoreTabsProps, 'onChange'> {
  onChange: (value: string | IReqoreTreeProps['data']) => void;
  value: string | IReqoreTreeProps['data'];

  type: 'object' | 'array';
  resultDataType?: 'native' | 'json' | 'yaml';
  dataType?: 'native' | 'json' | 'yaml';

  editorProps?: Omit<IReqoreTreeProps, 'data' | 'onDataChange'>;
  textareaProps?: ILongStringFormFieldProps;
}

export const ReqraftObjectFormFieldTextarea = ({
  value,
  onChange,
  dataType,
  resultDataType,
  ...rest
}: Partial<ILongStringFormFieldProps> &
  Pick<IReqraftObjectFormFieldProps, 'dataType'> & { resultDataType: 'json' | 'yaml' }) => {
  const [localValue, setValue] = useState(value);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  const isValid = useMemo(() => {
    try {
      switch (dataType) {
        case 'json':
          JSON.parse(localValue);
          break;
        case 'yaml':
          jsyaml.load(localValue);
          break;
      }
    } catch (e) {
      return false;
    }

    return true;
  }, [dataType, resultDataType, localValue]);

  return (
    <ReqoreControlGroup vertical>
      <ReqoreControlGroup stack fill>
        <LongStringFormField
          value={localValue}
          onChange={handleChange}
          scaleWithContent
          {...rest}
          intent={isValid ? rest.intent : 'danger'}
        />
        <ReqoreButton
          label='Save'
          icon='CheckLine'
          compact
          intent='success'
          fixed
          disabled={!isValid}
          onClick={() => {
            onChange(localValue);
          }}
        />
      </ReqoreControlGroup>
      {!isValid && (
        <ReqoreSpan intent='danger' size='small'>
          Not a valid {dataType.toUpperCase()}
        </ReqoreSpan>
      )}
    </ReqoreControlGroup>
  );
};

export const ReqraftObjectFormField = ({
  onChange,
  value,
  type,
  dataType,
  resultDataType = dataType,
  editorProps,
  textareaProps,
  ...rest
}: IReqraftObjectFormFieldProps) => {
  const handleTreeDataChange = useCallback(
    (data: IReqoreTreeProps['data']) => {
      switch (resultDataType) {
        case 'json':
          onChange(JSON.stringify(data, null, 2));
          break;
        case 'yaml':
          onChange(jsyaml.dump(data));
          break;
        default:
          onChange(data);
      }
    },
    [resultDataType, onChange]
  );

  const treeData = useMemo(() => {
    if (!value) {
      return undefined;
    }

    switch (dataType) {
      case 'json':
        return JSON.parse(value as string);
      case 'yaml':
        return jsyaml.load(value as string);
      default:
        return value;
    }
  }, [value]);

  const textData: string = useMemo(() => {
    if (!value) {
      return undefined;
    }

    switch (dataType) {
      case 'json':
        return value as string;
      case 'yaml':
        return value as string;
      default:
        return JSON.stringify(value, null, 2);
    }
  }, [value]);

  return (
    <ReqoreTabs
      tabsPadding='vertical'
      {...rest}
      tabs={[
        {
          label: 'Editor',
          icon: 'NodeTree',
          id: 'editor',
        },
        {
          label: 'Text',
          icon: 'Text',
          id: 'text',
          show: resultDataType !== 'native',
        },
      ]}
    >
      <ReqoreTabsContent tabId='editor'>
        {!treeData && (
          <ReqoreButton
            onClick={() => handleTreeDataChange(type === 'array' ? [] : {})}
            fixed
            icon='AddLine'
          >
            New {type === 'array' ? 'List' : 'Object'}
          </ReqoreButton>
        )}
        {treeData && (
          <ReqoreTree
            data={treeData}
            onDataChange={handleTreeDataChange}
            editable
            showControls={false}
            {...editorProps}
          />
        )}
      </ReqoreTabsContent>
      <ReqoreTabsContent tabId='text'>
        <ReqraftObjectFormFieldTextarea
          {...textareaProps}
          value={textData}
          onChange={onChange}
          dataType={dataType}
          resultDataType={resultDataType as 'json' | 'yaml'}
        />
      </ReqoreTabsContent>
    </ReqoreTabs>
  );
};
