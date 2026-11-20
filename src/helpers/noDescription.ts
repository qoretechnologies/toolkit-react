// Copyright 2026 Qore Technologies, s.r.o.
import { reqraftLabels } from './reqraftLabels';

/**
 * What a hover or help says where what it is about has no description: why there is none, in plain words, never a
 * blank: the hover gives the reason there is no description. In the host's words (`setReqraftLabels`), read when
 * asked; a host can also say it per template (`ITemplateReferenceNames.noDescription`).
 */
export const noValueDescription = (): string => reqraftLabels().templateTree.noValueDescription;
export const noFieldDescription = (): string => reqraftLabels().templateTree.noFieldDescription;

/** The server's words for a description it does not have ("No description available", "no description"). */
const SERVER_NO_DESCRIPTION = /^no description( available)?\.?$/i;

/**
 * A description as the server gives it, or none where it gives its stand-in for none ("No description available"):
 * a hover that read "No description available" said nothing, in words that looked like a description.
 */
export const givenDescription = (text?: string): string | undefined =>
  text?.trim() && !SERVER_NO_DESCRIPTION.test(text.trim()) ? text : undefined;
