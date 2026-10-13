// Copyright 2026 Qore Technologies, s.r.o.
// A color, read: a swatch beside the color written out - the one read-only rendering of a stored color,
// drawn by a compact form row and by any page that shows one (qorus#646).

import { useReqoreTheme } from '@qoretechnologies/reqore';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { BACKGROUND_IMG } from '@uiw/react-color-alpha';
import { CSSProperties, HTMLAttributes, memo } from 'react';
import styled, { css } from 'styled-components';
import { htmlElementProps } from '../../helpers/domProps';
import { describeColorValue } from './colorValue';
import { DEFAULT_COLOR_VALUE_LABELS, IReqraftColorValueLabels } from './labels';

export {
  colorToCss,
  describeColorValue,
  formatColorValue,
  hexGivesOpacity,
  isStoredColor,
  readHexColor,
  storedColorProblem,
} from './colorValue';
export type { IReqraftRgba, TReqraftColorValueDescription } from './colorValue';
export { DEFAULT_COLOR_VALUE_LABELS } from './labels';
export type { IReqraftColorValueLabels } from './labels';

/**
 * `normal` for a value shown on its own (a detail page); `compact` for a one-line summary (a form row, a
 * table cell): a smaller swatch, closer to its text.
 */
export type TReqraftColorValueSize = 'normal' | 'compact';

export interface IReqraftColorValueProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The stored color: `{ r, g, b }`, `{ r, g, b, a }`, `{ hex }` or a hex code, with or without its `#`. */
  value: unknown;
  /** `normal` (default) or `compact`. */
  size?: TReqraftColorValueSize;
  /**
   * Whether the text wraps where it does not fit, or keeps to one line ending in an ellipsis. A compact
   * value keeps to one line unless told otherwise; a normal one wraps.
   */
  wrap?: boolean;
  /** The words, where they are not English. */
  labels?: Partial<IReqraftColorValueLabels>;
}

const SIZES: Record<
  TReqraftColorValueSize,
  { swatch: number; swatchRadius: number; gap: number; padding: string; radius: number }
> = {
  // a compact form row's color, as it has always been drawn
  compact: { swatch: 12, swatchRadius: 3, gap: 6, padding: '1px 8px', radius: 4 },
  normal: { swatch: 20, swatchRadius: 4, gap: 8, padding: '2px 10px', radius: 6 },
};

/** The swatch: the color over a checkerboard at the normal size, so that transparency shows. */
const StyledSwatch = styled.span<{
  $color: string;
  $border: string;
  $size: number;
  $radius: number;
  $checker: boolean;
}>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $radius }) => $radius}px;
  flex: 0 0 auto;
  border: 1px solid ${({ $border }) => $border};
  ${({ $color, $checker }) =>
    $checker ?
      css`
        background:
          linear-gradient(${$color}, ${$color}),
          url(${BACKGROUND_IMG}) left center / 8px 8px,
          #fff;
      `
    : css`
        background: ${$color};
      `}
`;

/**
 * A stored color, read: a swatch painted the color, beside the color written out (`#6495ED`, or `rgba(…)`
 * when it is see-through), on a wash of the color. The text is the value, so it reads, copies and is found
 * like any text; the swatch is an image whose text alternative names the color.
 *
 * A value that is not a color draws no swatch: it says what the value is ("Not a color: “#zzz”"). With no
 * value it says there is no color. Every shape a color is stored in is read (`describeColorValue`).
 */
export const ReqraftColorValue = memo(
  ({
    value,
    size: askedSize,
    wrap,
    labels,
    className,
    style,
    ...rest
  }: IReqraftColorValueProps) => {
    const theme = useReqoreTheme();
    const words = { ...DEFAULT_COLOR_VALUE_LABELS, ...labels };
    const description = describeColorValue(value);
    // a control group hands its own size (small, big, ...) to what it holds: any size but compact is normal
    const size: TReqraftColorValueSize = (askedSize as string) === 'compact' ? 'compact' : 'normal';
    // what a span takes, and nothing a control group hands it (fluid, spaceBetween, ...)
    const elementProps = htmlElementProps(rest);
    const metrics = SIZES[size];
    const wraps = wrap ?? size === 'normal';
    const cText = theme?.text?.color || '#f1f0ee';

    const layout: CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: metrics.gap,
      // as wide as what it shows: as an item of a flex column it would stretch, its wash across the column
      width: 'fit-content',
      minWidth: 0,
      maxWidth: '100%',
      ...(wraps ? { flexWrap: 'wrap' } : {}),
    };
    const textStyle: CSSProperties =
      wraps ?
        { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }
      : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

    if (description.kind !== 'color') {
      return (
        <span
          {...elementProps}
          className={`reqraft-color-value${className ? ` ${className}` : ''}`}
          data-size={size}
          {...(description.kind === 'invalid' ?
            { 'data-invalid': 'true' }
          : { 'data-empty': 'true' })}
          style={{
            ...layout,
            color: getReadableColor(theme, undefined, undefined, true),
            ...style,
          }}
        >
          <span className='reqraft-color-value-text' style={textStyle}>
            {description.kind === 'invalid' ? words.invalid(description.shown) : words.empty}
          </span>
        </span>
      );
    }

    const alternative = words.swatch(description.text);

    return (
      <span
        {...elementProps}
        className={`reqraft-color-value${className ? ` ${className}` : ''}`}
        data-size={size}
        data-color={description.text}
        style={{
          ...layout,
          // a slight wash of the color behind the swatch and its text
          background: `color-mix(in srgb, ${description.css} 14%, transparent)`,
          padding: metrics.padding,
          borderRadius: metrics.radius,
          ...style,
        }}
      >
        <StyledSwatch
          className='reqraft-color-value-swatch'
          role='img'
          aria-label={alternative}
          title={alternative}
          data-swatch={description.css}
          $color={description.css}
          $border={`${cText}14`}
          $size={metrics.swatch}
          $radius={metrics.swatchRadius}
          $checker={size === 'normal'}
        />
        <span className='reqraft-color-value-text' style={textStyle}>
          {description.text}
        </span>
      </span>
    );
  }
);

ReqraftColorValue.displayName = 'ReqraftColorValue';
