import {
  IReqoreRichTextEditorProps,
  ReqoreRichTextEditor,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { isEqual, size } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import { getTemplateTagStyle } from '../../../../helpers/templates';

export interface IRichTextFormFieldProps extends Omit<
  IReqoreRichTextEditorProps,
  'onChange' | 'value'
> {
  value?: string | IReqoreRichTextEditorProps['value'];
  onChange?: (value: string | IReqoreRichTextEditorProps['value']) => void;
  allowTemplates?: boolean;
  templates?: IReqoreFormTemplates;
}

export const RichTextFormField = memo(({
  value,
  onChange,
  allowTemplates,
  templates,
  ...rest
}: IRichTextFormFieldProps) => {
  const [localValue, setLocalValue] = useState<any>(value);

  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(localValue)) {
      setLocalValue(value);
    }
  }, [JSON.stringify(value)]);

  useDebounce(
    () => {
      if (!isEqual(localValue, value)) {
        onChange?.(localValue);
      }
    },
    100,
    // Deliberately NOT keyed on `onChange`: parents (FormEngine/TemplateField)
    // re-render freely while the user types, and an identity-changing callback
    // would keep resetting the timer — the pending emission then starves and
    // the typed value never reaches the form. react-use runs the latest
    // closure from a ref, so the fresh `onChange` is used either way.
    [localValue]
  );

  const handleChange = (val: any): void => {
    if (JSON.stringify(val) === '[{"type":"paragraph","children":[{"text":""}]}]') {
      setLocalValue(undefined);
      return;
    }
    setLocalValue(val);
  };

  const handleGetTagProps = useCallback((tag: any): IReqoreTagProps => {
    const tagValue = tag.value?.toString();

    if (!tagValue) {
      return {};
    }

    if (tagValue.startsWith('$')) {
      return {
        icon: 'ExchangeDollarLine',
        leftIconProps: {
          image: tag.metadata?.image,
        },
        labelKey: tag.metadata?.displayName,
        ...getTemplateTagStyle(tag.metadata),
      };
    }

    return {};
  }, []);

  const tags = useMemo<IReqoreRichTextEditorProps['tags']>((): IReqoreRichTextEditorProps['tags'] => {
    const _tags: IReqoreRichTextEditorProps['tags'] = {};

    if (size(templates?.items) && allowTemplates) {
      _tags.templates = {
        icon: 'MoneyDollarBoxLine',
        label: 'Templates',
        flat: false,
        description: 'Universal values that can be used in multiple places',
        items: templates?.items,
      };
    }

    return _tags;
  }, [allowTemplates, templates]);

  const formattedValue: IReqoreRichTextEditorProps['value'] =
    typeof localValue !== 'object' ? [{ type: 'paragraph', children: [{ text: String(localValue ?? '') }] }]
    : localValue === null ? undefined
    : localValue;

  // Read-only: ReqoreRichTextEditor makes the Slate surface non-editable (and
  // disables tag click/remove) when `readOnly` is set. Honour the field-level
  // flags — the IDE Options model passes `readonly`, the compact form passes
  // `readOnly` + `disabled` — so a read-only form renders the formatted content
  // rather than an editable box, and the toolbar actions are dropped to match.
  const readOnly = !!(
    (rest as { readOnly?: boolean }).readOnly ||
    (rest as { readonly?: boolean }).readonly ||
    (rest as { disabled?: boolean }).disabled
  );

  return (
    <ReqoreRichTextEditor
      value={formattedValue}
      onChange={handleChange}
      tagsListProps={{
        useTargetWidth: true,
        minWidth: '300px',
        maxWidth: '600px',
        listCustomTheme: {
          main: '#1b151f',
        },
        ...(rest.tagsListProps || {}),
      }}
      getTagProps={handleGetTagProps}
      tags={tags}
      panelProps={{ fluid: true, style: { minWidth: '150px', ...rest.panelProps?.style } }}
      {...rest}
      readOnly={readOnly}
      actions={
        readOnly ?
          { undo: false, redo: false, styling: false }
        : { redo: true, undo: true, styling: false }
      }
    />
  );
});
