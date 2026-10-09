// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreRichTextEditorProps } from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { size } from 'lodash';
import { useMemo } from 'react';
import {
  renderTemplateItemDescriptions,
  templateItemsToShow,
} from '../../../../helpers/templateItems';
import { useMarkdownRenderer } from '../../../Description/markdownRendererContext';

/**
 * The templates a rich-text editor lists when it is clicked, tapped or tabbed into, and inserts as chips:
 * the field's own, under "Templates". One list for every text a value is written in - a rich-text field and
 * an expression's Text view alike (qorus#646: the Text view listed nothing until "@" or "$" was typed).
 */
export const useTemplateTags = (
  templates: IReqoreFormTemplates | undefined,
  allowTemplates = true
): IReqoreRichTextEditorProps['tags'] => {
  const renderMarkdown = useMarkdownRenderer();
  return useMemo<IReqoreRichTextEditorProps['tags']>((): IReqoreRichTextEditorProps['tags'] => {
    const tags: IReqoreRichTextEditorProps['tags'] = {};

    if (size(templates?.items) && allowTemplates) {
      tags.templates = {
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
        items: renderTemplateItemDescriptions(
          templateItemsToShow(templates?.items),
          renderMarkdown
        ),
      };
    }

    return tags;
  }, [allowTemplates, templates, renderMarkdown]);
};
