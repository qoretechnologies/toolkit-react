import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreSpan,
  ReqoreTabs,
  ReqoreTabsContent,
} from '@qoretechnologies/reqore';
import { IReqoreTabsProps } from '@qoretechnologies/reqore/dist/components/Tabs';
import { IReqoreTreeProps } from '@qoretechnologies/reqore/dist/components/Tree';
import { IQorusFormSchema } from '@qoretechnologies/ts-toolkit';
import jsyaml from 'js-yaml';
import { isEqual } from 'lodash';
import { CSSProperties, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inferTypedValue, typedToPlain } from '../../../../helpers/common';
// The cycle (Object → ArrayAuto → AutoFormField → Object) is safe the way ArrayAuto's own is: each is only
// reached at render time.
import { ArrayAuto } from '../array/ArrayAuto';
import { withCodeFont } from '../codeFont';
import { IFieldLabels } from '../labels';
import LongStringFormField, { ILongStringFormFieldProps } from '../long-string/LongString';
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';

export interface IReqraftObjectFormFieldProps extends Omit<IReqoreTabsProps, 'onChange' | 'tabs'> {
  tabs?: IReqoreTabsProps['tabs'];
  onChange: (value: string | IReqoreTreeProps['data']) => void;
  value: string | IReqoreTreeProps['data'];

  type: 'object' | 'array';
  resultDataType?: 'native' | 'json' | 'yaml';
  dataType?: 'native' | 'json' | 'yaml';

  /** @deprecated The values are rows now, not Reqore's tree; nothing reads this. */
  editorProps?: Omit<IReqoreTreeProps, 'data' | 'onDataChange'>;
  /**
   * Draw each row's name and value as a read-first row that opens to be changed (the form engine's compact rows),
   * or as a form of its own. On by default; the form engine passes its own.
   */
  compact?: boolean;
  /** The field's name, which its rows are named after. */
  name?: string;
  /**
   * Offer the value as source text to type into (JSON or YAML), in a Text tab beside the editor. Off by default,
   * and it stays off for a value a person fills in: nobody is asked to write JSON or YAML, and there is
   * never a free JSON text. The one exception is a host editing a source it also offers a guided
   * editor of the same thing for - the IDE's DB and API schema builders - which turns it on itself.
   */
  textEditing?: boolean;
  /** The Text tab's text box, with `textEditing`. */
  textareaProps?: ILongStringFormFieldProps;

  disabled?: boolean;
}

/** The editor's own column: its rows and its remove control, one under the other. */
const EDITOR_COLUMN: CSSProperties = { display: 'flex', flexFlow: 'column' };

/** One row of an object's values, as the row's form holds it: `{ name?, value? }`, each `{ type, value }`. */
export type TObjectRow = Record<string, unknown>;

/**
 * The fields of a row (data is entered through a form, never as JSON or YAML): a name and a value
 * whose kind is picked first, as the IDE's "Other values" rows; a list's rows hold a value each. A value that is a
 * record or a list is rows of its own, through this same field.
 */
export const objectRowsSchema = (
  type: 'object' | 'array',
  words: Pick<
    IFieldLabels,
    'rowName' | 'rowNameDescription' | 'rowValue' | 'rowValueDescription'
  >
): IQorusFormSchema =>
  ({
    ...(type === 'object' ?
      {
        name: {
          type: 'string',
          display_name: words.rowName,
          short_desc: words.rowNameDescription,
          required: true,
        },
      }
    : {}),
    value: {
      type: 'auto',
      display_name: words.rowValue,
      short_desc: words.rowValueDescription,
      // shown with its name, not folded away as an optional field
      preselected: true,
    },
  }) as unknown as IQorusFormSchema;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * A record or a list as the data it is, where it arrived as its own YAML source (`%YAML 1.2 --- [...]`, as the IDE
 * hands a list over): read as one string, its rows were none (the tree drew a row per character).
 */
export const objectDataOf = (data: unknown, type: 'object' | 'array'): unknown => {
  if (typeof data !== 'string') {
    return data;
  }

  try {
    const parsed = jsyaml.load(data);

    return (type === 'array' ? Array.isArray(parsed) : isRecord(parsed)) ? parsed : data;
  } catch {
    return data;
  }
};

