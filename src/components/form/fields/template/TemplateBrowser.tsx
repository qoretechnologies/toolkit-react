// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreDropdown } from '@qoretechnologies/reqore';
import { IReqoreDropdownProps } from '@qoretechnologies/reqore/dist/components/Dropdown';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { useMemo } from 'react';
import {
  renderTemplateItemDescriptions,
  templateItemsToShow,
} from '../../../../helpers/templateItems';
import { useMarkdownRenderer } from '../../../Description/markdownRendererContext';
import { styleTemplateItems } from '../../../smartEditor/completionStyle';
import { TEMPLATE_BROWSE_LIST_PROPS } from '../rich-text/useTemplateTags';

export interface ITemplateBrowserProps extends Omit<IReqoreDropdownProps, 'items'> {
  /** The catalogue browsed: its groups, records and members, as they nest. */
  templates?: IReqoreFormTemplates;
  /**
   * Whether the list takes the keyboard for its filter when it opens - from a button, where typing has nowhere
   * else to go. Left off where the list opens from a control that is typed into (an input), which keeps it.
   */
  focusFilter?: boolean;
}

/**
 * The list a field's templates are browsed in, opened from a control - a picker button, a number's input, a
 * template-only value (qorus#646). Kept apart from the completion list typing opens (`CompletionList`) by
 * David's decision: a large catalogue needs its hierarchy - groups to drill into, a record's "+" to take it
 * whole, an example's "?" - which a completion list has no place for. Drawn as the completion list is (its
 * colour, its rows' kinds and font: `completionStyle`), with the same keys: the arrows move, Enter takes a row,
 * → opens a group and ← leaves it, Escape puts the list away and nothing else. Every Reqore dropdown that lists
 * templates in this package is this one (`oneCompletionList.test`).
 */
export const TemplateBrowser = ({
  templates,
  focusFilter,
  inputProps,
  ...rest
}: ITemplateBrowserProps & Record<string, unknown>) => {
  const renderMarkdown = useMarkdownRenderer();
  /* Drawn here, at the hand-off to Reqore: a description is markdown, and the list is a `JSON.stringify` memo
     key further up (see `renderTemplateItemDescriptions`). */
  const items = useMemo(
    () =>
      styleTemplateItems(
        renderTemplateItemDescriptions(templateItemsToShow(templates?.items), renderMarkdown)
      ),
    [templates, renderMarkdown]
  );
  return (
    <ReqoreDropdown
      filterable
      keyboardNavigation
      {...TEMPLATE_BROWSE_LIST_PROPS}
      {...(rest as IReqoreDropdownProps)}
      inputProps={
        focusFilter ?
          { focusRules: { type: 'auto' }, ...(inputProps as object) }
        : (inputProps as any)
      }
      items={items}
    />
  );
};
