import {
  IReqoreRichTextEditorProps,
  ReqoreRichTextEditor,
  TReqoreRichTextEditorRef,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { IReqoreTooltip } from '@qoretechnologies/reqore/dist/types/global';
import { IQorusAllowedValue } from '@qoretechnologies/ts-toolkit';
import { isEqual, size } from 'lodash';
import { FocusEvent, KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';
import { Path } from 'slate';
import { ReactEditor } from 'slate-react';
import { useEmittedValues } from '../emittedValues';
import {
  choiceChipAtCursor,
  choiceForValue,
  choiceToNodes,
  choiceValue,
  choiceValueOfNodes,
  DEFAULT_CHOICE_CHIP_BEHAVIOR,
  IChoiceChipBehavior,
  pathOfNode,
  unwrapChoiceChip,
} from '../../../../helpers/choiceChip';
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
   * The choices the field offers, when it offers any. A value that IS one of
   * them — the whole string, as picked from the field's suggestions, or a
   * document of nothing but that string, as an edit of it stores — is drawn as
   * one chip named from the choice (`general` rather than `C07ERBFS0P6`), and
   * is still emitted as that value: the chip's own value is the choice's, and a
   * document that is nothing but the chip reads back as it. A field spreads
   * its schema here, so this is the schema's own key.
   */
  allowed_values?: IQorusAllowedValue[];
  /**
   * What a choice chip does when the author acts on it — Backspace right after
   * it, a click on it. By default each opens the chip into its value as plain
   * text, the cursor at the end, so one letter of what was chosen can be
   * changed; see `IChoiceChipBehavior` for the alternatives. Text that is again
   * exactly one of the choices becomes its chip when the author leaves the
   * field — not while typing, where a choice can be the start of a longer value.
   */
  choiceChip?: IChoiceChipBehavior;
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
  allowed_values,
  choiceChip,
  ...rest
}: IRichTextFormFieldProps) => {
  const isText = valueFormat === 'text';
  /* The Slate editor behind Reqore's, for the two chip actions below: both
     rewrite the document in place, which the editor's props cannot. */
  const editorRef = useRef<TReqoreRichTextEditorRef>(null);
  const chipBehavior = { ...DEFAULT_CHOICE_CHIP_BEHAVIOR, ...choiceChip };
  /* The document the editor shows for a value: a choice by its chip, a text
     with its references as chips, a document as it is. */
  const toLocal = (next: unknown): any => {
    if (isText) {
      const text = String(next ?? '');
      const choice = choiceForValue(text, allowed_values);
      return choice ? choiceToNodes(choice) : templateTextToNodes(text, templates, templateToken);
    }
    const choice = choiceForValue(next, allowed_values);
    return choice ? choiceToNodes(choice) : next;
  };
  const [localValue, setLocalValue] = useState<any>(() => toLocal(value));
  /* What a value stands for: the choice's value when the value is that choice
     by any spelling — the plain string, the chip, a document of just the text —
     else the value itself. Values are compared by this, so opening a chip, or
     typing its id back, is not a change to the value. */
  const standsFor = (next: unknown): unknown => {
    const chip = choiceValueOfNodes(next);
    if (chip !== undefined) {
      return chip;
    }
    const choice = choiceForValue(next, allowed_values);
    return choice ? choiceValue(choice) : next;
  };
  /* In text mode, the string the editor's document stands for. The value that
     comes back from the parent is usually that same string, and rebuilding the
     document from it would hand the editor a new tree on every keystroke —
     which it answers by replacing its content and moving the cursor to the end. */
  const lastTextRef = useRef(isText ? String(value ?? '') : '');
  /* The parent's echo of an emit still in flight is not a change. It arrives
     while the next keys are typed, and rebuilding the document from it threw
     them away. See `EmittedValues`. */
  const emitted = useEmittedValues<unknown>(isEqual);

  useEffect(() => {
    if (emitted.isEcho(isText ? String(value ?? '') : value)) {
      return;
    }
    if (isText) {
      const text = String(value ?? '');
      if (text !== lastTextRef.current) {
        lastTextRef.current = text;
        setLocalValue(toLocal(text));
      }
      return;
    }
    // Compared as what each stands for: a lone choice chip IS the value it
    // draws, so the value coming back is not a change to it.
    if (!isEqual(standsFor(value), standsFor(localValue))) {
      setLocalValue(toLocal(value));
    }
  }, [JSON.stringify(value)]);

  /* The choices usually arrive after the value — they are fetched — so a
     value already shown as text becomes its chip once they do. Only while the
     editor still shows the stored value as it is: an edit in progress is
     never redrawn from under the author. */
  const choiceKey = JSON.stringify(
    allowed_values?.map((choice) => [choice.value, choice.display_name]) ?? null
  );
  useEffect(() => {
    if (!allowed_values?.length) {
      return;
    }
    const shown = isText ? templateNodesToText(localValue) : (choiceValueOfNodes(localValue) ?? localValue);
    const stored = isText ? String(value ?? '') : value;
    if (isEqual(shown, stored) && choiceForValue(stored, allowed_values)) {
      setLocalValue(toLocal(stored));
    }
  }, [choiceKey]);

  useDebounce(
    () => {
      if (isText) {
        if (lastTextRef.current !== String(value ?? '')) {
          emitted.record(lastTextRef.current);
          onChange?.(lastTextRef.current);
        }
        return;
      }
      // A document that is nothing but one choice chip is emitted as the
      // choice's value — what was stored and what the server resolves.
      const next = choiceValueOfNodes(localValue) ?? localValue;
      if (!isEqual(standsFor(next), standsFor(value))) {
        emitted.record(next);
        onChange?.(next);
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
        setLocalValue(toLocal(lastTextRef.current));
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

  /* Opens a choice chip into its value as text and puts the cursor there.
     A click on the chip — a non-editable node — need not have given the
     editor focus, so focus is asked of Slate, which places the DOM caret where
     the selection is and focuses after; but only once the text the chip became
     is rendered (the effect below), since Slate resolves the caret through the
     rendered DOM. Asked any earlier it lost: a DOM `focus()` before the
     transform let the browser put the caret at the editor's start and the
     `selectionchange` it raised beat the render, so the next key typed landed
     there; asked on the next frame, the frame came before React's commit
     often enough. An editor that already has focus (Backspace came from it)
     is returned at once, and its own render puts the caret where the
     selection is. */
  const focusOnceRendered = useRef(false);
  const openChoiceChip = useCallback((path: Path | undefined): void => {
    const editor = editorRef.current;

    if (editor && path && unwrapChoiceChip(editor, path)) {
      focusOnceRendered.current = true;
    }
  }, []);

  useEffect(() => {
    const editor = editorRef.current;

    if (!focusOnceRendered.current || !editor) {
      return;
    }
    focusOnceRendered.current = false;

    try {
      ReactEditor.toDOMNode(editor, editor);
      ReactEditor.focus(editor);
    } catch {
      // Not mounted in a document — nothing to focus.
    }
  }, [localValue]);

  const handleGetTagProps = useCallback(
    (tag: any): IReqoreTagProps => {
      const tagValue = tag.value?.toString();

      if (!tagValue) {
        return {};
      }

      /* One of the field's own choices, drawn by the name it was picked by;
         what it stands for on hover. */
      if (tag.metadata?.allowedValue) {
        return {
          icon: 'ListCheck',
          label: tag.label ?? tagValue,
          tooltip: tag.metadata?.description,
          /* The editor hands the document's own node here, so the chip is
             found by identity; a chip already gone is a click on nothing. */
          ...(chipBehavior.click === 'unwrap' ?
            { onClick: () => openChoiceChip(editorRef.current ? pathOfNode(editorRef.current, tag) : undefined) }
          : {}),
        };
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
    [descriptionByValue, renderMarkdown, isText, templates, chipBehavior.click, openChoiceChip]
  );

  /* Leaving the field: text that is exactly one of the choices becomes its
     chip again, as the picker would have drawn it. Only here, never while
     typing — a choice can be the start of a longer value, and a chip drawn
     under the cursor would swallow it. */
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>): void => {
      const shown = isText ? lastTextRef.current : localValue;

      if (choiceForValue(shown, allowed_values)) {
        setLocalValue(toLocal(shown));
      }
      (rest as { onBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void }).onBlur?.(event);
    },
    [isText, localValue, choiceKey, (rest as { onBlur?: unknown }).onBlur]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (isText && singleLine && event.key === 'Enter') {
        event.preventDefault();
      }
      /* Backspace right after a choice chip opens it rather than deleting it,
         when so configured. Stopped here, at keydown, so the browser raises no
         `beforeinput` for the editor to delete the chip by. */
      if (event.key === 'Backspace' && chipBehavior.backspace === 'unwrap' && editorRef.current) {
        const path = choiceChipAtCursor(editorRef.current);

        if (path) {
          event.preventDefault();
          openChoiceChip(path);
        }
      }
      (rest as { onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void }).onKeyDown?.(event);
    },
    [
      isText,
      singleLine,
      chipBehavior.backspace,
      openChoiceChip,
      (rest as { onKeyDown?: unknown }).onKeyDown,
    ]
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
      ref={editorRef}
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
      onBlur={handleBlur}
      /* A form field carries no document toolbar. Styling was already off, so
         the bar held only undo and redo — drawn by Reqore as a panel as wide as
         the tag list, which under a field reads as an empty 600px menu with two
         greyed icons in it (they are disabled until there is history to walk).
         Both still work from the keyboard, where every other text field's do. */
      actions={{ undo: false, redo: false, styling: false }}
    />
  );
});
