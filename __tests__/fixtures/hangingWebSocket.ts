// Copyright 2026 Qore Technologies, s.r.o.
import { vi } from 'vitest';

/**
 * A WebSocket whose handshake completes only when a test opens it: left alone it hangs as a
 * handshake the server never answers does, sending no event at all.
 *
 * What it does when closed is what a browser does: a socket still connecting fails, with an
 * error and then a close with code 1006, whatever code it was given; an open one closes with the
 * code it was given. Either way the events come after `close()` returns, as a browser queues
 * them.
 */
export class HangingWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  /** Every socket made since `reset()`, oldest first. */
  static instances: HangingWebSocket[] = [];

  static reset() {
    HangingWebSocket.instances = [];
  }

  /** The newest socket. */
  static latest(): HangingWebSocket {
    return HangingWebSocket.instances[HangingWebSocket.instances.length - 1];
  }

  /** The sockets that are neither closing nor closed: never more than one for a connection. */
  static live(): HangingWebSocket[] {
    return HangingWebSocket.instances.filter(
      (socket) => socket.readyState < HangingWebSocket.CLOSING
    );
  }

  readonly CONNECTING = HangingWebSocket.CONNECTING;
  readonly OPEN = HangingWebSocket.OPEN;
  readonly CLOSING = HangingWebSocket.CLOSING;
  readonly CLOSED = HangingWebSocket.CLOSED;

  readyState: number = HangingWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  /** The frames sent on it while it was open. */
  readonly sent: string[] = [];
  /** Answers each frame sent while it is open, as a server would. */
  respond: ((frame: string) => string | undefined) | undefined;

  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  readonly close = vi.fn((code?: number) => {
    if (this.readyState >= HangingWebSocket.CLOSING) {
      return;
    }

    const wasConnecting = this.readyState === HangingWebSocket.CONNECTING;

    this.readyState = HangingWebSocket.CLOSING;
    queueMicrotask(() => {
      this.readyState = HangingWebSocket.CLOSED;

      if (wasConnecting) {
        this.dispatchEvent(new Event('error'));
      }

      this.dispatchEvent(
        new CloseEvent('close', {
          code: wasConnecting ? 1006 : (code ?? 1005),
          wasClean: !wasConnecting,
        })
      );
    });
  });

  constructor(readonly url: string) {
    super();
    HangingWebSocket.instances.push(this);
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    if (listener) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type).add(listener);
    }

    super.addEventListener(type, listener, options);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ) {
    if (listener) {
      this.listeners.get(type)?.delete(listener);
    }

    super.removeEventListener(type, listener, options);
  }

  /** How many listeners are on it now. */
  listenerCount(): number {
    let count = 0;

    this.listeners.forEach((listeners) => {
      count += listeners.size;
    });

    return count;
  }

  send(frame: string) {
    if (this.readyState === HangingWebSocket.CONNECTING) {
      throw new DOMException("Failed to execute 'send' on 'WebSocket'", 'InvalidStateError');
    }

    if (this.readyState !== HangingWebSocket.OPEN) {
      return;
    }

    this.sent.push(frame);

    const answer = this.respond?.(frame);

    if (answer !== undefined) {
      queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: answer })));
    }
  }

  /** Completes the handshake, as a browser does when the server answers the upgrade. */
  open() {
    this.readyState = HangingWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  /** The handshake is refused, or the network drops the socket: an error, then a 1006 close. */
  fail() {
    this.readyState = HangingWebSocket.CLOSED;
    this.dispatchEvent(new Event('error'));
    this.dispatchEvent(new CloseEvent('close', { code: 1006, wasClean: false }));
  }
}
