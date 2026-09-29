import { act, render, screen } from '@testing-library/react';
import { Experiment, TrackingProvider, useConsent } from '../../src/tracking/react';
import { createMemoryTracker } from '../../src/tracking/testing';
import type { IExperimentDefinition } from '../../src/tracking/core/types';

const CTA: IExperimentDefinition = {
  key: 'hero-input',
  variants: [
    { key: 'a', weight: 0.5, control: true },
    { key: 'b', weight: 0.5 },
  ],
  traffic: 1,
  trigger: null,
};

const variants = { a: <span>Control</span>, b: <span>Challenger</span> };

const ConsentState = () => {
  const { state, grant } = useConsent();
  return (
    <button type='button' onClick={grant}>
      consent: {state}
    </button>
  );
};

describe('<Experiment>', () => {
  it('renders the control without a provider, with no box of its own', () => {
    const { container } = render(<Experiment id='hero-input' variants={variants} />);
    expect(screen.getByText('Control')).toBeTruthy();
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.display).toBe('contents');
    expect(wrapper.dataset).toMatchObject({
      experiment: 'hero-input',
      variant: 'a',
      variants: 'a,b',
      experimentReason: 'no-consent',
    });
  });

  it('renders the assigned variant and logs one exposure on render', async () => {
    const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-1', experiments: [CTA] });
    m.tracker.start();
    await m.advance(0);
    render(
      <TrackingProvider tracker={m.tracker} location='/'>
        <Experiment id='hero-input' variants={variants} />
      </TrackingProvider>
    );
    expect(screen.getByText('Challenger')).toBeTruthy();
    await act(() => m.advance(5000));
    const exposures = m.sent.flatMap((s) => s.batch.events).filter((e) => e.type === 'exposure');
    expect(exposures.map((e) => e.props)).toEqual([{ experiment: 'hero-input', variant: 'b', trigger: 'render' }]);
  });

  it('falls back to the control for a variant this code cannot render', async () => {
    const m = createMemoryTracker({ consent: 'granted', vid: 'visitor-1', experiments: [CTA] });
    m.tracker.start();
    await m.advance(0);
    render(
      <TrackingProvider tracker={m.tracker} location='/'>
        <Experiment id='hero-input' variants={{ a: variants.a }} />
      </TrackingProvider>
    );
    expect(screen.getByText('Control')).toBeTruthy();
  });
});

describe('useConsent', () => {
  it('reads unknown outside a provider, and follows the answer inside one', () => {
    const { unmount } = render(<ConsentState />);
    expect(screen.getByText('consent: unknown')).toBeTruthy();
    unmount();
    const m = createMemoryTracker();
    render(
      <TrackingProvider tracker={m.tracker} location='/'>
        <ConsentState />
      </TrackingProvider>
    );
    act(() => screen.getByText('consent: unknown').click());
    expect(screen.getByText('consent: granted')).toBeTruthy();
    expect(m.local.get(m.keys.consent)).toBe('granted');
  });
});
