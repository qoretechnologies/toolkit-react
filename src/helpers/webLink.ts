// Copyright 2026 Qore Technologies, s.r.o.

/**
 * The web address `text` is, when the whole of it is one: an `http:` or `https:` URL and nothing else, with no
 * space in it. A value that is an address is drawn as a link to it (qorus#646, Foxhoundn on qlip #383: "Please
 * render links as links"). Any other scheme is not a link - `javascript:` above all, which a link would run - and
 * neither is text that only mentions an address.
 */
export const webLinkOf = (text: unknown): string | undefined => {
  if (typeof text !== 'string') {
    return undefined;
  }
  const address = text.trim();
  if (!address || /\s/.test(address)) {
    return undefined;
  }
  try {
    const { protocol, host } = new URL(address);
    return (protocol === 'http:' || protocol === 'https:') && host ? address : undefined;
  } catch {
    // not an absolute address
    return undefined;
  }
};
