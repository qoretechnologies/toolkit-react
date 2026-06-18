import { IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { useReqoreProperty } from '@qoretechnologies/reqore';
import {
  IQorusFormField,
  IQorusFormSchema,
  TQorusForm,
} from '@qoretechnologies/ts-toolkit';
import { MutableRefObject } from 'react';
import { createContext } from 'use-context-selector';
import { IOperatorsSchema } from './FormEngine';

/**
 * The complete closure surface of the (former) `renderCompactRow` function,
 * threaded into the extracted `CompactRow` component via `use-context-selector`
 * so each row reads only the fields it needs. Assembled once (memoised) by
 * `FormEngine` and provided around the compact render output.
 */
export interface ICompactRowContext {
  // Props / config
  readOnly?: boolean;
  commitMode: 'immediate' | 'batched';
  expandMode: 'single' | 'multi';

  // State
  options?: IQorusFormSchema;
  operators?: IOperatorsSchema;
  focusedEditing?: string;
  showFieldTypes: boolean;
  // Global field-info visibility (tri-state): undefined = default (critical
  // messages auto-open), true = show all, false = hide all.
  showAllDescriptions: boolean | undefined;
  // Form templates ($local:…, etc.) — used to resolve a template value to its
  // display name in the read-first chip.
  templates?: IReqoreFormTemplates;
  expandedOptions: string[];
  highlightedOptions: string[];
  flashedOptions: string[];
  infoPanelOverrides: Record<string, boolean>;

  // Setters
  setHighlightedOptions: React.Dispatch<React.SetStateAction<string[]>>;
  setInfoPanelOverrides: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setFocusedEditing: React.Dispatch<React.SetStateAction<string | undefined>>;

  // Refs
  readRowHeights: MutableRefObject<Record<string, number>>;
  originalValue: MutableRefObject<any>;

  // Memoised
  availableOptions: TQorusForm;
  requiredGroupsInfo: {
    members: Record<string, string[]>;
    satisfiedBy: Record<string, string | undefined>;
  };

  // Handlers (useCallback)
  handleValueChange: (optionName: string, val?: any, _type?: string, isFunction?: boolean) => void;
  handleAddOptionalFieldChange: (_name: string, optionName: unknown) => void;
  toggleExpandedOption: (optionName: string) => void;
  flashOption: (optionName: string) => void;
  hasOptionChanged: (optionValue: unknown, optionName: string) => boolean;
  handleOptionLabelClick: (optionName: string) => void;
  removeSelectedOption: (optionName: string) => void;
  getTypeForOption: (type: string) => string;
  isOptionValid: (optionName: string, type: any, optionValue: any) => boolean;
  confirmAction: ReturnType<typeof useReqoreProperty<'confirmAction'>>;

  // Function passed through as a value (stays defined in FormEngine because the
  // classic non-compact path uses it too).
  renderOption: (
    optionName: string,
    field: IQorusFormField,
    editorSize?: 'small',
    suppressSchemaMessages?: boolean
  ) => React.ReactNode;

  // Theme + theme-derived colours
  theme: IReqoreTheme;
  cText: string;
  cMuted: string;
  cFaint: string;
  cKey: string;
  cDivider: string;
  cHover: string;
  cDanger: string;
  cWarning: string;
  cInfo: string;
  cBg: string;
}

export const CompactRowContext = createContext<ICompactRowContext>({} as ICompactRowContext);
