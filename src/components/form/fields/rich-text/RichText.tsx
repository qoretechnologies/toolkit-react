import {
  IReqoreRichTextEditorProps,
  ReqoreRichTextEditor,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { isEqual, size } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import { templateItemsToShow } from '../../../../helpers/templateItems';
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

/**
 * What each offered template value is FOR, keyed by the value itself.
 *
 * Built from the templates a field was already given rather than from the
 * chip's metadata, which carries only `image` / `displayName` / style flags —
 * putting a description there would mean threading one through every producer
 * of a template list.
 *
 * Exported so the mapping is assertable without rendering a Slate editor.
 */
export const getChipTooltipDescriptions = (
  templates?: IReqoreFormTemplates
): Record<string, string> => {
  const out: Record<string, string> = {};

  (templates as any)?.items?.forEach((group: any) => {
    group?.items?.forEach((item: any) => {
      const value = typeof item?.value === 'object' ? item?.value?.value : item?.value;
      const description = item?.description ?? item?.short_desc;
      if (typeof value === 'string' && typeof description === 'string' && description) {
        out[value] = description;
      }
    });
  });

  return out;
};

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

  const descriptionByValue = useMemo(() => getChipTooltipDescriptions(templates), [
    JSON.stringify(templates),
  ]);

  const handleGetTagProps = useCallback(
    (tag: any): IReqoreTagProps => {
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
          /* Hovering a chip says what the value IS, not how it is spelled.
             Reqore otherwise falls back to the tag's own value, so a chip
             reading "result" reported `$.result` on hover — the reference the
             author already chose, restating the label in engine syntax instead
             of telling them anything. The path stays discoverable in the
             field's help and in the picker row for an unlabelled value. */
          tooltip: descriptionByValue[tagValue] || undefined,
          ...getTemplateTagStyle(tag.metadata),
        };
      }

      return {};
    },
    [descriptionByValue]
  );

  const tags = useMemo<IReqoreRichTextEditorProps['tags']>((): IReqoreRichTextEditorProps['tags'] => {
    const _tags: IReqoreRichTextEditorProps['tags'] = {};

    if (size(templates?.items) && allowTemplates) {
      _tags.templates = {
        icon: 'MoneyDollarBoxLine',
        label: 'Templates',
        flat: false,
        description: 'Universal values that can be used in multiple places',
        /* The in-editor list already nests everything under "Templates", so a
           lone category makes the author drill through TWO headers to reach
           the only values on offer. Hoist it. */
        items: templateItemsToShow(templates?.items),
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
