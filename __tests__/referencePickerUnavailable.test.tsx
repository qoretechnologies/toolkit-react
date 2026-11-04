// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReferencePicker } from '../src/components/supportTicket/ReferencePicker';

/**
 * A kind the user may not list is said to be unavailable, with the reason in words (qorus#646).
 *
 * The picker knew one way a kind could have no list: its fetch failed. A permission refused (the Qorus IDE's
 * collections without AI-COLLECTION-READ) was drawn the same way - a red "Couldn't load collections" with a
 * retry that could never help, and the reason only in a tooltip.
 */

const REASON = 'Listing collections needs the AI-COLLECTION-READ permission';

const renderPicker = (props: Partial<React.ComponentProps<typeof ReferencePicker>>) =>
  render(
    <ReqoreUIProvider>
      <ReferencePicker
        kinds={['workflow', 'collection']}
        kind='collection'
        onKindChange={vi.fn()}
        items={[]}
        onAdd={vi.fn()}
        layout='columns'
        presentation='inline'
        {...props}
      />
    </ReqoreUIProvider>
  );

describe('a kind that is unavailable', () => {
  it('shows the reason as the words of one item, named by them', () => {
    renderPicker({ unavailable: REASON });

    const item = screen.getByRole('button', { name: REASON });
    expect(item.textContent).toContain(REASON);
    expect(item.closest('.reqraft-reference-picker-unavailable')).toBeTruthy();
  });

  it('is no failure: nothing says it could not load, and there is nothing to retry', () => {
    const onRetry = vi.fn();
    renderPicker({ unavailable: REASON, error: 'HTTP 403', onRetry });

    expect(screen.queryByText(/Couldn't load/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: REASON }));
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('is the answer even while a fetch is still running', () => {
    renderPicker({ unavailable: REASON, loading: true });

    expect(screen.getByRole('button', { name: REASON })).toBeTruthy();
    expect(screen.queryByText(/Loading/)).toBeNull();
  });

  it('leaves a failed fetch as it was: the failure, and a retry', () => {
    const onRetry = vi.fn();
    renderPicker({ error: 'HTTP 502', onRetry });

    const retry = screen.getByRole('button', { name: /Couldn't load collections/ });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
