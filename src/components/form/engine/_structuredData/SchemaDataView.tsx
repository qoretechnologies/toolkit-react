import {
  ReqoreCollapsibleContent,
  ReqoreIcon,
  ReqoreLink,
  ReqoreP,
  ReqoreTag,
} from '@qoretechnologies/reqore';
import {
  IQorusFormField,
  IQorusFormSchema,
  TQorusFormFieldSchema,
} from '@qoretechnologies/ts-toolkit';
import React from 'react';
import styled from 'styled-components';
import { useContextSelector } from 'use-context-selector';
import { CompactRowContext } from '../compactRowContext';
import {
  MONO_FONT_STACK,
  StyledCodePreview,
  StyledRowLabel,
  StyledRowValue,
} from '../compactRowStyles';
import {
  fieldLabel,
  findAllowedValueOption,
  formatOptionValue,
  getAllowedValueImage,
  isCodeField,
  orderedKeys,
  recordIdentity,
  titleKeyFor,
} from '../readFirst';
import { isEmptyUiEnvelope, isUiEncodedValue } from './structuredData';

/**
 * A read-only rendering of a value THROUGH the schema that describes it.
 *
 * `StructuredDataView` renders data nobody has described: it has to announce
 * what it found ("Object · 2 fields"), print raw keys, and colour values by
 * inferred type, because inference is all it has. That is the right rendering
 * for untyped data and the wrong one for ours — a form field with an
 * `arg_schema` is a value whose shape, names and choices are all known in
 * advance, and showing it as a data tree asks the reader to decode a structure
 * the form already knows how to say out loud.
 *
 * So a described value is rendered the way the form asked for it, in the form's
 * own clothes:
 *
 * - Field names use `StyledFieldLabel` (a `StyledRowLabel` in the read-only
 *   eyebrow treatment) and values use `StyledRowValue` — the very components the
 *   option rows above are built from. Not a copy of their CSS: a copy is a
 *   second definition of "what a form label looks like", and the two drift the
 *   first time either is touched.
 * - Values are formatted by the same `formatOptionValue` the rows use, so an
 *   `allowed_values` entry resolves to its display name, a bool to Yes/No, a
 *   date to the app's format. The same words appear in the summary, the preview
 *   and the editor.
 * - Fields appear in the schema's order — the order the form puts them in.
 *
 * A list renders as numbered items: the number sits in a left margin with a rule
 * running down beside the fields belonging to it, and the item's first field
 * starts on the number's own line. The rule is what makes a list of multi-field
 * items readable — without it, "which item does this field belong to?" is
 * answered only by counting.
 *
 * Two deliberate properties:
 *
 * - **Nothing is hidden.** A key the schema does not describe is still shown,
 *   under its raw name, after the described ones. A preview that quietly dropped
 *   data would be worse than a raw tree, not better.
 * - **It degrades, it does not fail.** With no schema for a level, the caller
 *   keeps using `StructuredDataView` — undescribed data still deserves the
 *   renderer built for undescribed data.
 */

/** Width of the shared label column, set once on the root (see `labelColumn`). */
const LABEL_COL_VAR = '--schema-view-label-col';

const StyledSchemaView = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

/**
 * One list item: its number in the left margin, its fields beside it.
 *
 * `align-items: start` over a single grid row is what puts the first field on
 * the number's line — the fields are one block starting at the top, not a grid
 * row each, so nothing can push them down past their own marker.
 */
const StyledItem = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 8px;
  align-items: start;
  min-width: 0;
`;

/** The item number. Furniture, so it reads quieter than the data it indexes;
 *  `tabular-nums` keeps "9." and "10." the same width. */
const StyledMarker = styled.div<{ $color: string }>`
  color: ${({ $color }) => $color};
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 20px;
  white-space: nowrap;
