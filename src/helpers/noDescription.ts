// Copyright 2026 Qore Technologies, s.r.o.
import { reqraftLabels } from './reqraftLabels';

/**
 * What a hover or help says where what it is about has no description: why there is none, in plain words, never a
 * blank: the hover gives the reason there is no description. In the host's words (`setReqraftLabels`), read when
 * asked; a host can also say it per template (`ITemplateReferenceNames.noDescription`).
 */
export const noValueDescription = (): string => reqraftLabels().templateTree.noValueDescription;
export const noFieldDescription = (): string => reqraftLabels().templateTree.noFieldDescription;
