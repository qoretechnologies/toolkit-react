// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentChips } from '../src/components/supportTicket/AttachmentChips';

/**
 * A staged image is a small thumbnail card with its name, so it reads as the picture it is; every other file
 * stays a chip with a paperclip.
 */

// jsdom has no ResizeObserver or object URLs; the chips use both.
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

const IMAGE = new File(['png'], 'mapper-error.png', { type: 'image/png' });
const PDF = new File(['%PDF-1.4'], 'runbook.pdf', { type: 'application/pdf' });

describe('a staged file', () => {
  it('that is an image is a card with its picture and its name', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <AttachmentChips files={[PDF, IMAGE]} onRemove={vi.fn()} />
      </ReqoreUIProvider>
    );

    const card = container.querySelector('.attachment-image-card');
    expect(card, 'the image is a card').toBeTruthy();
    expect(card!.querySelector('img[alt="mapper-error.png"]')?.getAttribute('src')).toBe('blob:thumbnail');
    expect(card!.textContent).toContain('mapper-error.png');
  });

  it('that is not an image stays a chip, outside any card', () => {
    render(
      <ReqoreUIProvider>
        <AttachmentChips files={[PDF, IMAGE]} onRemove={vi.fn()} />
      </ReqoreUIProvider>
    );

    const pdf = screen.getByText('runbook.pdf');
    expect(pdf.closest('.attachment-image-card')).toBeNull();
    expect(pdf.closest('.reqore-tag')).toBeTruthy();
  });

  it('removes the file it is, by its place among the files the host gave', () => {
    const onRemove = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <AttachmentChips files={[PDF, IMAGE]} onRemove={onRemove} />
      </ReqoreUIProvider>
    );

    const remove = container.querySelector<HTMLElement>('.attachment-image-card .reqore-tag-remove');
    expect(remove, 'the card can be removed').toBeTruthy();
    remove!.click();
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
