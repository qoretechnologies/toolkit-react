// Copyright 2026 Qore Technologies, s.r.o.
// What can hover: a mouse, and a pen held above the screen - never a finger, whose tap is followed by mouse
// events a browser emulates and which say nothing of the finger they came from.
import { describe, expect, it } from 'vitest';
import { isHoveringPointer } from '../src/helpers/hoveringPointer';

describe('isHoveringPointer', () => {
  it('is a mouse, pressed or not', () => {
    expect(isHoveringPointer({ pointerType: 'mouse', buttons: 0 })).toBe(true);
    expect(isHoveringPointer({ pointerType: 'mouse', buttons: 1 })).toBe(true);
  });

  it('is a pen held above the screen, not one pressed to it', () => {
    expect(isHoveringPointer({ pointerType: 'pen', buttons: 0 })).toBe(true);
    expect(isHoveringPointer({ pointerType: 'pen', buttons: 1 })).toBe(false);
  });

  it('is never a finger', () => {
    expect(isHoveringPointer({ pointerType: 'touch', buttons: 0 })).toBe(false);
    expect(isHoveringPointer({ pointerType: 'touch', buttons: 1 })).toBe(false);
  });

  it('is nothing a browser does not name', () => {
    expect(isHoveringPointer({ pointerType: '', buttons: 0 })).toBe(false);
  });
});
