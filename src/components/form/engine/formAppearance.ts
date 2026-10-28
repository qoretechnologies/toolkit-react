import { IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import {
  changeDarkness,
  changeLightness,
  getMainBackgroundColor,
} from '@qoretechnologies/reqore/dist/helpers/colors';
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
  fault: theme.intents?.warning || '#d17c29',
  pending: `${(theme.text?.color as string) || '#e8e8e8'}a6`,
});

/**
 * What a calm form writes in place of an empty required value. Editable: what
 * to do about it. Read-only: only what is the case, because the reader cannot
 * add anything.
 */
export const CALM_REQUIRED_LABEL = 'Required · add a value';
export const CALM_REQUIRED_READ_LABEL = 'Required · not set';
