import {
  IReqoreRichTextEditorProps,
  ReqoreRichTextEditor,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { IReqoreTooltip } from '@qoretechnologies/reqore/dist/types/global';
import { isEqual, size } from 'lodash';
import { KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';
import { flattenToSingleLine, hasLineBreak } from '../../../../helpers/singleLineString';
import {
  renderTemplateItemDescriptions,
  templateItemsToShow,
} from '../../../../helpers/templateItems';
import {
  templateChipLabel,
  templateNodesToText,
  templateTextToNodes,
} from '../../../../helpers/templateText';
import {
  describeTemplateReference,
  getTemplateTagStyle,
  templateTooltip,
  TTemplateMeta,
} from '../../../../helpers/templates';
import { useMarkdownRenderer } from '../../../Description/markdownRendererContext';

export interface IRichTextFormFieldProps extends Omit<
  IReqoreRichTextEditorProps,
  'onChange' | 'value' | 'tags' | 'actions'
> {
  /**
   * A form field's OWN chips — not the editor's template catalogue, which this
   * component computes from `templates`.
   *
   * The two are different things wearing one name: the editor's `tags` is a
   * record of offered template values, a field's is a list of chips to show. A
   * field spreading its props here used to hand the first where the second was
   * expected, so the template list vanished — call sites patched it one by one
   * with `omit(rest, 'tags')`. It is accepted here and deliberately not
   * forwarded, so a field can spread its props without either patch or type
   * error.
   */
  tags?: unknown;
  value?: string | IReqoreRichTextEditorProps['value'];
  onChange?: (value: string | IReqoreRichTextEditorProps['value']) => void;
  allowTemplates?: boolean;
  templates?: IReqoreFormTemplates;
  /**
   * What the value is. `richtext` (the default) stores the editor's document.
   * `text` stores a plain string: each template reference in it is drawn as a
   * chip named from `templates`, and what is emitted is the string again — for
   * a string field whose value may hold references (`Dear $local:name`).
   */
  valueFormat?: 'richtext' | 'text';
  /** With `valueFormat: 'text'`: the value holds one line, so Enter adds none. */
  singleLine?: boolean;
  /**
   * With `valueFormat: 'text'`: the token grammar the value's references are
   * WRITTEN in, when the host speaks one of its own.
   *
   * The field schema's `templateToken` (`TFieldWithOwnTemplates`), which the
   * read-only renderings already take. Without it this editor knew only
   * reqraft's built-in `$key:{path}`, so a host's own spelling — a Qorus test's
   * `$._case.mode` — was a named chip on the collapsed row and raw text in the
   * editor that row opens. Declared here, and deliberately NOT forwarded to
   * Reqore's editor, which has no such prop.
   */
  templateToken?: RegExp | string;
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

  /* BOTH shapes, because this list arrives in either one. A picker's items are
     normally grouped by category, but a LONE category is opened onto its values
     where the templates are resolved (`templateItemsToShow`), so a field with
     one category hands down a FLAT list of leaves. Walking only groups made
     that the common case and silently lost every tooltip on it — one category
     is the ordinary shape for a field, not the exception.

     Recursive rather than two-level: a leaf is recognised by carrying a value
     rather than by its depth, so a deeper catalogue works too. */
  const collect = (items: any[] | undefined): void => {
    items?.forEach((item: any) => {
      const value = typeof item?.value === 'object' ? item?.value?.value : item?.value;
      const description = item?.description ?? item?.short_desc;
      if (typeof value === 'string' && typeof description === 'string' && description) {
        out[value] = description;
      }
      collect(item?.items);
    });
  };

  collect((templates as any)?.items);

  return out;
};

export const RichTextFormField = memo(({
  value,
  onChange,
  allowTemplates,
  templates,
  valueFormat = 'richtext',
  singleLine,
  templateToken,
  ...rest
}: IRichTextFormFieldProps) => {
  const isText = valueFormat === 'text';
  const [localValue, setLocalValue] = useState<any>(() =>
    isText ? templateTextToNodes(String(value ?? ''), templates, templateToken) : value
  );
  /* In text mode, the string the editor's document stands for. The value that
     comes back from the parent is usually that same string, and rebuilding the
     document from it would hand the editor a new tree on every keystroke —
     which it answers by replacing its content and moving the cursor to the end. */
  const lastTextRef = useRef(isText ? String(value ?? '') : '');

  useEffect(() => {
    if (isText) {
      const text = String(value ?? '');
      if (text !== lastTextRef.current) {
        lastTextRef.current = text;
        setLocalValue(templateTextToNodes(text, templates, templateToken));
      }
      return;
    }
    if (JSON.stringify(value) !== JSON.stringify(localValue)) {
      setLocalValue(value);
    }
  }, [JSON.stringify(value)]);

  useDebounce(
    () => {
      if (isText) {
        if (lastTextRef.current !== String(value ?? '')) {
          onChange?.(lastTextRef.current);
        }
        return;
      }
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
    if (isText) {
      const text = templateNodesToText(val);
      // A line break also arrives by paste and by drag-and-drop; Enter alone is
      // stopped below. Flattened text is shown as the one line it now is.
      if (singleLine && hasLineBreak(text)) {
        lastTextRef.current = flattenToSingleLine(text);
        setLocalValue(templateTextToNodes(lastTextRef.current, templates, templateToken));
        return;
      }
      lastTextRef.current = text;
      setLocalValue(val);
      return;
    }
    if (JSON.stringify(val) === '[{"type":"paragraph","children":[{"text":""}]}]') {
      setLocalValue(undefined);
      return;
    }
    setLocalValue(val);
  };

  // One renderer for both surfaces below — the chip's hover and the picker rows
  // show the same strings, so they must be drawn the same way.
  const renderMarkdown = useMarkdownRenderer();

  const descriptionByValue = useMemo(() => getChipTooltipDescriptions(templates), [
    JSON.stringify(templates),
  ]);

  const handleGetTagProps = useCallback(
    (tag: any): IReqoreTagProps => {
      const tagValue = tag.value?.toString();

      if (!tagValue) {
        return {};
      }

      /* A reference in a string is drawn exactly as the collapsed row draws the
         same value (`ReadOnlyTemplateTag`): named from the catalogue, its
         description on hover. Read at render, so a catalogue that arrives
         after the value still names it. */
      if (isText && tagValue.startsWith('$')) {
        const { item } = describeTemplateReference(templates, tagValue);
        const metadata = item?.metadata as TTemplateMeta | undefined;
        return {
          icon: 'ExchangeDollarLine',
          leftIconProps: { image: metadata?.image },
          label: templateChipLabel(templates, tagValue),
          tooltip: templateTooltip(templates, tagValue),
          ...getTemplateTagStyle(metadata),
        };
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
          /* Drawn, for the same reason the picker row is: this description is
             the SAME string the row shows, so leaving it raw here would print
             the punctuation the row no longer prints. A tooltip's `content`
             takes a node, and without a host renderer it stays the plain
             string it always was. */
          /* Drawn, for the same reason the picker row is: this is the SAME
             string the row shows, so leaving it raw here would print the
             punctuation the row no longer prints. A drawn description travels
             as the tooltip's `content` — the prop itself is `string |
             IReqoreTooltip`, and only the object form takes a node. Without a
             host renderer it stays the plain string it always was. */
          tooltip:
            descriptionByValue[tagValue] ?
              renderMarkdown ?
                {
                  content: renderMarkdown({
                    value: descriptionByValue[tagValue],
                    compact: true,
                  }) as IReqoreTooltip['content'],
                }
              : descriptionByValue[tagValue]
            : undefined,
          ...getTemplateTagStyle(tag.metadata),
        };
      }

      return {};
    },
    [descriptionByValue, renderMarkdown, isText, templates]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (isText && singleLine && event.key === 'Enter') {
        event.preventDefault();
      }
      (rest as { onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void }).onKeyDown?.(event);
    },
    [isText, singleLine, (rest as { onKeyDown?: unknown }).onKeyDown]
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
        /* Drawn here, at the hand-off to Reqore. A description is prose written
           in the same markdown as every other description this package shows,
           and printing its punctuation at the reader was the last surface still
           doing that. Never made further up: the list is a `JSON.stringify`
           memo key in `TemplateField`. */
        items: renderTemplateItemDescriptions(templateItemsToShow(templates?.items), renderMarkdown),
      };
    }

    return _tags;
  }, [allowTemplates, templates, renderMarkdown]);

  const formattedValue: IReqoreRichTextEditorProps['value'] =
    typeof localValue !== 'object' ? [{ type: 'paragraph', children: [{ text: String(localValue ?? '') }] }]
    : localValue === null ? undefined
    : localValue;

  // Read-only: ReqoreRichTextEditor makes the Slate surface non-editable (and
  // disables tag click/remove) when `readOnly` is set. Honour the field-level
  // flags — the IDE Options model passes `readonly`, the compact form passes
  // `readOnly` + `disabled` — so a read-only form renders the formatted content
  // rather than an editable box.
  const readOnly = !!(
    (rest as { readOnly?: boolean }).readOnly ||
    (rest as { readonly?: boolean }).readonly ||
    (rest as { disabled?: boolean }).disabled
  );

  /* Everything the caller passed, minus its own `tags` — see the prop's doc
     above: on a form field that name means the chips to show, while the
     editor's `tags` is the template catalogue this component computes. */
  const editorProps = { ...rest };
  delete (editorProps as { tags?: unknown }).tags;

  return (
    <ReqoreRichTextEditor
      value={formattedValue}
      onChange={handleChange}
      /* `rest` is spread BEFORE everything this component computes. It used to
         come after, so a caller's prop of the same name silently replaced the
         computed one — and `tags` is exactly such a name twice over: on a form
         field it means the field's own chips, while the editor's `tags` are its
         template catalogue. A field passing chips therefore erased the template
         list, which two call sites had each patched with `omit(rest, 'tags')`.
         The three props below already fold in whatever `rest` carried for
         them. */
      {...editorProps}
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
      readOnly={readOnly}
      onKeyDown={handleKeyDown}
      /* A form field carries no document toolbar. Styling was already off, so
         the bar held only undo and redo — drawn by Reqore as a panel as wide as
         the tag list, which under a field reads as an empty 600px menu with two
         greyed icons in it (they are disabled until there is history to walk).
         Both still work from the keyboard, where every other text field's do. */
      actions={{ undo: false, redo: false, styling: false }}
    />
  );
});