`;

/**
 * The item's identifying value, set as its heading.
 *
 * The first field a schema declares is the one that says WHICH item this is — a
 * method's name, a scheme's type — and it was reading as just another row: same
 * size, same weight, sat behind its own label. Scanning seven methods meant
 * reading fourteen lines to find seven names.
 *
 * Promoting the value (not the label) is what makes the list scannable: the eye
 * lands on `init`, `onOrderStatus`, `onConnect` down the left edge, and the
 * supporting fields stay where they were. The label is not lost, it moves to the
 * title attribute — a heading that needs a caption is not a heading.
 */
const StyledItemTitle = styled.div<{ $color: string; $mono: boolean; $accent: string }>`
  color: ${({ $color }) => $color};
  /* An accent bar and a tinted surface, so the name is found by shape and not
     only by size — at seven items, scanning a column of identical-weight text is
     the thing this is trying to remove. The bar sits where the item's own rule
     runs, so the heading reads as the start of that item rather than as a
     decoration floating beside it. */
  display: inline-block;
  background: ${({ $accent }) => `${$accent}1f`};
  border-left: 3px solid ${({ $accent }) => $accent};
  border-radius: 0 4px 4px 0;
  padding: 1px 8px;
  margin-left: -11px;
  /* Outranks the field labels beneath it, which are 600 at 13px.
     One step was not enough: at 14px the name and the "Description" label under
     it read as the same thing, and the reported symptom was exactly that — the
     name looked like another label. Three points and a full weight above the
     labels is what separates "which item is this" from "what is in it". */
  font-weight: 700;
  font-size: 16px;
  line-height: 22px;
  margin-bottom: 3px;
  min-width: 0;
  overflow-wrap: anywhere;
  /* A literal keeps its mono face, one notch down: mono runs visually larger at
     the same pixel size, so 15px here sits level with 16px prose. */
  ${({ $mono }) => ($mono ? `font-family: ${MONO_FONT_STACK}; font-size: 15px;` : '')}
`;

/**
 * Does this record have anything to show BELOW its heading?
 *
 * The heading consumes the identifying field, so a record holding only that has
 * an empty body — and a rule drawn down an empty body is a line to nowhere.
 */
const hasContentUnderHeading = (record: unknown, schema?: IQorusFormSchema): boolean => {
  if (!isRecord(record)) {
    return true;
  }
  const titleKey = titleKeyFor(record, schema);

  return Object.entries(record).some(
    ([key, value]) => key !== titleKey && value !== undefined && value !== null && value !== ''
  );
};

/** The rule tying an item's fields to its number.
 *
 * Same 3px as the heading's accent bar directly above it: at 1px the two read as
 * two different devices stacked on each other rather than one rule running down
 * the item, and the padding drops to 8px so the text stays on the same column.
 *
 * The rule is drawn only when something is actually under the heading. The
 * heading is pulled left of the rule by its own negative margin, so an item
 * whose record holds nothing but its identity showed a 1-2px sliver of line and
 * nothing else — which reads as a rendering artefact, because that is what it
 * was. It keeps a transparent border in that case so the column does not shift.
 */
const StyledItemFields = styled.div<{ $border: string; $rule: boolean }>`
  border-left: 3px solid ${({ $border, $rule }) => ($rule ? $border : 'transparent')};
  padding-left: 8px;
  min-width: 0;
