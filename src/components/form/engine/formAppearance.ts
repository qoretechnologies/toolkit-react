import { IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import {
  changeDarkness,
  changeLightness,
  getMainBackgroundColor,
} from '@qoretechnologies/reqore/dist/helpers/colors';
import { darken, lighten } from 'polished';
import { createContext, useContext } from 'react';

/**
 * How a form looks. The look only: which fields exist, how they bucket, what a
 * click does and what is validated are identical in every appearance.
 *
 * - `'calm'` (the default) — colour only where something needs a person. The
 *   status boxes are plain panels on the theme's panel surface with label/value
 *   rows split by hairlines; labels are grey; a missing required value is an
 *   amber word instead of a red asterisk and message; counts are quiet numbers;
 *   a healthy row carries no dot; Yes/No are plain words; nothing is forced
 *   into uppercase.
 * - `'classic'` — the earlier read-first look, for a host that asks for it:
 *   tinted status boxes, an intent-coloured completion meter, a status dot on
 *   every row.
 */
export type TFormEngineAppearance = 'calm' | 'classic';

/**
 * The appearance in force for everything below it: the engine's own rows and
 * toolbar, every field editor it mounts, and every nested (`arg_schema`)
 * sub-form, which inherits it unless it is given one of its own.
 *
 * `FormEngine` provides it from its `appearance` prop. A host may also wrap
 * its whole tree in it, to set the appearance once for every form — and for
 * the field components it renders outside a form.
 */
export const FormAppearanceContext = createContext<TFormEngineAppearance | undefined>(undefined);

export const FormAppearanceProvider = FormAppearanceContext.Provider;

/** The appearance in force here; `'calm'` when nothing set one. */
export const useFormAppearance = (): TFormEngineAppearance =>
  useContext(FormAppearanceContext) ?? 'calm';

/** Shorthand for the one question most call sites ask. */
export const useIsCalmForm = (): boolean => useFormAppearance() === 'calm';

/** The theme's own panel surface, when it declares one (Reqore >= 0.78.6). */
const getDeclaredPanelSurface = (
  theme: IReqoreTheme
): { main?: string; border?: string } | undefined => {
  const themed = theme as IReqoreTheme & {
    panel?: { main?: string; border?: string };
    originalMain?: string;
  };
  // Same rule as Reqore's `getThemePanelSurface`: a component whose `main` was
  // moved off the original (a custom theme, an intent) keeps deriving its own.
  return themed.panel && (!themed.originalMain || themed.main === themed.originalMain) ?
      themed.panel
    : undefined;
};

/**
 * The surface a calm section paints, matching the one Reqore gives a panel:
 * `theme.panel.main` when the theme declares one, else the panel shade Reqore
 * derives from `main`. Read here rather than through Reqore's own helper so the
 * whole peer range keeps working — the helper arrived after the floor.
 */
export const getCalmPanelSurface = (theme: IReqoreTheme): string =>
  getDeclaredPanelSurface(theme)?.main ?? changeDarkness(getMainBackgroundColor(theme), 0.03);

/** The neutral 1px edge of a calm section, and of every row inside it. */
export const getCalmPanelHairline = (theme: IReqoreTheme): string =>
  getDeclaredPanelSurface(theme)?.border ?? changeLightness(getMainBackgroundColor(theme), 0.08);

/** The readiness words' two colours: amber for a fault, and the quiet text
 *  colour for what is only still to fill in (the next step, not a warning). */
export const getCalmAttentionColours = (
  theme: IReqoreTheme
): { fault: string; pending: string } => ({
  fault: getCalmIntentText(theme, 'warning'),
  pending: `${(theme.text?.color as string) || '#e8e8e8'}a6`,
});

/** `#rgb` as `#rrggbb` (polished shortens the colours it returns when it can). */
const fullHex = (hex: string): string =>
  /^#[0-9a-f]{3}$/i.test(hex) ?
    `#${hex
      .slice(1)
      .split('')
      .map((digit) => digit + digit)
      .join('')}`
  : hex;

/** WCAG relative luminance of a `#rrggbb` colour (any alpha suffix ignored). */
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/**
 * `color` moved away from its surfaces until it reads at `min` contrast on each
 * of them (WCAG AA for text by default): lighter on dark surfaces, darker on
 * light ones. A colour that already reads comes back unchanged. The same rule as
 * Reqore's `getReadableAccentColor`, which only arrived in Reqore 0.77.2 — read
 * here so the whole peer range works.
 */
export const getReadableOn = (
  color: string,
  surfaces: string | string[],
  min: number = 4.5
): string => {
  const isHex = (value: string) => /^#[0-9a-f]{6}/i.test(value);
  const from = fullHex(color);
  const on = (Array.isArray(surfaces) ? surfaces : [surfaces]).map(fullHex).filter(isHex);
  if (!isHex(from) || !on.length) {
    return color;
  }
  const onLight = luminance(on[0]) > 0.4;
  const reads = (accent: string) => on.every((surface) => contrast(accent, surface) >= min);
  let accent = from.slice(0, 7);
  // 25 steps of 4% cover the whole range, so the loop always ends. polished's
  // lighten/darken, not Reqore's changeLightness/changeDarkness: those turn
  // round once a colour is light enough, so the loop went back and forth.
  for (let step = 0; step < 25 && !reads(accent); step++) {
    accent = fullHex(onLight ? darken(0.04, accent) : lighten(0.04, accent));
  }
  return accent;
};

const INTENT_FALLBACK: Record<string, string> = {
  danger: '#e35a5a',
  warning: '#d17c29',
  info: '#3b8eea',
  success: '#4a7110',
};

/**
 * An intent as TEXT in the calm look. A theme's intents are fills — Reqore's
 * danger is #a82a2a, which as a small line on a near-black form reads at about
 * 2.3:1 — so every calm word that is coloured by what it means (a failure, a
 * fault, the amber "Required · add a value") takes the fill moved until it
 * reads on both surfaces a calm form puts text on: its sections, and the page
 * a read-only form or a nested item sits on directly.
 */
export const getCalmIntentText = (theme: IReqoreTheme, intent: string): string =>
  getReadableOn(
    (theme.intents as Record<string, string> | undefined)?.[intent] ||
      INTENT_FALLBACK[intent] ||
      INTENT_FALLBACK.info,
    [getCalmPanelSurface(theme), getMainBackgroundColor(theme)]
  );

/**
 * The intent a NOTE takes in the calm look: one that only informs (info,
 * success, or none) takes no colour — blue is kept for "a filter is on", green
 * for a healthy figure — while a warning or a failure keeps its intent, because
 * those are what a person has to act on. Every note a calm form draws asks this.
 */
export const calmNoteIntent = <T extends string | undefined>(
  intent: T,
  calm: boolean
): T | undefined =>
  calm && (!intent || intent === 'info' || intent === 'success') ? undefined : intent;

/**
 * What a calm form writes in place of an empty required value. Editable: what
 * to do about it. Read-only: only what is the case, because the reader cannot
 * add anything.
 */
export const CALM_REQUIRED_LABEL = 'Required · add a value';
export const CALM_REQUIRED_READ_LABEL = 'Required · not set';
