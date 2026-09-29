/**
 * The experiment and results objects of the qorus-api admin and editor routes (§5, §7, §9.5 of
 * `design/analytics-and-experiments-design.md`), with the fields the A/B test UI reads.
 * Change the contract there first, then here.
 */

export type TExperimentStatus =
  'draft' | 'running' | 'paused' | 'stopped' | 'concluded' | 'archived';

export interface IAdminVariant {
  key: string;
  name?: string;
  weight: number;
  control?: boolean;
}

export interface IAdminExperimentPhase {
  phase: number;
  started_at: string;
  ended_at: string | null;
  variants: IAdminVariant[];
}

export interface IAdminExperimentEvent {
  at: string;
  action: string;
  variant?: string | null;
  /** Who did it (`admin`, or the product's editor, e.g. `landing-editor`). */
  actor: string;
  user?: string;
}

/** The admin experiment object. */
export interface IAdminExperiment {
  key: string;
  name?: string;
  property?: string;
  status: TExperimentStatus;
  variants: IAdminVariant[];
  winner?: string | null;
  /** The current phase: a removed version starts a new one, and the numbers count from zero. */
  phase?: number;
  /** Earlier phases and the current one (last, `ended_at: null` while it runs). */
  phases?: IAdminExperimentPhase[];
  /** Every state change, oldest first. */
  history?: IAdminExperimentEvent[];
  metrics?: { primary?: string; guardrails?: string[]; secondary?: string[] };
}

export interface IResultsVariant {
  variant: string;
  exposed: number;
  converters: number;
  rate: number | null;
  uplift?: number | null;
  chance_to_beat: number | null;
}

export interface IResultsMetric {
  key: string;
  name?: string;
  role: 'primary' | 'guardrail' | 'secondary';
  verdict?: string;
  verdict_text?: string;
  variants: IResultsVariant[];
  unavailable?: string;
}

/** The admin results object. */
export interface IExperimentResults {
  verdict?: string;
  /** The verdict in plain words, written by the server. */
  verdict_text?: string;
  winner_variant?: string | null;
  phase?: number;
  metrics: IResultsMetric[];
}

/** One entry of the editor list: the experiment and its results (null for a draft). */
export interface IExperimentEntry {
  experiment: IAdminExperiment;
  results: IExperimentResults | null;
}

/** The experiment an action returns; `auto_accepted` when removing left one version. */
export type TExperimentActionResult = IAdminExperiment & { auto_accepted?: boolean };

export type TLifecycleAction = 'start' | 'pause' | 'stop';
export type TVersionAction = 'accept' | 'remove';
export type TExperimentAction = TVersionAction | TLifecycleAction;

/** A new experiment definition (admin shape); the server always creates it as a draft. */
export interface INewExperiment {
  key: string;
  name: string;
  hypothesis?: string;
  property?: string;
  variants: IAdminVariant[];
  traffic?: number;
  targeting?: { paths?: string[] | null; device?: string | null; lang?: string | null };
  trigger?: { section?: string | null };
  metrics: { primary: string; guardrails?: string[]; secondary?: string[] };
  min_sample?: { per_variant: number; days: number };
}
