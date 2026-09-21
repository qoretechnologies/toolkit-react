import { IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { useReqoreProperty } from '@qoretechnologies/reqore';
import {
  IQorusFormField,
  IQorusFormSchema,
  TQorusForm,
  TQorusFormFieldSchema,
} from '@qoretechnologies/ts-toolkit';
import { MutableRefObject } from 'react';
import { createContext } from 'use-context-selector';
import { IOperatorsSchema } from './FormEngine';
import { TOptionActions } from './optionActions';

/**
 * The complete closure surface of the (former) `renderCompactRow` function,
 * threaded into the extracted `CompactRow` component via `use-context-selector`
 * so each row reads only the fields it needs. Assembled once (memoised) by
 * `FormEngine` and provided around the compact render output.
 */
/**
 * Renders the read-first preview of a `code-editor` value.
 *
 * @param value the field's source text
 * @param name the field's name
 * @param schema the field's schema, when the form has one for it
 * @param options every field's schema in the same scope
 * @param values every field's current value in the same scope, so the language
 * can be resolved from a sibling field rather than configured twice
 */
export type TCodePreviewRenderer = (props: {
  value: string;
  name: string;
  schema?: TQorusFormFieldSchema;
  options?: IQorusFormSchema;
  values?: TQorusForm;
}) => React.ReactNode;

export interface ICompactRowContext {
  // Props / config
  readOnly?: boolean;
  /**
   * What a click on a READ-ONLY row should do, when the consumer has somewhere
   * to send it.
   *
   * A read-only row is not a control, so by default it opens nothing: it shows
   * everything it has and answers a click with silence. That is right when
   * there is nowhere else to go, and a dead end when there is — a reader
   * clicking a value they want to change is telling you exactly what they want,
   * and being ignored teaches them the surface is broken.
   *
   * Given this, the row becomes the way in to wherever that field IS editable,
   * and says so: it takes a button's role and keyboard handling. Without it
   * nothing changes, so a read-only form with no editor behind it stays inert.
   */
  onReadOnlyActivate?: (optionName: string) => void;
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
  optionActions?: TOptionActions;
  /**
   * Injected actions render inside the row's overflow menu instead of as inline
   * buttons. True on touch (where a hover-gated button is unreachable) and on
   * narrow viewports. Resolved once by FormEngine so rows share one subscription.
   */
  collapseOptionActions?: boolean;
  renderOption: (
    optionName: string,
    field: IQorusFormField,
    editorSize?: 'small',
    suppressSchemaMessages?: boolean
  ) => React.ReactNode;
  /**
   * Draws the read-first preview of a `code-editor` value.
   *
   * The built-in preview is a plain monospace block: this package cannot ship a
   * syntax highlighter, and a code editor is exactly the dependency it keeps out
   * (which is why the *editor* for `code-editor` also arrives through
   * `componentOverrides`).  A host that already has a highlighter supplies one
   * here and gets highlighted source in the row; everyone else keeps the plain
   * block.  `options` is handed over so a host can resolve the language from a
   * sibling field rather than being told it twice.
   */
  codePreviewRenderer?: TCodePreviewRenderer;

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
