// Copyright 2026 Qore Technologies, s.r.o.
import { TReqoreEffectColor } from '@qoretechnologies/reqore/dist/components/Effect';
import { useReqoreTheme } from '@qoretechnologies/reqore/dist/hooks/useTheme';
import { mix, saturate, tint } from 'polished';
import { useMemo } from 'react';
import { useIsCalmForm } from '../components/form/engine/formAppearance';
import { getReadableShade, getThemeSurfaces, READABLE_ICON } from '../helpers/readableColors';

export interface IDestructiveButtonProps {
  intent: 'danger';
  iconColor: TReqoreEffectColor;
  labelEffect: { color: TReqoreEffectColor };
  transparent?: true;
}

/**
 * How a destructive control is drawn - a bin, Remove, Clear - wherever reqraft draws one, so every one of them is
 * the same: the danger intent, so the host's theme decides how an intent looks (qorus-ide's calm theme draws a red
 * icon, red words and a red edge at rest, Reqore's `buttons.intentLook`), and its icon and words in a shade of the
 * danger that reads on the surfaces it sits on, in a light theme and a dark one.
 *
 * Reqore draws a minimal intent's icon as a pale tint of the intent on a wash of it, which on a light theme is a
 * pale pink on a pale pink square, barely seen (Qlip build 482). The classic look keeps that drawing where it reads
 * (a dark theme) and moves the tint until it does where it does not. The calm look draws no wash - a destructive
 * control says so in red, not with a block of color - and the danger itself, made to read.
 */
export const useDestructiveButtonProps = (): IDestructiveButtonProps => {
  const theme = useReqoreTheme();
  const calm = useIsCalmForm();

  return useMemo(() => {
    const danger = (theme.intents as Record<string, string | undefined> | undefined)?.danger || '#e35a5a';
    const surfaces = getThemeSurfaces(theme);
    const color = (
      calm ?
        getReadableShade(danger, surfaces, READABLE_ICON)
        // Reqore's own drawing: the intent tinted, on a 20% wash of it
      : getReadableShade(
          saturate(1, tint(0.8, danger)),
          surfaces.map((surface) => mix(0.2, danger, surface)),
          READABLE_ICON
        )) as TReqoreEffectColor;
    return {
      intent: 'danger' as const,
      iconColor: color,
      labelEffect: { color },
      ...(calm ? { transparent: true as const } : {}),
    };
  }, [theme, calm]);
};
