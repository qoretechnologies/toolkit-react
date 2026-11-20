/**
 * Qorus-flavoured wrapper around `ReqoreDataView` (reqore >= 0.69), mirroring
 * qorus-ide's wrapper of the same name. Plugs in the Qorus-specific seams: the
 * `{type, value}` UI envelope, the embedded YAML/JSON string parser, and the
 * Qorus date parsing/formatting. Renders flat/minimal so it slots into rows.
 */
import { reqraftLabels } from '../../../../helpers/reqraftLabels';
import { ReqoreDataView, type IReqoreDataViewEnvelope } from '@qoretechnologies/reqore';
import { memo } from 'react';
import { useIsCalmForm } from '../formAppearance';
import {
  formatIdeTimestamp,
  parseSerializedStructuredText,
  qorusDateStringToIso,
  UI_ENVELOPE_KEY_LIST,
} from './structuredData';

export interface IStructuredDataViewProps {
  value: unknown;
  emptyText?: string;
  /** Sized to its content rather than stretching to the parent width. */
  fitContent?: boolean;
  /** Wrap the root in a collapsible "Object · N fields" summary so it
   *  can be folded away. Defaults to `true`. */
  collapsibleRoot?: boolean;
  /** Show a type-label chip next to each scalar. Defaults to `false`. */
  showTypes?: boolean;
  /** Sections deeper than this start collapsed (reqore default applies
   *  when omitted). */
  defaultExpandDepth?: number;
  /** Row click handler — `path` is the dot-path from the root. */
  onItemClick?: (value: unknown, path: string[]) => void;
}

const QORUS_ENVELOPE: IReqoreDataViewEnvelope = {
  typeKey: 'type',
  valueKey: 'value',
  allowedKeys: UI_ENVELOPE_KEY_LIST,
};

/** Bridge the Qorus date parser into reqore's `parseDate` shape — it
 *  takes (value, type?) and returns ISO (or undefined). Anything the
 *  Qorus parser doesn't recognise falls through to reqore's default. */
const parseQorusDate = (value: string): string | undefined => qorusDateStringToIso(value);

/**
 * The calm look's data: a fact sheet, a key a quiet gray label and a value its text, not a wall of outlined chips.
 * Keys are not blue (blue is a filter that is on) and values are not colored by their type. `keyIntent: null` holds
 * on every Reqore; `plain` and `colorValuesByType` are Reqore 0.79's, and an older Reqore leaves them unread.
 */
const CALM_DATA_VIEW_PROPS = {
  keyIntent: null,
  plain: true,
  colorValuesByType: false,
} as Record<string, unknown>;

export const StructuredDataView = memo(
  ({
    value,
    emptyText,
    fitContent,
    collapsibleRoot = true,
    showTypes,
    defaultExpandDepth,
    onItemClick,
  }: IStructuredDataViewProps) => {
    const calm = useIsCalmForm();
    return (
      <ReqoreDataView
        data={value}
        emptyText={emptyText ?? reqraftLabels().formEngine.noStructuredData}
        collapsibleRoot={collapsibleRoot}
        envelope={QORUS_ENVELOPE}
        parseEmbedded={parseSerializedStructuredText}
        parseDate={parseQorusDate}
        formatDate={formatIdeTimestamp}
        showTypes={showTypes}
        defaultExpandDepth={defaultExpandDepth}
        onItemClick={onItemClick}
        transparent
        minimal
        flat
        size='small'
        rounded
        fluid={!fitContent}
        {...(calm ? CALM_DATA_VIEW_PROPS : {})}
      />
    );
  }
);

StructuredDataView.displayName = 'StructuredDataView';
