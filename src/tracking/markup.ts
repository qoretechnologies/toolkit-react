/**
 * The markup contract as props, for places where JSX `data-*` attributes cannot be
 * written directly (a Reqore panel action or a tier's `actionButtonProps` are
 * object literals). In JSX, `data-track-click="…"` works just as well.
 *
 *   <ReqoreButton {...trackClick('get-started', 'cta')} … />
 *   bottomActions={[{ ...primaryCta, ...trackClick('contact', 'pricing-panel'), label: … }]}
 */
export type TTrackAttributes = Record<`data-track-${string}`, string>;

export const trackClick = (target: string, placement?: string, label?: string): TTrackAttributes => ({
  'data-track-click': target,
  ...(placement ? { 'data-track-placement': placement } : {}),
  ...(label ? { 'data-track-label': label } : {}),
});

export const trackSection = (id: string): TTrackAttributes => ({ 'data-track-section': id });
