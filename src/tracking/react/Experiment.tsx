import type { ReactNode } from 'react';
import { useExperiment } from './hooks';

export interface IExperimentProps {
  /** The experiment key, as in the admin API (`signup-cta`). */
  id: string;
  /** One element per variant key; the control's key must be among them. */
  variants: Record<string, ReactNode>;
  /** The control's key (default `a`). */
  control?: string;
  /** Trigger section (`data-track-section` id) when the definition names none. */
  trigger?: string;
}

/**
 * Renders the visitor's variant: `<Experiment id="signup-cta" variants={{ a: <A />, b: <B /> }} />`.
 * Without consent, without a running definition, or outside the traffic share it
 * renders the control and logs nothing. An ended (concluded) experiment renders its winner
 * for everybody. An in-app switch (`experiments.setEditorOverride`) shows one version per
 * experiment (never logged); a `?qa_variant=signup-cta:b` link previews one for QA.
 *
 * DOM: a `display: contents` wrapper with `data-experiment`, `data-variant` (shown),
 * `data-variants` (every key, comma-separated) and `data-experiment-reason`.
 */
export const Experiment = ({ id, variants, control = 'a', trigger }: IExperimentProps) => {
  const keys = Object.keys(variants);
  const { variant, assignment } = useExperiment(id, { control, trigger, variants: keys });
  const shown = variants[variant] !== undefined ? variant : control;
  // DOM markers, so an editor overlay can find every experiment on the page. `display: contents`
  // gives the wrapper no box, so the page lays out exactly as without it.
  return (
    <div
      style={CONTENTS}
      data-experiment={id}
      data-variant={shown}
      data-variants={keys.join(',')}
      data-experiment-reason={assignment.reason}
    >
      {variants[shown] ?? null}
    </div>
  );
};

const CONTENTS = { display: 'contents' } as const;