`;

/**
 * A record's fields: one shared label column, values in the next.
 *
 * The column width is a variable set once on the root, so every field of every
 * item lines up on one edge. Sizing per record would align an item's own fields
 * and leave the items ragged against each other, which reads as a rendering
 * fault rather than as a list.
 */
/**
 * A record field's name, in the detail-page vocabulary.
 *
 * Uppercase, tracked and dimmed, so a field name reads as furniture and the
 * VALUE beside it is what the eye lands on. Same treatment the read-only
 * interface panels use, which is the point: an in-editor list of records and a
 * detail-page panel showing the same shape should not look like two components.
 *
 * A variant rather than a change to `StyledRowLabel`: that one is the FORM's own
 * option-row label, and the form's fields are not read-only furniture — they are
 * the things you are about to edit. Composing it keeps the colour, weight base
 * and wrapping behaviour in one place instead of copying them.
 *
 * Applies to the label only. A VALUE is never uppercased: values are frequently
 * case-sensitive — a service method is `onOrderStatus`, not `ONORDERSTATUS` —
 * and the item heading is a value.
 */
const StyledFieldLabel = styled(StyledRowLabel)`
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
`;

const StyledFields = styled.div`
  /* The supporting fields step in under the heading, so the heading keeps the
     left edge to itself. This is the half that answers "the name is written in
     the position of the label": with the labels indented, it no longer is. */
  padding-left: 14px;
  display: grid;
  grid-template-columns: var(${LABEL_COL_VAR}, 140px) minmax(0, 1fr);
  column-gap: 10px;
  row-gap: 2px;
  align-items: baseline;
  min-width: 0;

  /* A row's value truncates because a row is one line high. The preview is the
     place that shows what the row could not, so a long value wraps here instead
     of ellipsising — otherwise opening the preview would reveal exactly as
     little as the line above it. */
  .options-readfirst-valuetext {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    overflow-wrap: anywhere;
  }

  /* Mono faces run visually larger than the UI face at the same pixel size, so
     a literal set at the row's 13px looks a step bolder than the label naming
     it. A hair smaller puts the two back on the same footing. */
  .schema-view-data {
    font-size: 12.5px;
  }
`;

/** A nested level spans both columns and indents under its own name. */
const StyledNested = styled.div<{ $border: string }>`
  grid-column: 1 / -1;
  margin-left: 2px;
  padding-left: 10px;
  border-left: 1px solid ${({ $border }) => $border};
  min-width: 0;
`;

const StyledNestedLabel = styled.div`
  grid-column: 1 / -1;
`;

/** A code value is a block, not a cell: it spans the grid under its own name. */
const StyledCodeCell = styled.div`
  grid-column: 1 / -1;
  min-width: 0;
  margin: 2px 0 4px;
`;

export interface ISchemaDataViewProps {
  /** The stored value, with or without `{type, value}` envelopes. */
  value: unknown;
  /** The schema describing this level — a field's `arg_schema`. */
  schema: IQorusFormSchema;
  /** Show each field's declared type beside its name. */
  showTypes?: boolean;
  /**
   * Colours, taken from the row so the preview matches its surroundings.
   *
   * `accent` marks the identifying heading. It comes from the consuming row's
   * THEME rather than a literal here, so an app that registers its own intent
   * (BRAND_DESIGN §1 names qorus-ide's brand purple as exactly this case) gets
   * its own colour without this component knowing anything about it. It is only
   * ever a fill or a bar, never applied to text: an intent used as text fails
   * contrast — a muted label measures 1.3:1.
   */
  colors: { key: string; muted: string; border: string; accent: string };
  onItemClick?: () => void;
}

/** Look inside a `{type, value}` envelope, once. `isUiEncodedValue` is the
 *  engine's single authority on what an envelope is — a looser test would unwrap
 *  a real user hash that happens to carry a `value` key and drop its siblings. */
const unwrap = (item: unknown): unknown => (isUiEncodedValue(item) ? item.value : item);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * The width of the shared label column, measured from the longest name that will
 * actually be rendered.
 *
 * A fixed width is a guess in both directions: too wide and a name sits far from
 * its value, too narrow and every name ellipsises. Measuring fits the content;
 * the `%` ceiling stops one long name from taking the whole row when the inset
 * is narrow — a phone, or a deeply nested level.
 */
/** Approximate rendered width of one label character, in px. See `labelColumn`. */
const LABEL_CHAR_PX = 9.5;

/** Gap to the value, so the longest label is not flush against it. */
const LABEL_SLACK_PX = 14;

const labelColumn = (value: unknown, schema: IQorusFormSchema): string => {
  const inner = unwrap(value);
  const records = (Array.isArray(inner) ? inner.map(unwrap) : [inner]).filter(isRecord);
  const longest = records.reduce((widest, record) => {
    const own = orderedKeys(record, schema).reduce(
      (max, key) =>
        Math.max(max, fieldLabel(key, schema[key] as TQorusFormFieldSchema | undefined).length),
      0
    );
    return Math.max(widest, own);
  }, 0);
  // px, not `ch`. `ch` is the base font's `0` advance and knows nothing about
  // the label's own treatment — uppercase, semibold, `letter-spacing: 0.06em`,
  // at 12px — so it under-measures by about a tenth. With `overflow-wrap:
  // anywhere` on the label, an under-measured column does not ellipsise, it
  // BREAKS THE NAME IN HALF: `LEGACY_FLAG` came out over two lines the moment
  // the labels became uppercase. Erring high costs a few px of gap; erring low
  // costs a broken word.
  return longest ? `min(${Math.ceil(longest * LABEL_CHAR_PX + LABEL_SLACK_PX)}px, 45%)` : '140px';
};

