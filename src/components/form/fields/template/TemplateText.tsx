// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreTag } from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { memo } from 'react';
import { IRichtextSegment } from '../../../../helpers/common';
import {
  findTemplate,
  getTemplateTagStyle,
  templateTooltip,
  TTemplateMeta,
} from '../../../../helpers/templates';

export interface ITemplateTextProps {
  /** Prose runs and reference chips, from `templateTextSegments` or
   *  `richtextToSegments` — both produce the same shape on purpose. */
  segments: IRichtextSegment[];
  /** The catalogue the chips are named and explained from. */
  templates?: IReqoreFormTemplates;
  /**
   * A read-only row is the ONLY rendering its value gets, so it wraps and shows
   * every chip. An editable row's value line is a one-line summary you click to
   * open, so it clips instead of growing the row.
   */
  full?: boolean;
  className?: string;
}

/**
 * Flattens the line breaks in one prose segment of a one-line SUMMARY.
 *
 * Every other value type reaches the collapsed row through
 * `whiteSpace: 'nowrap'`, which collapses newlines for free. This renderer is
 * the only one that opts into `'pre'` — it has to, or the space separating a
 * word from the chip beside it is dropped — and `pre` also honours the
 * newlines, which `nowrap` would have eaten.
 *
 * So a genuinely multi-line value (an alert rule's Gmail message body is five
 * `\n`-separated lines) gave every segment after the first a blank first line.
 * The wrapper centres its items, so a two-line-tall box centred against
 * one-line chips put every word 12px below the chip beside it, and the row read
 * as a staircase. Measured on supah: prose boxes 30px against 14px chips.
 *
 * A space, not nothing: consecutive prose segments are merged before they get
 * here, so a value with a break and no chip between its lines would otherwise
 * lose the word boundary entirely.
 */
const collapseSummaryBreaks = (text: string): string => text.replace(/\s*\r?\n\s*/g, ' ');

/**
 * A value that mentions template references, drawn for READING.
 *
 * One renderer, because a value that reads two ways depending on which surface
 * shows it is the defect this exists to close: a skip-when predicate read
 * `$._case.mode != 'simulate'` on the compact row while the editor it opens
 * drew the same reference as a named chip.
 *
 * The literal text around a reference is the AUTHOR'S, and it survives exactly
 * as typed — a predicate is a comparison they wrote, and only the reference in
 * it is the thing the template mechanism exists to name.
 *
 * The chip is `ReqoreTag`, the same one `ReadOnlyTemplateTag` and the rich-text
 * editor use, with the same `$`-icon, the same intent scheme
 * (`getTemplateTagStyle`) and the same hover card (`templateTooltip`), so a
 * reference looks identical wherever it is shown.
 */
export const TemplateText = memo(({ segments, templates, full, className }: ITemplateTextProps) => (
  <span
    className={`reqraft-template-text${className ? ` ${className}` : ''}`}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      minWidth: 0,
      maxWidth: '100%',
      ...(full ? { flexWrap: 'wrap' } : { overflow: 'hidden' }),
    }}
  >
    {segments.map((segment, index) =>
      segment.kind === 'tag' ?
        <ReqoreTag
          key={`tag-${index}`}
          className='reqraft-template-chip'
          size='tiny'
          // The chip's label has to be the same size as the prose it is embedded
          // in. The wrapper centres boxes, so two different text sizes centred
          // against each other cannot share a baseline and the chips visibly
          // float above the words. Inheriting makes centring align the baselines
          // too, at whatever font size the consuming app uses.
          style={{ fontSize: 'inherit' }}
          icon='ExchangeDollarLine'
          label={segment.text || segment.value}
          // The same card the chosen-template chip shows: what the value IS, not
          // the reference that names it.
          tooltip={templateTooltip(templates, segment.value || '')}
          {...getTemplateTagStyle(
            (templates ? findTemplate(templates, segment.value || '') : undefined)?.metadata as
              | TTemplateMeta
              | undefined
          )}
        />
      : <span
          key={`text-${index}`}
          className='reqraft-template-prose'
          // `pre`, not the row's `nowrap`: the single space that separates a
          // word from the chip beside it is real content here, and collapsing
          // it would join them. A read row keeps the newlines too.
          style={{ whiteSpace: full ? 'pre-wrap' : 'pre' }}
        >
          {full ? segment.text : collapseSummaryBreaks(segment.text)}
        </span>
    )}
  </span>
));

TemplateText.displayName = 'TemplateText';
