// Copyright 2026 Qore Technologies, s.r.o.
// A string holding template references, as the nodes a rich-text editor draws.
//
// A field whose value is a plain string can still hold references —
// `Dear $local:name` — and those should read as the names they were chosen by,
// not as their spelling. These convert between the stored string and the
// editor's paragraphs, where each reference is a chip, so the editor can draw
// chips while the field keeps storing exactly the string it always stored.
import { IReqoreRichTextEditorProps } from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { getTagLabel } from '../components/dpqlEditor/dpqlHelpers';
import { describeTemplateReference, TEMPLATE_TOKEN_SOURCE } from './templates';

type TRichTextNodes = IReqoreRichTextEditorProps['value'];

/**
 * What a reference chip says: the name the catalogue gives the reference, else
 * the reference as the DPQL Text view labels it (`local: name`), so the same
 * reference reads alike in the Visual builder and the Text view.
 */
export const templateChipLabel = (templates: IReqoreFormTemplates | undefined, value: string): string => {
  const { label, item } = describeTemplateReference(templates, value);
  return item ? label : getTagLabel(value);
};

/**
 * `text` as paragraphs, one per line, with each template reference a chip.
 *
 * A chip is an inline VOID and holds no text of its own, so a cursor can only
 * sit in the text nodes around it; one is kept on each side even when empty.
 * The chip's label is `templateChipLabel`.
 */
export const templateTextToNodes = (text: string, templates?: IReqoreFormTemplates): TRichTextNodes =>
  (text ?? '').split('\n').map((line) => {
    const children: any[] = [];
    // A fresh expression per line: a shared /g instance carries `lastIndex`.
    const pattern = new RegExp(TEMPLATE_TOKEN_SOURCE, 'g');
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      const { item } = describeTemplateReference(templates, match[0]);
      children.push({ text: line.slice(last, match.index) });
      children.push({
        type: 'tag',
        value: match[0],
        label: templateChipLabel(templates, match[0]),
        metadata: item?.metadata,
        children: [{ text: '' }],
      });
      last = match.index + match[0].length;
    }
    children.push({ text: line.slice(last) });
    return { type: 'paragraph', children };
  }) as TRichTextNodes;

/** The string the paragraphs stand for: each chip written as its reference. */
export const templateNodesToText = (nodes?: TRichTextNodes): string =>
  (nodes ?? [])
    .map((paragraph: any) =>
      (paragraph?.children ?? [])
        .map((node: any) =>
          typeof node?.text === 'string' ? node.text
          : node?.type === 'tag' ? String(node.value ?? '')
          : ''
        )
        .join('')
    )
    .join('\n');