/**
 * `true` when a value is an address a browser can open.
 *
 * Deliberately per VALUE, not per field: a field named `url` frequently holds
 * something that is not one — a bare path, a regex, a template — and offering
 * those a link promises a destination there is not.
 */
const isNavigableUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^(https?|wss?|ftps?):\/\//i.test(value);

/** One field's value, rendered the way its row above renders it. */
const FieldValue = ({
  field,
  fieldSchema,
  color,
}: {
  field: IQorusFormField;
  fieldSchema: TQorusFormFieldSchema | undefined;
  color: string;
}) => {
  const formatted = formatOptionValue(field, fieldSchema);
  // An allowed value that carries a logo shows it here too, exactly as the row
  // above does — the preview is the same value, so it gets the same treatment.
  const image = getAllowedValueImage(field.value, fieldSchema);

  // Data reads in mono; a chosen label does not.
  //
  // "qorus-session" is a literal the author typed — an identifier where the
  // characters themselves matter, and where a proportional font makes `l`/`1`
  // and `O`/`0` a guess. "Default RBAC" is not data at all: it is the name of a
  // choice, written by whoever wrote the schema, and setting it in mono would
  // dress up a label as a value. Resolving through `allowed_values` is what
  // separates the two, and it is the same lookup that produced the text.
  const isChosenLabel = !!findAllowedValueOption(field.value, fieldSchema);

  return (
    <StyledRowValue $color={color}>
      {field.value === true || field.value === false ?
        <ReqoreTag
          size='small'
          minimal
          intent={field.value === true ? 'success' : 'danger'}
          label={formatted}
        />
      : <span
          className={`options-readfirst-valuetext${isChosenLabel ? '' : ' schema-view-data'}`}
          style={isChosenLabel ? undefined : { fontFamily: MONO_FONT_STACK }}
        >
          {image ?
            <ReqoreIcon
              image={image}
              size='14px'
              style={{ flexShrink: 0, marginRight: 6, verticalAlign: 'middle' }}
            />
          : null}
          {isNavigableUrl(field.value) ?
            // The address IS the link — it used to render as inert text with a
            // separate icon button beside it to open it, which is two things
            // where there is one. ReqoreLink renders a real anchor, so
            // middle-click and "copy link address" still work;
            // `stopPropagation` because the row around it toggles.
            <ReqoreLink
              className='schema-view-open-url'
              href={field.value}
              target='_blank'
              rel='noreferrer noopener'
              onClick={(event: React.MouseEvent) => event.stopPropagation()}
            >
              {formatted}
            </ReqoreLink>
          : formatted}
        </span>
      }
    </StyledRowValue>
  );
};

