// Copyright 2026 Qore Technologies, s.r.o.
/**
 * One shared, lazily-opened DPQL document used to ask the server "is this
 * text really an expression?" on behalf of plain form fields that have no
 * editor of their own.
 *
 * ## Why a singleton, and why it is cheap
 *
 * `ReqraftLspClient` multiplexes every document over ONE socket per endpoint
 * (`LspSharedConnection`), and `initialize` runs once for that socket. A
 * probe is therefore not a new connection — it is one extra `didOpen`, and
 * one `QorusDpqlActionSession` in the server's `uriToDpqlSession` map. Even
 * so it is a single shared document rather than one per field: a form with
 * forty expression-capable options would otherwise open forty of them to ask
 * the same question.
 *
 * Nothing is opened until a field actually probes, so a form whose author
 * never types anything expression-shaped costs nothing at all.
 *
 * The document is opened with NO provider context. Verified against the live
 * server: `textDocument/didOpen` with `languageId: 'dpql'` and no metadata
 * still builds a session, and `dpql/parse` answers on it. Record-field
 * references (`@name`) do not resolve to a provider's fields without that
 * context, which is fine — detection asks about the SHAPE of the expression,
 * and the editor the author lands in binds the real context.
 *
 * No `target_type` is sent. Detection asks "is this an expression", not "is
 * it the right type"; a type mismatch is a thing to show the author INSIDE
 * the expression editor, not a reason to refuse to open it.
 */
import { ReqraftLspClient } from '../../utils/lspClient';

/** What a probe answers. Never throws — a failure is `success: false`. */
export interface IDpqlProbeResult {
  success: boolean;
  expression: Record<string, any> | null;
  diagnostics: Array<{ severity?: number | string; message?: string; code?: string | number }>;
}

const FAILED: IDpqlProbeResult = { success: false, expression: null, diagnostics: [] };

/** Opaque, non-secret document URI — the server keys its session by this. */
const PROBE_URI = 'dpql://probe/detection';

/**
 * How many parsed texts to remember. Typing walks through many prefixes of
 * the same expression, and an author re-typing a value should not re-ask.
 */
const MAX_CACHE_ENTRIES = 200;

class DpqlProbe {
  private client: ReqraftLspClient | null = null;
  private opened: Promise<ReqraftLspClient> | null = null;
  private users = 0;
  private readonly cache = new Map<string, IDpqlProbeResult>();

  /** Register a consumer; the document is still not opened until it probes. */
  acquire(): void {
    this.users += 1;
  }

  /** Drop a consumer, closing the shared document when the last one goes. */
  release(): void {
    this.users = Math.max(0, this.users - 1);

    if (this.users === 0) {
      this.close();
    }
  }

  /**
   * Parse `text` on the shared probe document. Resolves to `FAILED` rather
   * than rejecting, for any reason at all — a field must never break because
   * the instance is unreachable.
   */
  async parse(text: string): Promise<IDpqlProbeResult> {
    const cached = this.cache.get(text);

    if (cached) {
      return cached;
    }

    let result = FAILED;

    try {
      const client = await this.open();
      const response = await client.customRequest<Partial<IDpqlProbeResult>>('dpql/parse', {
        uri: PROBE_URI,
        text,
      });

      result = {
        success: response?.success ?? false,
        expression: response?.expression ?? null,
        diagnostics: response?.diagnostics ?? [],
      };
    } catch {
      // Unreachable instance, closed socket, request timeout: the field
      // simply learns nothing and leaves the typed text exactly as it is.
      result = FAILED;
    }

    this.remember(text, result);

    return result;
  }

  /** Open (once) and return the shared document's client. */
  private open(): Promise<ReqraftLspClient> {
    if (this.opened) {
      return this.opened;
    }

    this.opened = (async (): Promise<ReqraftLspClient> => {
      const client = new ReqraftLspClient({ languageId: 'dpql', uri: PROBE_URI });

      await client.connect();
      // `didOpen` is a notification on the same socket as the request that
      // follows it, so the server has the session by the time the parse
      // arrives — no readiness poll needed.
      client.didOpen('');
      this.client = client;

      return client;
    })().catch((error) => {
      // Allow a later probe to retry a connection that failed once.
      this.opened = null;
      throw error;
    });

    return this.opened;
  }

  private remember(text: string, result: IDpqlProbeResult): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next();

      if (!oldest.done) {
        this.cache.delete(oldest.value);
      }
    }

    this.cache.set(text, result);
  }

  private close(): void {
    const client = this.client;

    this.client = null;
    this.opened = null;
    this.cache.clear();

    try {
      client?.disconnect();
    } catch {
      // best-effort teardown
    }
  }
}

/**
 * The process-wide probe. Exported for tests, which reset it between cases;
 * application code goes through `useDpqlProbe`.
 */
export const dpqlProbe = new DpqlProbe();
