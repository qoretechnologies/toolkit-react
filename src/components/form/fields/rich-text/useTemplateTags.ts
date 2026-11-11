// Copyright 2026 Qore Technologies, s.r.o.
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
import { IReqoreRichTextEditorProps } from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { size } from 'lodash';
import { useMemo } from 'react';
import {
  renderTemplateItemDescriptions,
  templateItemsToShow,
} from '../../../../helpers/templateItems';
import { useMarkdownRenderer } from '../../../Description/markdownRendererContext';
import { useTypeLabel } from '../../typeSentenceForm';
import {
  COMPLETION_LIST_THEME,
  styleTemplateItems,
  useCompletionListTheme,
} from '../../../smartEditor/completionStyle';

/**
 * How the list a field's templates are browsed in is drawn, wherever it opens - an editor's (its `tagsListProps`)
 * or a control's (`TemplateBrowser`): the completion list's color, at least as wide as it.
 */
export const TEMPLATE_BROWSE_LIST_PROPS = {
  minWidth: '300px',
  maxWidth: '600px',
  listCustomTheme: COMPLETION_LIST_THEME,
};

/** `TEMPLATE_BROWSE_LIST_PROPS` in the look in force: the list's color is `useCompletionListTheme`'s. */
export const useTemplateBrowseListProps = (): typeof TEMPLATE_BROWSE_LIST_PROPS => {
  const listCustomTheme = useCompletionListTheme();
  return useMemo(() => ({ ...TEMPLATE_BROWSE_LIST_PROPS, listCustomTheme }), [listCustomTheme]);
};

/**
 * Each template's description led by where it comes from, when its host says (`withTemplateSources`): the list
 * draws a row's description under its name (qorus#646).
 */
const withSourceDescribed = <T>(items: T[] | undefined): T[] | undefined =>
  items?.map((item) => {
    const entry = item as { source?: unknown; description?: unknown; items?: T[] };
    const members = Array.isArray(entry.items) ? withSourceDescribed(entry.items) : entry.items;
    if (typeof entry.source !== 'string' || !entry.source) {
      return members === entry.items ? item : ({ ...entry, items: members } as T);
    }
    const description =
      typeof entry.description === 'string' && entry.description.trim() ?
        `${entry.source} - ${entry.description}`
      : entry.source;
    return {
      ...entry,
      description,
      ...(Array.isArray(entry.items) ? { items: members } : {}),
    } as T;
  });

/**
 * The templates a rich-text editor lists when it is clicked, tapped or tabbed into, and inserts as chips:
 * the field's own, under "Templates". One list for every text a value is written in - a rich-text field and
 * an expression's Text view alike (qorus#646: the Text view listed nothing until "@" or "$" was typed).
 */
export const useTemplateTags = (
  templates: IReqoreFormTemplates | undefined,
  allowTemplates = true
): IReqoreRichTextEditorProps['tags'] => {
  const browserWords = useReqraftLabels().templateBrowser;
  const renderMarkdown = useMarkdownRenderer();
  // a template's type named by the catalogue the surrounding form has, never its code
  const typeLabel = useTypeLabel();
  return useMemo<IReqoreRichTextEditorProps['tags']>((): IReqoreRichTextEditorProps['tags'] => {
    const tags: IReqoreRichTextEditorProps['tags'] = {};

    if (size(templates?.items) && allowTemplates) {
      tags.templates = {
        icon: 'MoneyDollarBoxLine',
        label: browserWords.templates,
        flat: false,
        description: browserWords.universalValues,
        /* The in-editor list already nests everything under "Templates", so a
           lone category makes the author drill through TWO headers to reach
           the only values on offer. Hoist it. */
        /* Drawn here, at the hand-off to Reqore. A description is prose written
           in the same markdown as every other description this package shows,
           and printing its punctuation at the reader was the last surface still
           doing that. Never made further up: the list is a `JSON.stringify`
           memo key in `TemplateField`. */
        items: styleTemplateItems(
          renderTemplateItemDescriptions(
            withSourceDescribed(templateItemsToShow(templates?.items)),
            renderMarkdown
          ),
          typeLabel
        ),
      };
    }

    return tags;
  }, [allowTemplates, templates, renderMarkdown, typeLabel, browserWords]);
};