/** One described hash: its fields as label/value pairs in the shared columns. */
const SchemaRecord = ({
  record,
  schema,
  showTypes,
  colors,
  skipKey,
}: {
  record: Record<string, unknown>;
  schema: IQorusFormSchema;
  showTypes?: boolean;
  colors: ISchemaDataViewProps['colors'];
  /** Rendered as the item's heading already, so it must not repeat as a row. */
  skipKey?: string;
}) => {
  // The SAME host renderer the row above uses for a `code-editor` field. Read
  // from context rather than threaded through props: a nested level is arbitrarily
  // deep, and the renderer is a property of the form, not of any one level.
  const codePreviewRenderer = useContextSelector(CompactRowContext, (v) => v.codePreviewRenderer);
  const cHover = useContextSelector(CompactRowContext, (v) => v.cHover);

  return (
    <StyledFields className='schema-view-fields'>
      {orderedKeys(record, schema)
        .filter((key) => key !== skipKey)
        .map((key) => {
          const fieldSchema = schema[key] as TQorusFormFieldSchema | undefined;
          const nested = (fieldSchema as { arg_schema?: IQorusFormSchema } | undefined)?.arg_schema;
          // A schema-declared field the form materialised but never filled in
          // arrives as `{type: 'int'}` with no `value` key. `unwrap` cannot see
          // that — `isUiEncodedValue` requires a `value` — so it fell through as
          // CONTENT and was wrapped as one below, and `formatOptionValue` counted
          // the envelope's own `type` key: an untouched Runtime Defaults read
          // "Timeout (Seconds) 1 field" three times over while the sub-form it
          // previews correctly said 0/3 set. `fieldSchema` is what licenses the
          // reading: the schema declares this field, so a `{type}`-only object
          // under it is an empty envelope, never somebody's data.
          const raw = record[key];
          // `!nested` is the discriminator, and it is not a detail: a field that
      // declares its OWN level describes what is inside it, so `{type: 'default'}`
      // there is content — the scheme's Scheme Type, reading "Default RBAC" —
      // not an envelope. Only a leaf can be empty in this sense.
      const value =
        fieldSchema && !nested && isEmptyUiEnvelope(raw) ? undefined : unwrap(raw);
          const label = fieldLabel(key, fieldSchema);
          const labelWithType =
            showTypes && fieldSchema?.type ? `${label} · ${fieldSchema.type}` : label;

          // A field that describes its own level renders AS that level, indented
          // under its name — the same decision, one step down.
          if (nested && (isRecord(value) || Array.isArray(value))) {
            return (
              <React.Fragment key={key}>
                <StyledNestedLabel>
                  <StyledFieldLabel $color={colors.key}>{labelWithType}</StyledFieldLabel>
                </StyledNestedLabel>
                <StyledNested $border={colors.border}>
                  <SchemaLevel
                    value={value}
                    schema={nested}
                    showTypes={showTypes}
                    colors={colors}
                  />
                </StyledNested>
              </React.Fragment>
            );
          }

          // A code value is source, and source is read as source: the host's renderer
          // gives it the syntax highlighting (and read-only LSP hover) it has in the
          // Source Code field, and "Show more" keeps a long body from taking over the
          // preview. Flattening it to one mono line — which is what a plain value cell
          // does — throws all of that away for a field whose whole content is code.
          if (isCodeField(fieldSchema) && typeof value === 'string') {
            return (
              <React.Fragment key={key}>
                <StyledNestedLabel>
                  <StyledFieldLabel $color={colors.key}>{labelWithType}</StyledFieldLabel>
                </StyledNestedLabel>
                <StyledCodeCell onClick={(event) => event.stopPropagation()}>
                  <ReqoreCollapsibleContent
                    maxCollapsedHeight={96}
                    buttonProps={{ className: 'options-readfirst-viewmore' }}
                  >
                    {codePreviewRenderer ?
                      codePreviewRenderer({
                        value,
                        name: key,
                        schema: fieldSchema,
                        options: schema,
                        values: record as never,
                      })
                    : <StyledCodePreview
                        className='options-readfirst-code'
                        $bg={cHover}
                        $border={`${colors.border}88`}
                        $fg={colors.key}
                      >
                        {value}
                      </StyledCodePreview>
                    }
                  </ReqoreCollapsibleContent>
                </StyledCodeCell>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={key}>
              <StyledFieldLabel $color={colors.key} title={label}>
                {labelWithType}
              </StyledFieldLabel>
              <FieldValue
                field={{ type: fieldSchema?.type, value } as IQorusFormField}
                fieldSchema={fieldSchema}
                color={colors.key}
              />
            </React.Fragment>
          );
        })}
    </StyledFields>
  );
};

/** A level: a list of numbered items, or a single described hash. */
const SchemaLevel = ({
  value,
  schema,
  showTypes,
  colors,
}: {
  value: unknown;
  schema: IQorusFormSchema;
  showTypes?: boolean;
  colors: ISchemaDataViewProps['colors'];
}) => {
  const inner = unwrap(value);

  if (Array.isArray(inner)) {
    return (
      <>
        {inner.map((item, index) => {
          const record = unwrap(item);
          return (
            <StyledItem key={index} className='schema-view-item'>
              <StyledMarker $color={colors.muted}>{index + 1}.</StyledMarker>
              <StyledItemFields
                $border={colors.border}
                $rule={hasContentUnderHeading(record, schema)}
              >
                {isRecord(record) ?
                  <>
                    {(() => {
                      const identity = recordIdentity(record, schema);
                      if (!identity) {
                        return null;
                      }
                      return (
                        <StyledItemTitle
                          className='schema-view-item-title'
                          $color={colors.key}
                          // A literal keeps the mono treatment it has as a value —
                          // promoting it must not change what it IS. A chosen
                          // label ("Default RBAC") is prose and stays prose.
                          $mono={identity.mono}
                          $accent={colors.accent}
                          title={identity.label}
                        >
                          {identity.text}
                        </StyledItemTitle>
                      );
                    })()}
                    <SchemaRecord
                      record={record}
                      schema={schema}
                      showTypes={showTypes}
                      colors={colors}
                      skipKey={titleKeyFor(record, schema)}
                    />
                  </>
                : <StyledRowValue $color={colors.key}>
                    <span
                      className='options-readfirst-valuetext schema-view-data'
                      style={{ fontFamily: MONO_FONT_STACK }}
                    >
                      {formatOptionValue({ value: record } as IQorusFormField)}
                    </span>
                  </StyledRowValue>
                }
              </StyledItemFields>
            </StyledItem>
          );
        })}
      </>
    );
  }

  if (isRecord(inner)) {
    return <SchemaRecord record={inner} schema={schema} showTypes={showTypes} colors={colors} />;
  }

  return (
    <ReqoreP size='small' style={{ color: colors.key }}>
      {formatOptionValue({ value: inner } as IQorusFormField)}
    </ReqoreP>
  );
};

export const SchemaDataView = React.memo(
  ({ value, schema, showTypes, colors, onItemClick }: ISchemaDataViewProps) => (
    <StyledSchemaView
      className='schema-data-view'
      onClick={onItemClick}
      style={{ [LABEL_COL_VAR]: labelColumn(value, schema) } as React.CSSProperties}
    >
      <SchemaLevel value={value} schema={schema} showTypes={showTypes} colors={colors} />
    </StyledSchemaView>
  )
);

SchemaDataView.displayName = 'SchemaDataView';

/**
 * Whether a value can be rendered through a schema at all.
 *
 * A schema describes fields, so there has to be a described level to show: a
 * hash, or a list of them. A list of scalars has no field names to use and falls
 * back to the untyped renderer, which is the right tool for it.
 */
export const canRenderWithSchema = (value: unknown, schema: unknown): boolean => {
  if (!schema || typeof schema !== 'object' || !Object.keys(schema).length) {
    return false;
  }
  const inner = unwrap(value);
  if (Array.isArray(inner)) {
    return inner.some((item) => isRecord(unwrap(item)));
  }
  return isRecord(inner);
};
