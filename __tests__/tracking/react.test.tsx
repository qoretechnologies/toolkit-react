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

describe('<Experiment> reasons', () => {
  const reasonOf = (container: HTMLElement) => (container.firstElementChild as HTMLElement).dataset;
  const mount = async (options: Parameters<typeof createMemoryTracker>[0]) => {
    const m = createMemoryTracker(options);
    m.tracker.start();
    await m.advance(0);
    const { container } = render(
      <TrackingProvider tracker={m.tracker} location='/'>
        <Experiment id='hero-input' variants={variants} />
      </TrackingProvider>
    );
    return { m, container };
  };

  it('serves the control outside the traffic share, without an exposure', async () => {
    const { m, container } = await mount({ consent: 'granted', vid: 'visitor-1', experiments: [{ ...CTA, traffic: 0 }] });
    expect(reasonOf(container)).toMatchObject({ variant: 'a', experimentReason: 'not-enrolled' });
    await act(() => m.advance(5000));
    expect(m.sent.flatMap((s) => s.batch.events).some((e) => e.type === 'exposure')).toBe(false);
  });

  it('shows a preview link\'s version without consent, never logged', async () => {
    const { container } = await mount({ experiments: [CTA], page: { search: '?qa_variant=hero-input:b' } });
    expect(screen.getByText('Challenger')).toBeTruthy();
    expect(reasonOf(container)).toMatchObject({ variant: 'b', experimentReason: 'preview' });
  });

  it('shows an ended test\'s winner to everybody', async () => {
    const { container } = await mount({
      experiments: [{ key: 'hero-input', status: 'concluded', winner: 'b' } as unknown as IExperimentDefinition],
    });
    expect(reasonOf(container)).toMatchObject({ variant: 'b', experimentReason: 'concluded' });
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
