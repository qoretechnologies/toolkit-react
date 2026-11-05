import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { useReqoreTheme } from '@qoretechnologies/reqore/dist/hooks/useTheme';
import { useMemo } from 'react';
import { getReadableFaded, getReadableShade, getThemeSurfaces } from '../../helpers/readableColors';
import { TTicketAttention } from './meta';

export interface ITicketAttentionInks {
  /** what has gone wrong and needs a person (an urgent priority) */
  bad: string;
  /** what waits on the person looking (a reply, a triage, an access request, a grant about to end) */
  warn: string;
  /** a state nobody has to act on: the soft shade of the text */
  quiet: string;
  /** a fact rather than a state (a category, a separator, a mark beside a sentence): softer still */
  fact: string;
}

/** Whether an attention asks the person looking for something: the only ones drawn in a color. */
export const ticketAttentionNeedsSomeone = (attention: TTicketAttention): boolean =>
  attention === 'bad' || attention === 'warn';

/**
 * The colors a ticket's attention is drawn in, for the calm look: the intent's shade that
 * reads on this theme for what needs a person, a soft shade of the text for everything
 * else. One home, so the ticket's words and the workspace-access line say "needs you" in
 * the same amber.
 */
export const useTicketAttentionInks = (): ITicketAttentionInks => {
  const theme = useReqoreTheme();

  return useMemo(() => {
    const surfaces = getThemeSurfaces(theme);
    const text = getReadableColor(theme);

    return {
      bad: getReadableShade(theme.intents?.danger || '#c11c1c', surfaces),
      warn: getReadableShade(theme.intents?.warning || '#d17c29', surfaces),
      quiet: getReadableFaded(text, surfaces, 0.7),
      fact: getReadableFaded(text, surfaces, 0.55),
    };
  }, [theme]);
};

/** The ink for one attention; `fact` picks the softer shade for what is not a state. */
export const ticketAttentionInk = (
  inks: ITicketAttentionInks,
  attention: TTicketAttention,
  fact?: boolean
): string =>
  attention === 'bad' ? inks.bad
  : attention === 'warn' ? inks.warn
  : fact ? inks.fact
  : inks.quiet;
