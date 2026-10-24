// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageLightbox } from '../src/components/imageLightbox/ImageLightbox';
import { AttachmentChips } from '../src/components/supportTicket/AttachmentChips';

/**
 * qorus#646 (React's act warning, found by the story run's warning gate): a staged file's rename input and the
 * lightbox's were closed by taking them off the page while they had the focus. The focus then left them while
 * React removed them, in the middle of React's work - the stories' act ended early, and React reported the updates
 * after it as not wrapped in act - and their blur, which commits, ran then: Enter committed the name twice, and
 * Escape, which cancels, committed what was typed, in a browser that blurs a removed element. Enter and Escape now
 * let go of the focus while the input is still on the page, and the blur closes it: committing for Enter, not for
 * Escape.
 */

// jsdom has no ResizeObserver or object URLs; the chips and the modal use both.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);
URL.createObjectURL = vi.fn(() => 'blob:thumbnail');
URL.revokeObjectURL = vi.fn();

afterEach(() => vi.clearAllMocks());

/** Records, for each blur of `input`, whether it was still on the page. */
const watchBlur = (input: HTMLInputElement) => {
  const onPage: boolean[] = [];
  input.addEventListener('blur', () => onPage.push(input.isConnected));
  return onPage;
};

const FILE = new File(['png'], 'screenshot-1.png', { type: 'image/png' });

const renderChips = (onRename = vi.fn()) => {
  const result = render(
    <ReqoreUIProvider>
      <AttachmentChips files={[FILE]} onRemove={vi.fn()} onRename={onRename} />
    </ReqoreUIProvider>
  );
  const pencil = result.container.querySelector(
    '.reqore-tag-action:not(.reqore-tag-remove)'
  ) as HTMLElement;
  fireEvent.click(pencil);
  const input = result.container.querySelector('input') as HTMLInputElement;
  return { ...result, input, onRename };
};

const renderLightbox = (onRename = vi.fn()) => {
  const result = render(
    <ReqoreUIProvider>
      <ImageLightbox
        images={[{ attachment_id: 'a1', filename: 'screenshot-1.png' }]}
        index={0}
        onIndex={vi.fn()}
        onClose={vi.fn()}
        fetchAttachmentUrl={async () => 'blob:image'}
        onRename={onRename}
      />
    </ReqoreUIProvider>
  );
  return { ...result, onRename };
};

const openLightboxRename = async () => {
  const pencil = await waitFor(() => {
    const element = document.body.querySelector<HTMLElement>('.imagelightbox-rename');
    if (!element) throw new Error('no rename action');
    return element;
  });
  fireEvent.click(pencil);
  return waitFor(() => {
    const element = document.body.querySelector<HTMLInputElement>('.reqore-modal input');
    if (!element) throw new Error('no rename input');
    return element;
  });
};

describe("a staged file's rename input", () => {
  it('lets go of the focus while still on the page, and commits once, on Enter', () => {
    const { input, onRename } = renderChips();
    const blurs = watchBlur(input);
    fireEvent.change(input, { target: { value: 'mapper-error.png' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(blurs).toEqual([true]);
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith(0, 'mapper-error.png');
    expect(input.isConnected).toBe(false);
  });

  it('lets go of the focus while still on the page, and commits nothing, on Escape', () => {
    const { input, onRename } = renderChips();
    const blurs = watchBlur(input);
    fireEvent.change(input, { target: { value: 'not-this.png' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(blurs).toEqual([true]);
    expect(onRename).not.toHaveBeenCalled();
    expect(input.isConnected).toBe(false);
  });

  it('still commits when the focus leaves it for elsewhere', () => {
    const { input, onRename } = renderChips();
    fireEvent.change(input, { target: { value: 'elsewhere.png' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith(0, 'elsewhere.png');
  });
});

describe("the lightbox's rename input", () => {
  it('lets go of the focus while still on the page, and commits once, on Enter', async () => {
    const { onRename } = renderLightbox();
    const input = await openLightboxRename();
    const blurs = watchBlur(input);
    fireEvent.change(input, { target: { value: 'mapper-error.png' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(blurs).toEqual([true]);
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith('a1', 'mapper-error.png');
  });

  it('lets go of the focus while still on the page, and commits nothing, on Escape', async () => {
    const { onRename } = renderLightbox();
    const input = await openLightboxRename();
    const blurs = watchBlur(input);
    fireEvent.change(input, { target: { value: 'not-this.png' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(blurs).toEqual([true]);
    expect(onRename).not.toHaveBeenCalled();
    await waitFor(() => expect(document.body.querySelector('.reqore-modal input')).toBeNull());
  });
});
