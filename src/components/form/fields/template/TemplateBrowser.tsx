// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreDropdown } from '@qoretechnologies/reqore';
import { IReqoreDropdownProps } from '@qoretechnologies/reqore/dist/components/Dropdown';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { useCallback, useMemo, useRef } from 'react';
import { ITemplateNode, templateTree } from '../../../../helpers/templateTree';
import { TEMPLATE_BROWSE_LIST_PROPS } from '../rich-text/useTemplateTags';
import { TemplatePicker } from './TemplatePicker';

let templateBrowserCounter = 0;

export interface ITemplateBrowserProps extends Omit<IReqoreDropdownProps, 'items'> {
  /** The catalogue browsed: its groups, records and members, as they nest. */
  templates?: IReqoreFormTemplates;
  /**
   * Whether the picker's search box takes the keyboard when it opens - from a button, where typing has nowhere
   * else to go. Left off where it opens from a control that is typed into (an input), which keeps it: the arrows,
   * Enter and Escape are heard from there.
   */
  focusFilter?: boolean;
  /** Whether the field takes a record whole (`ITemplateTreeOptions.wholeRecords`). */
  wholeRecords?: boolean;
}

/**
 * The control a field's templates are chosen from - a picker button, a number's input, a template-only value
 * (qorus#646): the template picker (`TemplatePicker`), the same one an editor opens at its caret, in the control's
 * popover. A catalogue is browsed as it nests, searched at any depth, and a record taken whole or opened. The pick
 * is handed on as the catalogue row it is (`onItemSelect`), a template of any keys with the key written as its
 * value.
 */
export const TemplateBrowser = ({
  templates,
  focusFilter,
  onItemSelect,
  wholeRecords,
  ...rest
}: ITemplateBrowserProps & Record<string, unknown>) => {
  const roots = useMemo(() => templateTree(templates, { wholeRecords }), [templates, wholeRecords]);
  const id = useMemo(() => `template-browser-${++templateBrowserCounter}`, []);
  // the popover's own controls: a pick puts it away
  const popover = useRef<{ close?: () => void } | null>(null);
  const handOn = useCallback(
    (node: ITemplateNode, written?: string) => {
      const row = (node.row ?? { label: node.label, value: node.value }) as Record<string, unknown>;
      /* A group taken whole (a Qog state's data, a record) is a value of its type, which a host reads from the
         item's type or badge as it does a leaf's: a group's own badge is what it is grouped by (its app). */
      const taken =
        node.takesWhole && (node.children?.length || node.loadChildren) ?
          {
            badge: node.type ?? 'hash',
            metadata: { ...(row.metadata as object | undefined), type: node.type ?? 'hash' },
          }
        : {};
      onItemSelect?.({ ...row, ...taken, value: written ?? node.value } as any, undefined as any);
      popover.current?.close?.();
    },
    [onItemSelect]
  );
  return (
    <ReqoreDropdown
      {...TEMPLATE_BROWSE_LIST_PROPS}
      {...(rest as IReqoreDropdownProps)}
      // the picker draws its own rows and keys: the dropdown is its popover
      filterable={false}
      keyboardNavigation={false}
      items={[]}
      passPopoverData={(controls: { close?: () => void }) => {
        popover.current = controls;
        (rest as IReqoreDropdownProps).passPopoverData?.(controls as any);
      }}
      customElements={
        roots.length ?
          [
            <TemplatePicker
              key={id}
              id={id}
              roots={roots}
              focusFilter={focusFilter}
              fill
              keysFromPage={!focusFilter}
              onPick={handOn}
              onClose={() => popover.current?.close?.()}
            />,
          ]
        : undefined
      }
    />
  );
};
