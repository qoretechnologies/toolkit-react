/**
 * Story helpers for the A/B test UI: fixtures in the qorus-api shape, and the dark / light /
 * phone variants every visual story ships in.
 */
import { ReqoreContent, ReqoreUIProvider } from '@qoretechnologies/reqore';
import type { ReactNode } from 'react';
import type { IAdminVariant, IExperimentEntry, IExperimentResults } from '../tracking/ui/types';

export const PHONE_VIEWPORT = { width: 390, height: 844 };

/** The page a light-mode product uses: Reqore derives every surface from this `main`. */
export const LIGHT_MAIN = '#f6f6f6';

/** Wraps a story in a light Reqore theme (the preview's own theme is dark). */
export const LightTheme = ({ children }: { children: ReactNode }) => (
  <ReqoreUIProvider
    theme={{ main: LIGHT_MAIN }}
    options={{ animations: { buttons: false, dialogs: false } }}
  >
    <ReqoreContent style={{ padding: 20, minHeight: '100vh' }}>{children}</ReqoreContent>
  </ReqoreUIProvider>
);

type TVariant = 'Dark' | 'Light' | 'Phone';

/**
 * A story in one of the three variants: the description gets the variant's words, Light wraps
 * the story in a light theme, Phone captures at 390 px.
 */
export const variant = <S extends object>(story: S, description: string, mode: TVariant): S => {
  const base = story as S & { parameters?: Record<string, any>; decorators?: any };
  const light = (Story: () => JSX.Element) => (
    <LightTheme>
      <Story />
    </LightTheme>
  );
  return {
    ...story,
    decorators: [...((base.decorators as any[]) ?? []), ...(mode === 'Light' ? [light] : [])],
    parameters: {
      ...base.parameters,
      ...(mode === 'Phone' ? { qlip: { viewport: PHONE_VIEWPORT } } : {}),
      docs: {
        description: {
          story:
            mode === 'Dark' ? description
            : mode === 'Light' ? `${description} On a light theme.`
            : `${description} At phone width (390 px).`,
        },
      },
    },
  };
};

const v = (key: string, name: string, weight: number, control = false): IAdminVariant => ({
  key,
  name,
  weight,
  ...(control ? { control } : {}),
});

const results = (
  numbers: [string, number, number, number | null][],
  patch: Partial<IExperimentResults> = {}
): IExperimentResults => ({
  verdict: 'too-early',
  metrics: [
    {
      key: 'signup-started',
      name: 'Started a sign-up',
      role: 'primary',
      variants: numbers.map(([variant, exposed, converters, chance]) => ({
        variant,
        exposed,
        converters,
        rate: exposed ? converters / exposed : null,
        chance_to_beat: chance,
      })),
    },
  ],
  ...patch,
});

export const EXPERIMENT_KEY = 'signup-cta';

const TWO = [v('a', 'Current button', 0.5, true), v('b', 'Short copy', 0.5)];

export const DRAFT: IExperimentEntry = {
  experiment: {
    key: EXPERIMENT_KEY,
    name: 'Sign-up button copy',
    status: 'draft',
    phase: 1,
    variants: TWO,
  },
  results: null,
};

export const RUNNING_TWO: IExperimentEntry = {
  experiment: {
    key: EXPERIMENT_KEY,
    name: 'Sign-up button copy',
    status: 'running',
    phase: 1,
    variants: TWO,
  },
  results: results(
    [
      ['a', 1240, 112, null],
      ['b', 1228, 139, 0.91],
    ],
    {
      verdict: 'likely-winner',
      winner_variant: 'b',
      verdict_text:
        'Short copy is likely better: 91% chance it beats Current button on “Started a sign-up”.',
    }
  ),
};

export const RUNNING_FIVE: IExperimentEntry = {
  experiment: {
    key: EXPERIMENT_KEY,
    name: 'Pricing page headline',
    status: 'running',
    phase: 1,
    variants: [
      v('a', 'Current headline', 0.2, true),
      v('b', 'Price first', 0.2),
      v('c', 'Customer quote', 0.2),
      v('d', 'Question', 0.2),
      v('e', 'Numbers', 0.2),
    ],
  },
  results: results([
    ['a', 604, 41, null],
    ['b', 598, 47, 0.72],
    ['c', 611, 38, 0.36],
    ['d', 590, 44, 0.61],
    ['e', 602, 30, 0.12],
  ]),
};

export const PAUSED: IExperimentEntry = {
  experiment: {
    key: EXPERIMENT_KEY,
    name: 'Sign-up button copy',
    status: 'paused',
    phase: 2,
    variants: TWO,
    phases: [
      {
        phase: 1,
        started_at: '2026-09-10T08:00:00Z',
        ended_at: '2026-09-20T10:00:00Z',
        variants: [...TWO, v('c', 'Emoji', 0.33)],
      },
      { phase: 2, started_at: '2026-09-20T10:00:00Z', ended_at: null, variants: TWO },
    ],
    history: [
      { at: '2026-09-20T10:00:00Z', action: 'remove-variant', variant: 'c', actor: 'admin' },
    ],
  },
  results: results(
    [
      ['a', 380, 31, null],
      ['b', 371, 33, 0.64],
    ],
    { verdict: 'no-clear-difference' }
  ),
};

export const CONCLUDED: IExperimentEntry = {
  experiment: {
    key: EXPERIMENT_KEY,
    name: 'Sign-up button copy',
    status: 'concluded',
    phase: 1,
    winner: 'b',
    variants: TWO,
  },
  results: RUNNING_TWO.results,
};

export const NO_DATA_YET: IExperimentEntry = {
  experiment: {
    key: EXPERIMENT_KEY,
    name: 'Sign-up button copy',
    status: 'running',
    phase: 1,
    variants: TWO,
  },
  results: results([
    ['a', 0, 0, null],
    ['b', 0, 0, null],
  ]),
};

/** Runs the story as a test but takes no Qlip snapshot (a visually empty state). */
export const noSnapshot = <S extends object>(story: S): S => {
  const base = story as S & { parameters?: Record<string, any> };
  return {
    ...story,
    parameters: { ...base.parameters, qlip: { ...base.parameters?.qlip, skip: true } },
  };
};