/** A row as its form holds it, whether or not it arrived in a `{ type: 'hash', value }` envelope. */
const rowFields = (row: unknown): TObjectRow =>
  isRecord(row) && typeof row.type === 'string' && isRecord(row.value) ? row.value : (
    (row as TObjectRow) ?? {}
  );

const typedRow = (name: string | undefined, value: unknown): TObjectRow => ({
  ...(name === undefined ? {} : { name: { type: 'string', value: name } }),
  // a value not there yet (or null) leaves the row's value to be filled in
  ...(value === undefined || value === null ? {} : { value: inferTypedValue(value) }),
});

/** An object's or a list's plain data as rows: one per key (its name and its typed value), or one per item. */
export const objectRowsFromData = (data: unknown, type: 'object' | 'array'): TObjectRow[] =>
  type === 'array' ?
    (Array.isArray(data) ? data : []).map((item) => typedRow(undefined, item))
  : Object.entries(isRecord(data) ? data : {}).map(([name, value]) => typedRow(name, value));

/** Rows back into plain data: a row with no name, or a list's row with no value, is not a value yet. */
export const objectDataFromRows = (
  rows: unknown[] | undefined,
  type: 'object' | 'array'
): Record<string, unknown> | unknown[] => {
  const fields = (rows ?? []).map(rowFields);

  if (type === 'array') {
    return fields.filter((row) => row.value !== undefined).map((row) => typedToPlain(row.value as never) ?? null);
  }

  const data: Record<string, unknown> = {};

  fields.forEach((row) => {
    const name = String(typedToPlain(row.name as never) ?? '').trim();

    if (name) {
      data[name] = typedToPlain(row.value as never) ?? null;
    }
  });

  return data;
};

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
        // YAML or JSON: code, so it asks for monospace (Reqore draws a textarea as prose).
        effect={withCodeFont(rest.effect)}
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    editorProps,
    textEditing = false,
    textareaProps,
    // the field's own, for its buttons and editors; ReqoreTabs does not take it
    disabled,
    compact = true,
    name: fieldName,
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

      const data = (() => {
        switch (dataType) {
          case 'json':
            return JSON.parse(value as string);
          case 'yaml':
            return jsyaml.load(value as string);
          default:
            return value;
        }
      })();

      // a record or a list given as its own YAML source is the data it holds
      return objectDataOf(data, type) as IReqoreTreeProps['data'];
    }, [value, dataType, type]);

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

    /* The values as rows (data is entered through a form, never as JSON or YAML): a name and a typed value each,
       or a value each for a list, nested where a value is a record or a list. The rows are kept here: a row added
       and not named yet is no value yet, so the data the field gives back leaves it out, and the rows must not be
       rebuilt from that data while it is being written. */
    const rowsSchema = useMemo(() => objectRowsSchema(type, fieldWords), [type, fieldWords]);
    const [rows, setRows] = useState<unknown[]>(() => objectRowsFromData(treeData, type));
    const rowsRef = useRef(rows);
    rowsRef.current = rows;
    // no value and no values are the same rows
    const dataOrEmpty = useCallback(
      (data: unknown) => data ?? (type === 'array' ? [] : {}),
      [type]
    );

    useEffect(() => {
      // what the rows already say (their own data coming back) leaves them as they are
      if (!isEqual(objectDataFromRows(rowsRef.current, type), dataOrEmpty(treeData))) {
        setRows(objectRowsFromData(treeData, type));
      }
    }, [treeData, type, dataOrEmpty]);

    const handleRowsChange = useCallback(
      (_name: string, next: unknown[]) => {
        setRows(next);
        rowsRef.current = next;

        const data = objectDataFromRows(next, type);

        if (!isEqual(data, dataOrEmpty(treeData))) {
          handleTreeDataChange(data as IReqoreTreeProps['data']);
        }
      },
      [type, treeData, dataOrEmpty, handleTreeDataChange]
    );

    const editor = (
      <>
        <ArrayAuto
          name={fieldName ? `${fieldName}-rows` : 'values'}
          display_name={(rest as { display_name?: string }).display_name || fieldWords.rowsName}
          type='hash'
          arg_schema={rowsSchema}
          value={rows}
          onChange={handleRowsChange}
          compact={compact}
          disabled={disabled}
          size={rest.size}
        />
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
