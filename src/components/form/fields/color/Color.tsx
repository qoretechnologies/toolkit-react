// Copyright 2026 Qore Technologies, s.r.o.
import { useReqoreTheme } from '@qoretechnologies/reqore';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import {
  ColorResult,
  hexToRgba,
  HsvaColor,
  RgbaColor,
  rgbaToHsva,
  validHex,
} from '@uiw/color-convert';
import Sketch, { SketchProps } from '@uiw/react-color-sketch';
import { rgba } from 'polished';
import { useEffect, useMemo, useRef } from 'react';
import styled, { css } from 'styled-components';
import { useCoarsePointer } from '../../../../hooks/useCoarsePointer';

/** The colour an `rgbcolor` field stores. */
export interface IColorFormFieldValue {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface IColorFormFieldProps extends Pick<SketchProps, 'presetColors' | 'className'> {
  value?: IColorFormFieldValue;
  onChange?: (value: Required<IColorFormFieldValue>) => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Leave out the transparency slider and keep the stored transparency (the default). */
  disableAlpha?: boolean;
}

/**
 * What the picker shows while the field holds no colour: the picker's own starting colour. A constant, so
 * clearing the value moves the picker back to it, and an empty field does not reset it on every render.
 */
const NO_COLOR: HsvaColor = { h: 209, s: 36, v: 90, a: 1 };

const isChannel = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * A stored colour as red, green, blue and alpha: `{ r, g, b, a? }` as the field stores it, or a hex colour,
 * bare or as `{ hex }`, as a value written by hand or by another client can be. Undefined when it is none
 * of these.
 */
export const colorToRgba = (value: unknown): RgbaColor | undefined => {
  if (typeof value === 'string') {
    const hex = value.trim();
    return validHex(hex) ? hexToRgba(hex.startsWith('#') ? hex : `#${hex}`) : undefined;
  }
  if (value && typeof value === 'object') {
    const { r, g, b, a, hex } = value as Partial<RgbaColor> & { hex?: unknown };
    if (isChannel(r) && isChannel(g) && isChannel(b)) {
      return { r, g, b, a: isChannel(a) ? a : 1 };
    }
    if (typeof hex === 'string') {
      return colorToRgba(hex);
    }
  }
  return undefined;
};

const sameRgba = (x: RgbaColor, y: RgbaColor): boolean =>
  x.r === y.r && x.g === y.g && x.b === y.b && x.a === y.a;

/** A finger's target: the smallest a control should be on a touch screen. */
const TAP_TARGET_PX = 44;

interface IStyledColorFieldProps {
  $coarse: boolean;
  $disabled: boolean;
  $text: string;
}

/**
 * The picker draws itself as a popover on a white page, with inline styles, so its colours, spacing and sizes
 * are set here over them: it takes the field's width up to 400px, sits flush with the field's other content,
 * takes the theme's text colours, and on a touch screen its bars, swatches and inputs grow to a finger's
 * size.
 */
export const StyledColorField = styled.div<IStyledColorFieldProps>`
  width: 100%;
  max-width: 400px;
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'auto')};

  .w-color-sketch {
    width: 100% !important;
    --sketch-background: transparent !important;
    --sketch-box-shadow: none !important;
    --sketch-swatch-border-top: 1px solid ${({ $text }) => rgba($text, 0.15)} !important;
  }

  /* flush with the field's other content: the picker pads itself as a popover would */
  .w-color-sketch > div:first-child {
    padding: 0 0 8px !important;
  }

  .w-color-sketch > div:nth-child(2) {
    margin: 0 0 3px !important;
  }

  .w-color-swatch {
    padding-left: 0 !important;
  }

  ${({ $coarse }) =>
    !$coarse &&
    css`
      /* the field's compact colour area; a finger gets the picker's own, taller one */
      .w-color-saturation {
        height: 100px !important;
      }
    `}

  .w-color-editable-input {
    --editable-input-color: ${({ $text }) => $text} !important;
    --editable-input-label-color: ${({ $text }) => rgba($text, 0.7)} !important;
    --editable-input-box-shadow: inset 0 0 0 1px ${({ $text }) => rgba($text, 0.3)} !important;
  }

  ${({ $coarse }) =>
    $coarse &&
    css`
      .w-color-hue,
      .w-color-alpha {
        height: 24px !important;
      }

      .w-color-swatch > div {
        width: ${TAP_TARGET_PX}px !important;
        height: ${TAP_TARGET_PX}px !important;
      }

      .w-color-editable-input input {
        min-height: ${TAP_TARGET_PX}px;
        /* below 16px a phone zooms the page in to type */
        font-size: 16px !important;
      }
    `}
`;

/**
 * The `rgbcolor` field: a Sketch colour picker (`@uiw/react-color-sketch`) that stores `{ r, g, b, a }`.
 *
 * The picker works in hue, saturation and value, and a stored colour is red, green and blue. A colour the
 * picker sent comes back as the field's value, and turned back into hue it can lose what the picker had:
 * a grey has no hue, so moving the saturation to a grey would throw the hue slider back to red. So the
 * colour the picker sent is handed back to it as it sent it, and only a value that changed somewhere else
 * is converted.
 */
export const ColorFormField = ({
  value,
  onChange,
  disabled,
  readOnly,
  disableAlpha = true,
  presetColors,
  className,
}: IColorFormFieldProps) => {
  const theme = useReqoreTheme();
  const coarse = useCoarsePointer();
  const field = useRef<HTMLDivElement>(null);
  const sent = useRef<{ rgba: RgbaColor; hsva: HsvaColor } | undefined>(undefined);
  const locked = !!(disabled || readOnly);

  const stored = colorToRgba(value);
  const { r, g, b, a } = stored ?? {};

  const color = useMemo((): HsvaColor => {
    if (!isChannel(r) || !isChannel(g) || !isChannel(b) || !isChannel(a)) {
      return NO_COLOR;
    }
    const rgbaValue = { r, g, b, a };
    return sent.current && sameRgba(sent.current.rgba, rgbaValue)
      ? sent.current.hsva
      : rgbaToHsva(rgbaValue);
  }, [r, g, b, a]);

  // `inert` takes the picker out of reach of the pointer, the keyboard and assistive technology at once:
  // its sliders are focusable and move with the arrow keys. Set on the element, as React 18 and React 19
  // disagree about the attribute's value.
  useEffect(() => {
    if (field.current) {
      field.current.inert = locked;
    }
  }, [locked]);

  const handleChange = (result: ColorResult) => {
    if (locked) {
      return;
    }
    // Without its slider the transparency is not the picker's to change. It would: a hex colour written
    // in, or a swatch tapped, comes back opaque.
    const a = disableAlpha ? (stored?.a ?? 1) : result.rgba.a;
    const next = { r: result.rgba.r, g: result.rgba.g, b: result.rgba.b, a };
    sent.current = { rgba: next, hsva: { ...result.hsva, a } };
    // A hue moved on a grey is the same colour: nothing to store.
    if (stored && sameRgba(stored, next)) {
      return;
    }
    onChange?.(next);
  };

  return (
    <StyledColorField
      ref={field}
      className={className ? `reqraft-color-field ${className}` : 'reqraft-color-field'}
      aria-disabled={locked || undefined}
      $coarse={coarse}
      $disabled={!!disabled}
      $text={getReadableColor(theme)}
    >
      <Sketch
        color={color}
        onChange={handleChange}
        disableAlpha={disableAlpha}
        {...(presetColors !== undefined ? { presetColors } : {})}
      />
    </StyledColorField>
  );
};

export default ColorFormField;
