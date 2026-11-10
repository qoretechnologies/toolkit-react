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
import { CSSProperties, memo, useCallback, useMemo, useState } from 'react';
import LongStringFormField, { ILongStringFormFieldProps } from '../long-string/LongString';
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';

export interface IReqraftObjectFormFieldProps extends Omit<IReqoreTabsProps, 'onChange' | 'tabs'> {
  tabs?: IReqoreTabsProps['tabs'];
  onChange: (value: string | IReqoreTreeProps['data']) => void;
  value: string | IReqoreTreeProps['data'];

  type: 'object' | 'array';
  resultDataType?: 'native' | 'json' | 'yaml';
  dataType?: 'native' | 'json' | 'yaml';

  editorProps?: Omit<IReqoreTreeProps, 'data' | 'onDataChange'>;
  /**
   * Offer the value as source text to type into (JSON or YAML), in a Text tab beside the editor. Off by default,
   * and it stays off for a value a person fills in: nobody is asked to write JSON or YAML (Filip, 10 Nov: "there
   * should NEVER be a free json text"). The one exception is a host editing a source it also offers a guided
   * editor of the same thing for - the IDE's DB and API schema builders - which turns it on itself.
   */
  textEditing?: boolean;
  /** The Text tab's text box, with `textEditing`. */
  textareaProps?: ILongStringFormFieldProps;

  disabled?: boolean;
}

/** The editor's own column: its add / remove controls and the tree, one under the other. */
const EDITOR_COLUMN: CSSProperties = { display: 'flex', flexFlow: 'column' };

export const ReqraftObjectFormFieldTextarea = ({
  value,
  onChange,
  dataType,
  resultDataType,
  ...rest
}: Partial<ILongStringFormFieldProps> &
  Pick<IReqraftObjectFormFieldProps, 'dataType'> & { resultDataType: 'json' | 'yaml' }) => {
  const [localValue, setValue] = useState(value);
  const fieldWords = useReqraftLabels().fields;

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  const parseValue = useCallback(
    (type: 'json' | 'yaml' | 'native') => {
      switch (type) {
        case 'json':
          return JSON.parse(localValue);
        case 'yaml':
          return jsyaml.load(localValue);
        default:
          return parseValue(resultDataType);
      }
    },
    [dataType, localValue, resultDataType]
  );

  const isValid = useMemo(() => {
    if (localValue === '' || localValue === undefined) {
      return true;
    }

    try {
      !!parseValue(dataType);
    } catch (e) {
      return false;
    }

    return true;
  }, [dataType, resultDataType, localValue]);

  return (
    <ReqoreControlGroup vertical>
      <LongStringFormField
        value={localValue}
        onChange={handleChange}
        scaleWithContent
        {...rest}
        intent={isValid ? rest.intent : 'danger'}
      />
      <ReqoreControlGroup stack>
        <ReqoreButton
          size={rest.size}
          label={fieldWords.save}
          icon='CheckLine'
          compact
          fluid
          intent='success'
          disabled={!isValid || rest.disabled || localValue === value}
          onClick={() => {
            if (localValue === '' || localValue === undefined) {
              onChange(undefined);
              return;
            }

            let parsedValue = parseValue(dataType);

            if (resultDataType === 'json') {
              parsedValue = JSON.stringify(parsedValue, null, 2);
            } else if (resultDataType === 'yaml') {
              parsedValue = jsyaml.dump(parsedValue);
            }
            onChange(parsedValue);
          }}
        />
        <ReqoreButton
          size={rest.size}
          label={fieldWords.discard}
          icon='HistoryLine'
          compact
          fixed
          disabled={localValue === value || rest.disabled}
          onClick={() => setValue(value)}
        />
      </ReqoreControlGroup>
      {!isValid && (
        <ReqoreSpan intent='danger' size='small'>
          {fieldWords.notValid(resultDataType.toUpperCase())}
        </ReqoreSpan>
      )}
    </ReqoreControlGroup>
  );
};

export const ReqraftObjectFormField = memo(
  ({
    onChange,
    value,
    type,
    dataType,
    resultDataType = dataType,
    editorProps,
    textEditing = false,
    textareaProps,
    // the field's own, for its buttons and editors; ReqoreTabs does not take it
    disabled,
    ...rest
  }: IReqraftObjectFormFieldProps) => {
    const fieldWords = useReqraftLabels().fields;
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
          switch (resultDataType) {
            case 'json':
              return JSON.stringify(value, null, 2);
            default:
              return jsyaml.dump(value);
          }
      }
    }, [value]);

    // the structured editor: rows of keys and typed values, nested where the value is
    const editor = (
      <>
        {!treeData && (
          <ReqoreButton
            onClick={() => handleTreeDataChange(type === 'array' ? [] : {})}
            fixed
            icon='AddLine'
            disabled={disabled}
            size={rest.size}
          >
            {type === 'array' ? fieldWords.newList : fieldWords.newObject}
          </ReqoreButton>
        )}
        {treeData && (
          <ReqoreTree
            disabled={disabled}
            data={treeData}
            onDataChange={handleTreeDataChange}
            editable
            showControls={false}
            size={rest.size}
            {...editorProps}
          />
        )}
        {treeData && (
          <ReqoreButton
            onClick={() => handleTreeDataChange(undefined)}
            fixed
            icon='CloseLine'
            disabled={disabled}
            size={rest.size}
          >
            {fieldWords.remove}
          </ReqoreButton>
        )}
      </>
    );

    /* The editor is the route. Source text to type into is only offered where a host asks for it (`textEditing`),
       as a second tab. */
    if (!textEditing || resultDataType === 'native') {
      return (
        // a column, as the tab it was drawn in laid it out
        <div className='reqraft-object-field' style={EDITOR_COLUMN}>
          {editor}
        </div>
      );
    }

    return (
      <ReqoreTabs
        tabsPadding='vertical'
        {...rest}
        tabs={[
          {
            label: fieldWords.editorTab,
            icon: 'NodeTree',
            id: 'editor',
            size: rest.size,
          },
          {
            label: fieldWords.textTab,
            icon: 'Text',
            id: 'text',
            size: rest.size,
          },
        ]}
      >
        <ReqoreTabsContent tabId='editor'>{editor}</ReqoreTabsContent>
        <ReqoreTabsContent tabId='text'>
          <ReqraftObjectFormFieldTextarea
            disabled={disabled}
            size={rest.size}
            {...textareaProps}
            value={textData}
            onChange={onChange}
            dataType={dataType}
            resultDataType={resultDataType as 'json' | 'yaml'}
          />
        </ReqoreTabsContent>
      </ReqoreTabs>
    );
  }
);
