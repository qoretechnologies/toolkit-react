// Copyright 2026 Qore Technologies, s.r.o.
import { IReqoreDropdownProps } from '@qoretechnologies/reqore/dist/components/Dropdown';
import { useMemo } from 'react';
import { useCompletionListTheme } from '../../../smartEditor/completionStyle';

/** The template list's own surface: a dark purple in the classic look. The calm look draws it neutral (no purple
 *  but for an AI or Qonsole action): see `useTemplatesListProps`. */
export const TemplatesListProps: IReqoreDropdownProps = {
  useTargetWidth: true,
  handler: 'focus',
  minWidth: '300px',
  listCustomTheme: {
    main: '#1e0d29',
  },
};

/**
 * `TemplatesListProps` for the look in force: the list's color is every value list's (`useCompletionListTheme`).
 * Its own module, beside `TemplateField` rather than in it, so a field that only offers templates (`Number`) does
 * not load the template field to draw its list.
 */
export const useTemplatesListProps = (): IReqoreDropdownProps => {
  const listCustomTheme = useCompletionListTheme();
  return useMemo(() => ({ ...TemplatesListProps, listCustomTheme }), [listCustomTheme]);
};
