import {
  IReqoreRichTextEditorProps,
  ReqoreRichTextEditor,
  TReqoreRichTextEditorRef,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { isEqual } from 'lodash';
import { KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';
import { useEmittedValues } from '../emittedValues';
import { usePendingEdit } from '../pendingEdit';
import { descriptionTooltip, useDescriptionTooltips } from '../../../../helpers/descriptionTooltip';
import { flattenToSingleLine, hasLineBreak } from '../../../../helpers/singleLineString';
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
import { TEMPLATE_BROWSE_LIST_PROPS, useTemplateTags } from './useTemplateTags';
import { CompletionMenu } from '../../../smartEditor/CompletionMenu';
import { defaultSlateConverter } from '../../../smartEditor/helpers';
import { templateChipInserter, templateCompletionItems } from '../../../smartEditor/templateCompletions';
import { useLspAutocomplete } from '../../../smartEditor/useLspAutocomplete';

/** What opens the field's template list as it is typed: a template begins with `$`. */
const TEMPLATE_TRIGGERS = new Set(['$']);
/** Distinguishes the completion lists of the fields on a page, for each field's `aria-controls`. */
let textCompletionMenuCounter = 0;

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
   * The catalogue a chip is NAMED from, when it is wider than the `templates` offered: a typed field offers
   * only the fields of its type, but a chip of any field in its value is named as the catalogue names it.
   * Named from the offered list, a field not on it read as its reference's path ("record: pos").
   * Defaults to `templates`.
   */
  namingTemplates?: IReqoreFormTemplates;
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

/* The chip references a document holds, in order, as one comparable string. Two documents that stand for
   the same text but chip different references differ here; two that chip the same references do not — so a
   re-parse that recognises nothing new is not taken for a change (which would move the cursor). */
const chipValuesOf = (nodes?: ReadonlyArray<{ children?: ReadonlyArray<Record<string, any>> }>): string =>
  JSON.stringify(
    (nodes ?? []).flatMap((paragraph) =>
      (paragraph?.children ?? [])
        .filter((node) => node?.type === 'tag')
        .map((node) => String(node?.value ?? ''))
    )
  );

export const RichTextFormField = memo(({
  value,
  onChange,
  allowTemplates,
  templates,
  namingTemplates,
  valueFormat = 'richtext',
  singleLine,
  templateToken,
  ...rest
}: IRichTextFormFieldProps) => {
  const isText = valueFormat === 'text';
  /** What chips are named from: the whole catalogue, not only what is offered (see the prop). */
  const naming = namingTemplates ?? templates;
  /* The document a rich-text value stands for. Rich text the server holds is its string type, so a value
     arrives as a string as often as a document - a saved `$local:name`, or text - and a string handed to
     the editor as its document was drawn as raw text, each reference spelled out rather than its chip. It
     is read as text with references, as the `text` format reads it; until it is edited, nothing is sent
     back, so a string held stays a string. (A field mounted through an untyped first render was handed
     the string in the `text` format, and kept the chips it drew then, by accident: that first render is
     gone - see `resolveAutoFieldTypes`.) */
  const documentOf = (held: unknown) =>
    typeof held === 'string' ? templateTextToNodes(held, naming, templateToken) : held;
  /** The same document: a chip read from a string carries `metadata: undefined`, which the editor's own
   *  copy of it may leave out. */
  const sameDocument = (a: unknown, b: unknown) =>
    isEqual(a, b) || JSON.stringify(a) === JSON.stringify(b);
  const [localValue, setLocalValue] = useState<any>(() =>
    isText ? templateTextToNodes(String(value ?? ''), naming, templateToken) : documentOf(value)
  );
  /* In text mode, the string the editor's document stands for. The value that
     comes back from the parent is usually that same string, and rebuilding the
     document from it would hand the editor a new tree on every keystroke —
     which it answers by replacing its content and moving the cursor to the end. */
  const lastTextRef = useRef(isText ? String(value ?? '') : '');
  /* The parent's echo of an emit still in flight is not a change. It arrives
     while the next keys are typed, and rebuilding the document from it threw
     them away. See `EmittedValues`. */
  const emitted = useEmittedValues<unknown>(isEqual);

  /* The edit the debounce below has yet to send. The field can go away before it fires - a value's tab
     switched, a row closed, right after a pick - and the edit went with it (qorus#646): a read-first row's
     Done sends it before the row closes, Cancel and Escape drop it, and any other way out sends it (see
     `usePendingEdit`). */
  type TEdit = string | IReqoreRichTextEditorProps['value'];
  const pendingEdit = usePendingEdit<TEdit>((edit) => {
    emitted.record(edit);
    onChange?.(edit);
  });
  const setPending = (next: { edit: TEdit } | undefined) =>
    next ? pendingEdit.hold(next.edit) : pendingEdit.release();

  useEffect(() => {
    if (emitted.isEcho(isText ? String(value ?? '') : value)) {
      return;
    }
    // the parent has a value of its own: what was typed before it is no edit to send any more
    pendingEdit.release();
    if (isText) {
      const text = String(value ?? '');
      if (text !== lastTextRef.current) {
        lastTextRef.current = text;
        setLocalValue(templateTextToNodes(text, naming, templateToken));
      }
      return;
    }
    const held = documentOf(value);
    if (JSON.stringify(held) !== JSON.stringify(localValue)) {
      setLocalValue(held);
    }
  }, [JSON.stringify(value)]);

  /* A reference in a string is drawn as a chip only once something can name it: the field's own grammar
     (`templateToken`), or — for a reference neither grammar matches, a DPQL `@create` say — the catalogue
     that NAMES it. Both can arrive AFTER the first render: the catalogue is fetched, and the effect above
     rebuilds the document only when the stored string changes. So a preset reference the catalogue had not
     yet named stayed raw text until the author re-picked it (qorus#646). Re-chip the string in hand when
     what recognises its references changes — text mode only, and only when a chip is actually gained or
     lost, so a document being edited is left exactly as it is while nothing new is recognised. */
  useEffect(() => {
    if (!isText) {
      return;
    }
    const rebuilt = templateTextToNodes(lastTextRef.current, naming, templateToken);
    setLocalValue((current: any) =>
      chipValuesOf(current) === chipValuesOf(rebuilt) ? current : rebuilt
    );
  }, [JSON.stringify(naming), String(templateToken)]);

  useDebounce(
    () => {
      pendingEdit.release();
      if (isText) {
        if (lastTextRef.current !== emitted.settled(String(value ?? ''))) {
          emitted.record(lastTextRef.current);
          onChange?.(lastTextRef.current);
        }
        return;
      }
      // the document a string held stands for is that string, not an edit of it
      if (!sameDocument(localValue, documentOf(emitted.settled(value)))) {
        emitted.record(localValue);
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

  /** What the host will hold once the emits in flight come back: what an edit is a change from. */
  const settled = () => emitted.settled(isText ? String(value ?? '') : value);

  /** The text as an edit to send, or nothing where it is what the host will hold. */
  const changedFrom = (text: string) => (text === settled() ? undefined : { edit: text });

  const handleChange = (val: any): void => {
    if (isText) {
      const text = templateNodesToText(val);
      // A line break also arrives by paste and by drag-and-drop; Enter alone is
      // stopped below. Flattened text is shown as the one line it now is.
      if (singleLine && hasLineBreak(text)) {
        lastTextRef.current = flattenToSingleLine(text);
        setPending(changedFrom(lastTextRef.current));
        setLocalValue(templateTextToNodes(lastTextRef.current, naming, templateToken));
        return;
      }
      lastTextRef.current = text;
      setPending(changedFrom(text));
      setLocalValue(val);
      return;
    }
    if (JSON.stringify(val) === '[{"type":"paragraph","children":[{"text":""}]}]') {
      // the empty text a held '' stands for is no edit of it (a click into the field reports it)
      if (sameDocument(val, documentOf(settled()))) {
        setPending(undefined);
        setLocalValue(val);
        return;
      }
      setPending(isEqual(undefined, settled()) ? undefined : { edit: undefined });
      setLocalValue(undefined);
      return;
    }
    setPending(sameDocument(val, documentOf(settled())) ? undefined : { edit: val });
    setLocalValue(val);
  };

  // A chip's hover draws its description as the picker rows draw the same
  // string, and opens on a tap where there is no hover.
  const descriptions = useDescriptionTooltips();

  const descriptionByValue = useMemo(() => getChipTooltipDescriptions(naming), [JSON.stringify(naming)]);

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
        const { item } = describeTemplateReference(naming, tagValue);
        const metadata = item?.metadata as TTemplateMeta | undefined;
        return {
          icon: 'ExchangeDollarLine',
          leftIconProps: { image: metadata?.image },
          label: templateChipLabel(naming, tagValue),
          tooltip: templateTooltip(naming, tagValue, descriptions),
          // The same chip the read summary (`TemplateText`) and the read-only tag draw: a `tiny` box whose
          // label takes the font of the text it sits in, so a reference is the same size in every view.
          size: 'tiny',
          style: { fontSize: 'inherit' },
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
          /* Drawn, as the picker row draws the same string (`descriptionTooltip`):
             left raw, it printed the punctuation the row does not. */
          tooltip: descriptionTooltip(descriptionByValue[tagValue], descriptions),
          // The same chip the read summary and the read-only tag draw — see the `isText` branch above.
          size: 'tiny',
          style: { fontSize: 'inherit' },
          ...getTemplateTagStyle(tag.metadata),
        };
      }

      return {};
    },
    [descriptionByValue, descriptions, isText, naming]
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

  /* The field's templates, two ways (qorus#646): browsed, in the hierarchical list a click, a tap or the
     keyboard coming in opens (`tags`, the editor's own - see `useTemplateTags`); and found by what is typed
     after a `$`, in the completion list typing opens everywhere (`CompletionMenu`), as an expression's Text
     view does. */
  const tags = useTemplateTags(templates, allowTemplates);
  const editorRef = useRef<TReqoreRichTextEditorRef>(null);
  const completionMenuId = useMemo(() => `completion-menu-text-${++textCompletionMenuCounter}`, []);
  const templateItems = useMemo(
    () => (allowTemplates ? templateCompletionItems(templates) : []),
    [allowTemplates, templates]
  );
  const offerTemplates = useCallback(async () => templateItems, [templateItems]);
  const autocomplete = useLspAutocomplete({
    getCompletions: offerTemplates,
    isReady: !readOnly && templateItems.length > 0,
    triggerCharacters: TEMPLATE_TRIGGERS,
    converter: defaultSlateConverter,
    inserter: templateChipInserter,
  });

  const formattedValue: IReqoreRichTextEditorProps['value'] =
    typeof localValue !== 'object' ? [{ type: 'paragraph', children: [{ text: String(localValue ?? '') }] }]
    : localValue === null ? undefined
    : localValue;


  /* Everything the caller passed, minus its own `tags` — see the prop's doc
     above: on a form field that name means the chips to show, while the
     editor's `tags` is the template catalogue this component computes. */
  const editorProps = { ...rest };
  delete (editorProps as { tags?: unknown }).tags;

  return (
    <>
    <ReqoreRichTextEditor
      ref={editorRef}
      value={formattedValue}
      onChange={(val: any) => {
        handleChange(val);
        if (editorRef.current) autocomplete.onSlateChange(editorRef.current as any, val);
      }}
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
        ...TEMPLATE_BROWSE_LIST_PROPS,
        ...(rest.tagsListProps || {}),
      }}
      getTagProps={handleGetTagProps}
      tags={tags}
      // what is typed after a `$` is completed in the list at the caret: a screen reader is told it completes
      aria-autocomplete='list'
      aria-expanded={autocomplete.isOpen}
      aria-controls={completionMenuId}
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
    <CompletionMenu
      autocomplete={autocomplete}
      id={completionMenuId}
      onSelect={(item) => editorRef.current && autocomplete.onItemSelect(item, editorRef.current as any)}
    />
    </>
  );
});
