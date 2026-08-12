/*
 * Authed attachment byte-fetching, shared by every ticket surface.
 *
 * Attachment bytes can't go through the JSON fetch helpers, so each app grew its
 * own raw-`fetch` copy: qorus-ide in `views/support/api.ts`, admin-portal in
 * `pages/SupportTickets/helpers.ts`. The two were the same function down to the
 * error text ("Could not download the attachment") and the anchor-click dance —
 * they differed only in how the URL is built, which auth header is sent, and
 * which Error subclass is thrown.
 *
 * Those three differences are the parameters below. Everything else — the
 * non-OK check, `URL.createObjectURL`, the temporary anchor, revoking the object
 * URL — lives here once.
 */

export interface ITicketAttachmentAccessConfig {
  /** Absolute URL for one attachment's bytes. */
  attachmentUrl: (ticketId: string, attachmentId: string) => string;
  /**
   * Headers for the byte request — typically auth. A function rather than a
   * value because tokens are resolved per request, not at wire-up time.
   */
  headers?: () => Record<string, string>;
  /**
   * Error to throw on a non-OK response. Defaults to a plain `Error`; apps with
   * their own API error type (carrying the status) pass a factory.
   */
  onError?: (message: string, status: number) => Error;
}

export interface ITicketAttachmentAccess {
  /** Raw bytes. `failure` is the message used if the response isn't OK. */
  fetchBlob: (ticketId: string, attachmentId: string, failure?: string) => Promise<Blob>;
  /**
   * An object URL for the bytes — for inline thumbnails and the lightbox.
   *
   * The caller owns the returned URL and must `URL.revokeObjectURL` it when the
   * element goes away; this cannot do it for them without breaking the img.
   */
  fetchBlobUrl: (ticketId: string, attachmentId: string) => Promise<string>;
  /** Save the attachment to disk under its original filename. */
  download: (ticketId: string, attachmentId: string, filename: string) => Promise<void>;
}

const DEFAULT_DOWNLOAD_FAILURE = 'Could not download the attachment';
const DEFAULT_LOAD_FAILURE = 'Could not load the attachment';

/**
 * Save a blob to disk under `filename`, via a temporary anchor.
 *
 * Exported because it is the half of `download` that has nothing to do with
 * tickets — a surface that already holds the bytes shouldn't have to re-fetch
 * them just to reuse the save behaviour.
 */
export const saveBlobAs = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Safari needs the URL alive until the click is processed; a task boundary is
  // enough and avoids leaking the blob for the life of the document.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const createTicketAttachmentAccess = ({
  attachmentUrl,
  headers,
  onError,
}: ITicketAttachmentAccessConfig): ITicketAttachmentAccess => {
  const fetchBlob = async (
    ticketId: string,
    attachmentId: string,
    failure: string = DEFAULT_LOAD_FAILURE
  ): Promise<Blob> => {
    const response = await fetch(attachmentUrl(ticketId, attachmentId), {
      headers: headers?.() ?? {},
    });

    if (!response.ok) {
      throw onError ? onError(failure, response.status) : new Error(failure);
    }

    return response.blob();
  };

  return {
    fetchBlob,
    fetchBlobUrl: async (ticketId, attachmentId) =>
      URL.createObjectURL(await fetchBlob(ticketId, attachmentId, DEFAULT_LOAD_FAILURE)),
    download: async (ticketId, attachmentId, filename) =>
      saveBlobAs(await fetchBlob(ticketId, attachmentId, DEFAULT_DOWNLOAD_FAILURE), filename),
  };
};
